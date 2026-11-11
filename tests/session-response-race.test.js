const express = require("express");
const jwt = require("jsonwebtoken");
const request = require("supertest");
const auth = require("../src/middlewares/auth");
const optionalAuth = require("../src/middlewares/optionalAuth");
const authSessionRepository = require("../src/repositories/authSessionRepository");
const { definirCookieSessao } = require("../src/config/sessionCookie");

process.env.JWT_SECRET = process.env.JWT_SECRET || "teste-sessao-race-com-mais-de-32-caracteres";

function token(id, options = {}) {
  return jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: "1h", ...options });
}

function createApp() {
  const app = express();
  app.post("/login-teste", (_req, res) => {
    definirCookieSessao(res, token(2));
    res.status(204).end();
  });
  app.get("/protegida", auth, (req, res) => res.json({ usuarioId: req.user.id }));
  app.get("/publica", optionalAuth, (req, res) => res.json({ usuarioId: req.user?.id || null }));
  app.use((error, _req, res, _next) => res.status(500).json({ erro: error.message }));
  return app;
}

afterEach(() => jest.clearAllMocks());

test.each([
  ["/protegida", 401],
  ["/publica", 200]
])("resposta antiga de %s preserva o cookie de um novo login", async (path, expectedStatus) => {
  let finishValidation;
  let validationStarted;
  const started = new Promise(resolve => { validationStarted = resolve; });
  authSessionRepository.buscarEstadoDaSessao.mockImplementation(async id => {
    if (id === 1) {
      validationStarted();
      return new Promise(resolve => { finishValidation = resolve; });
    }
    return { id, ativo: true, senha_alterada_em: null };
  });

  const agent = request.agent(createApp());
  const previousRequest = agent.get(path)
    .set("Cookie", `af_session=${token(1)}`)
    .then(response => response);
  await started;
  await agent.post("/login-teste").expect(204);
  finishValidation({ id: 1, ativo: true, token_revogado: true });

  const previousResponse = await previousRequest;
  expect(previousResponse.status).toBe(expectedStatus);
  expect(previousResponse.headers["set-cookie"]).toBeUndefined();
  if (path === "/publica") expect(previousResponse.body.usuarioId).toBeNull();
  await agent.get("/protegida").expect(200, { usuarioId: 2 });
});

test.each([
  ["/protegida", 401],
  ["/publica", 200]
])("token expirado em %s não envia exclusão de cookie", async (path, status) => {
  const response = await request(createApp()).get(path)
    .set("Cookie", `af_session=${token(1, { expiresIn: -1 })}`);
  expect(response.status).toBe(status);
  expect(response.headers["set-cookie"]).toBeUndefined();
  expect(authSessionRepository.buscarEstadoDaSessao).not.toHaveBeenCalled();
});
