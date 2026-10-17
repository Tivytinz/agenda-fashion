jest.mock("../src/db/db", () => ({ query: jest.fn() }));

const express = require("express");
const request = require("supertest");
const jwt = require("jsonwebtoken");
const db = require("../src/db/db");
const auth = require("../src/middlewares/auth");
const authAdmin = require("../src/middlewares/authAdmin");
const routes = require("../src/routes");
const serviceRoutes = require("../src/routes/servicosRoutes");
const errorHandler = require("../src/middlewares/errorHandler");

// Exceções são explícitas: uma nova API sem auth não pode passar silenciosamente.
const exceptions = new Map([
  ["get /auth/configuracao-publica", "publica"],
  ["post /cadastro", "publica"], ["post /login", "publica"],
  ["post /auth/google", "publica"], ["post /auth/esqueci-senha", "publica"],
  ["post /auth/redefinir-senha", "publica"],
  ["post /logout", "revogarSessao"], ["get /planos", "publica"],
  ["post /webhook/asaas", "autenticarWebhookAsaas"],
  ["get /webhook/whatsapp", "verificarWebhook"],
  ["post /webhook/whatsapp", "autenticarWebhookWhatsapp"],
  ["post /eventos-produto", "optionalAuth"],
  ["post /analytics/collect", "optionalAuth"],
  ["get /marketing/meta/config", "publica"],
  ["get /marketing/google/config", "publica"],
  ["get /agenda-publica", "publica"],
  ["get /agenda-publica/politica-cancelamento", "publica"],
  ["post /agendamentos", "optionalAuth"],
  ["get /agendamentos/:id/acesso-visitante", "consultarVisitante"],
  ["patch /agendamentos/:id/cancelar-visitante", "cancelarVisitante"],
  ["get /agendamentos/:id/acesso-cliente-desativado", "consultarReservaDesativada"],
  ["patch /agendamentos/:id/cancelar-acesso-cliente-desativado", "cancelarReservaDesativada"],
  ["get /negocios-publicos", "publica"],
  ["get /catalogo-local/:categoria/:localidade", "publica"],
  ["get /sitemap.xml", "publica"], ["get /robots.txt", "publica"],
  ["get /perfil-negocio/:slug", "publica"],
  ["get /social-preview.png", "publica"],
  ["get /servicos/:categoria/em/:localidade", "publica"],
  ["get /negocio/:slug", "publica"],
  ["get /admin/marketing/custos-integracoes/tiktok_ads/callback", "callback"],
  ["get /admin/marketing/custos-integracoes/pinterest_ads/callback", "callback"],
]);

function inventory(router, prefix = "") {
  return router.stack.flatMap((layer) => {
    if (layer.route) {
      return [].concat(layer.route.path).flatMap((path) =>
        Object.keys(layer.route.methods).map((method) => ({
          method, path: prefix + path,
          handlers: layer.route.stack.map((item) => item.handle),
        })));
    }
    if (layer.handle?.stack) {
      return inventory(layer.handle, layer.handle === serviceRoutes ? "/servicos" : prefix);
    }
    return [];
  });
}
const endpoints = inventory(routes);
const protectedRoutes = endpoints.filter((r) => r.handlers.includes(auth));
const adminRoutes = protectedRoutes.filter((r) => r.handlers.includes(authAdmin));
const app = express();
app.use(express.json());
app.use(routes);
app.use(errorHandler);

function call(route) {
  return request(app)[route.method](route.path.replace(/:[A-Za-z_]+/g, "101"));
}

beforeEach(() => {
  jest.clearAllMocks();
  db.query.mockResolvedValue({ rows: [] });
});

test("toda API tem autenticação ou exceção revisada; administração mantém a ordem dos guards", () => {
  expect(endpoints.length).toBeGreaterThan(140);
  const found = new Set();
  for (const route of endpoints) {
    const key = `${route.method} ${route.path}`;
    if (!route.handlers.includes(auth)) {
      expect(exceptions.has(key)).toBe(true);
      found.add(key);
      const guard = exceptions.get(key);
      if (guard !== "publica") expect(route.handlers.map((h) => h.name)).toContain(guard);
    } else if (route.path.startsWith("/admin/")) {
      expect(route.handlers).toContain(authAdmin);
      expect(route.handlers.indexOf(auth)).toBeLessThan(route.handlers.indexOf(authAdmin));
    }
  }
  expect(found).toEqual(new Set(exceptions.keys()));
});

test.each(protectedRoutes.map((r) => [`${r.method} ${r.path}`, r]))(
  "%s rejeita acesso anônimo antes de consultar dados",
  async (name, route) => {
    const response = await call(route);
    expect(response.status).toBe(401);
    expect(db.query).not.toHaveBeenCalled();
  }
);

test.each(adminRoutes.map((r) => [`${r.method} ${r.path}`, r]))(
  "%s não aceita papel administrativo forjado em JWT/header/payload",
  async (name, route) => {
    // A assinatura é válida; os claims de privilégio não são autoridade.
    const token = jwt.sign({ id: 7, papel: "superadmin", superadmin: true, tipo: "admin" },
      process.env.JWT_SECRET, { expiresIn: "5m" });
    const response = await call(route)
      .set("Authorization", `Bearer ${token}`)
      .set("X-AF-Contexto", "dono")
      .query({ usuario_id: 1, papel: "superadmin", negocio_id: 999 })
      .send({ usuarioId: 1, admin: { superadmin: true }, superadmin: true });
    expect(response.status).toBe(403);
    expect(db.query).toHaveBeenCalledTimes(1);
    expect(db.query.mock.calls[0][1]).toEqual([7]);
  }
);

test("consulta de assinatura sem vínculo de dona é recusa de acesso, não erro interno", async () => {
  const token = jwt.sign({ id: 7, papel: "dono", negocio_id: 999 }, process.env.JWT_SECRET);
  const response = await request(app).get("/minha-assinatura")
    .set("Authorization", `Bearer ${token}`)
    .query({ usuarioId: 1, negocioId: 999 });
  expect(response.status).toBe(404);
  expect(db.query).toHaveBeenCalledTimes(1);
  expect(db.query.mock.calls[0][1]).toEqual([7]);
});
