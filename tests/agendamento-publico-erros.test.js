const express = require("express");
const request = require("supertest");

jest.mock("../src/services/agendamentoPublicoService");
jest.mock("../src/services/planoService");

const AppError = require("../src/errors/AppError");
const agendaPublicaService = require(
  "../src/services/agendamentoPublicoService"
);
const controller = require(
  "../src/controllers/agendamentoPublicoController"
);
const errorHandler = require("../src/middlewares/errorHandler");

function criarApp() {
  const app = express();

  app.get("/agenda-publica", controller.buscarAgendaPublica);
  app.use(errorHandler);

  return app;
}

describe("Erros da agenda pública", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("não expõe mensagem de falha interna", async () => {
    agendaPublicaService.buscarDadosBaseAgenda.mockRejectedValue(
      new Error("coluna secreta não existe")
    );

    const resposta = await request(criarApp())
      .get("/agenda-publica")
      .query({
        slug: "studio",
        servicoId: 1,
        profissionalId: 2
      });

    expect(resposta.statusCode).toBe(500);
    expect(resposta.body.erro).toBe("Erro interno do servidor.");
    expect(resposta.text).not.toContain("coluna secreta");
  });

  test("preserva mensagem de erro operacional", async () => {
    agendaPublicaService.buscarDadosBaseAgenda.mockRejectedValue(
      new AppError("Profissional não encontrado.", 404)
    );

    const resposta = await request(criarApp())
      .get("/agenda-publica")
      .query({
        slug: "studio",
        servicoId: 1,
        profissionalId: 2
      });

    expect(resposta.statusCode).toBe(404);
    expect(resposta.body.erro).toBe("Profissional não encontrado.");
  });
});
