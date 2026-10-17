jest.mock("../src/services/encerramentoService", () => ({
  consultarReservaClienteDesativado: jest.fn(), cancelarReservaClienteDesativado: jest.fn(),
}));
jest.mock("../src/services/agendamentoCancelamentoService", () => ({
  consultarAgendamentoVisitante: jest.fn(), cancelarAgendamentoVisitante: jest.fn(),
}));
jest.mock("../src/services/agendamentoNotificacaoService", () => ({ notificarEquipeInternamente: jest.fn() }));
const express = require("express");
const request = require("supertest");
const encerramento = require("../src/services/encerramentoService");
const cancelamento = require("../src/services/agendamentoCancelamentoService");
const inactive = require("../src/controllers/encerramentoController");
const guest = require("../src/controllers/agendamentoCancelamentoController");
const errorHandler = require("../src/middlewares/errorHandler");
const cases = [
  ["get", "/inactive/:id", inactive.consultarReservaDesativada, encerramento.consultarReservaClienteDesativado, "acesso"],
  ["patch", "/inactive/:id", inactive.cancelarReservaDesativada, encerramento.cancelarReservaClienteDesativado, "acesso"],
  ["get", "/guest/:id", guest.consultarVisitante, cancelamento.consultarAgendamentoVisitante, "acessoVisitante"],
  ["patch", "/guest/:id", guest.cancelarVisitante, cancelamento.cancelarAgendamentoVisitante, "acessoVisitante"],
];
const app = express();
app.use(express.json());
for (const [method, path, handler] of cases) app[method](path, handler);
app.use(errorHandler);
beforeEach(() => jest.resetAllMocks());

test.each(cases)("%s %s preserva transporte usado pela interface e impede cache", async (method, path, handler, service, key) => {
  service.mockResolvedValue({ id: 11, agendamento: { id: 11 } });
  let req = request(app)[method](path.replace(":id", "11")).query({ token: "nao-usar-da-url" });
  if (method === "get") req = req.set("X-Agenda-Access", "capability");
  else req = req.send(key === "acesso" ? { token: "capability" } : { acesso_visitante: "capability" });
  const response = await req;
  expect(response.status).toBe(200);
  expect(response.headers["cache-control"]).toContain("no-store");
  expect(service).toHaveBeenCalledWith(expect.objectContaining({ agendamentoId: "11", [key]: "capability" }));
});

test.each(cases)("%s %s não usa credencial de query e impede cache de erros", async (method, path, handler, service, key) => {
  service.mockRejectedValue(Object.assign(new Error("Acesso inválido."), { statusCode: 403 }));
  const response = await request(app)[method](path.replace(":id", "11")).query({ token: "token-na-url" }).send({});
  expect(response.status).toBe(403);
  expect(response.headers["cache-control"]).toContain("no-store");
  expect(service).toHaveBeenCalledWith(expect.objectContaining({ agendamentoId: "11", [key]: undefined }));
});
