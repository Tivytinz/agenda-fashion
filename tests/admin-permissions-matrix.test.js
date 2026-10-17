const fs = require("fs");
const path = require("path");
const express = require("express");
const request = require("supertest");
const jwt = require("jsonwebtoken");

jest.mock("../src/db/db", () => ({ query: jest.fn() }));
jest.mock("../src/repositories/adminAuditRepository", () => ({
  registrarEvento: jest.fn().mockResolvedValue({}),
  listar: jest.fn(), transacao: jest.fn(), buscarTentativaParaRevisao: jest.fn(), registrarRevisao: jest.fn(),
}));

const db = require("../src/db/db");
const ledger = require("../src/repositories/adminAuditRepository");
const auth = require("../src/middlewares/auth");
const authAdmin = require("../src/middlewares/authAdmin");
const errorHandler = require("../src/middlewares/errorHandler");
const routers = [
  require("../src/routes/adminRoutes"),
  require("../src/routes/adminAnalyticsV2Routes"),
];
const matrix = fs.readFileSync(path.join(__dirname, "../docs/admin-permissoes-matriz.md"), "utf8")
  .split("\n")
  .filter((line) => /^\| AP-\d{3} \|/.test(line))
  .map((line) => {
    const [id, action, endpoint, admin, audit] = line.split("|")
      .slice(1, -1).map((cell) => cell.trim().replace(/`/g, ""));
    const [method, route] = endpoint.split(" ");
    return { id, action, method, route, admin, audit };
  });
const routes = routers.flatMap((router) => router.stack.filter((layer) => layer.route)
  .flatMap((layer) => Object.keys(layer.route.methods).map((method) => ({
    method: method.toUpperCase(), route: layer.route.path,
    handlers: layer.route.stack.map((item) => item.handle),
  }))));

test("a matriz classifica cada ação administrativa real, incluindo callbacks e auditoria", () => {
  const keys = (items) => items.map((item) => `${item.method} ${item.route}`).sort();
  expect(matrix).toHaveLength(41);
  expect(new Set(matrix.map((item) => item.id)).size).toBe(matrix.length);
  expect(new Set(keys(matrix)).size).toBe(matrix.length);
  expect(keys(matrix)).toEqual(keys(routes));
  expect(matrix.filter((item) => item.admin === "Sim")).toHaveLength(39);
  expect(matrix.filter((item) => item.admin === "Delegado")).toHaveLength(2);
  for (const entry of matrix) {
    const route = routes.find((item) => item.method === entry.method && item.route === entry.route);
    if (entry.admin === "Delegado") {
      expect(entry.route).toMatch(/\/(tiktok_ads|pinterest_ads)\/callback$/);
      expect(entry.method).toBe("GET");
      expect(route.handlers).not.toContain(auth);
      expect(route.handlers.at(-1).name).toBe("callback");
      expect(entry.audit).toMatch(/^(tiktok|pinterest)_oauth_concluir$/);
    } else {
      expect(entry.admin).toBe("Sim");
      expect(route.handlers[0]).toBe(auth);
      expect(route.handlers[1]).toBe(authAdmin);
      const audited = route.handlers.some((handler) => handler.name === "auditRequest");
      expect(audited).toBe(entry.audit !== "—");
      if (entry.method !== "GET" && !entry.route.endsWith("/testar")) expect(audited).toBe(true);
    }
  }
});

const app = express();
app.use(express.json());
routers.forEach((router) => app.use(router));
app.use(errorHandler);

beforeEach(() => {
  jest.clearAllMocks();
  // Apenas a busca de autorização é permitida. Qualquer query do domínio falha.
  db.query.mockReset().mockRejectedValue(new Error("Consulta de domínio após recusa de papel"))
    .mockResolvedValueOnce({ rows: [{ usuario_id: 7, papel: "admin" }] });
});

test("admin consulta auditoria sem precisar de um segundo nível", async () => {
  ledger.listar.mockResolvedValue({ rows: [], total: 0 });
  const token = jwt.sign({ id: 7 }, process.env.JWT_SECRET);
  const response = await request(app).get("/admin/auditoria").set("Authorization", `Bearer ${token}`);
  expect(response.status).toBe(200);
  expect(response.headers["cache-control"]).toContain("no-store");
  expect(ledger.listar).toHaveBeenCalledTimes(1);
  expect(db.query).toHaveBeenCalledTimes(1);
});

test("admin revisa tentativa vencida com trilha e identidade do backend", async () => {
  ledger.transacao.mockImplementation((callback) => callback({}));
  ledger.buscarTentativaParaRevisao.mockResolvedValue({ id: 17, vencida: true });
  ledger.registrarRevisao.mockResolvedValue({ revisado_em: "2026-10-16T00:00:00Z" });
  const token = jwt.sign({ id: 7, usuarioId: 999 }, process.env.JWT_SECRET);
  const response = await request(app).post("/admin/auditoria/11111111-1111-4111-8111-111111111111/revisao")
    .set("Authorization", `Bearer ${token}`)
    .send({ avaliacao: "INDETERMINADO", evidenciaTipo: "LOG_APLICACAO", evidenciaReferencia: "request-12345", usuarioId: 999 });
  expect(response.status).toBe(201);
  expect(ledger.registrarRevisao).toHaveBeenCalledWith(expect.objectContaining({ revisorUsuarioId: 7 }), expect.anything());
  expect(ledger.registrarEvento).toHaveBeenCalledWith(expect.objectContaining({
    fase: "INICIADA", atorUsuarioId: 7, papelAdmin: "admin", acao: "auditoria_revisar",
  }));
  expect(db.query).toHaveBeenCalledTimes(1);
});
