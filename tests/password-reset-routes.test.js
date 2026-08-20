const express = require("express");
const request = require("supertest");

jest.mock("../src/services/passwordResetService", () => ({
  solicitarRedefinicao: jest.fn(),
  redefinirSenha: jest.fn(),
}));

const passwordResetService = require("../src/services/passwordResetService");
const authRoutes = require("../src/routes/authRoutes");

function criarApp() {
  const app = express();

  app.use(express.json());
  app.use(authRoutes);
  app.use((erro, _req, res, _next) => res.status(
    erro.statusCode || erro.status || 500
  ).json({ erro: erro.message }));

  return app;
}

describe("rotas de recuperação de senha", () => {
  beforeEach(() => jest.clearAllMocks());

  test("solicita o link com resposta não armazenável", async () => {
    passwordResetService.solicitarRedefinicao.mockResolvedValue({
      mensagem: "Se o e-mail estiver cadastrado, você receberá um link.",
    });

    const resposta = await request(criarApp())
      .post("/auth/esqueci-senha")
      .send({ email: "ana@example.com" });

    expect(resposta.status).toBe(200);
    expect(resposta.headers["cache-control"]).toBe("no-store");
    expect(passwordResetService.solicitarRedefinicao).toHaveBeenCalledWith({
      email: "ana@example.com",
    });
  });

  test("redefine a senha e remove a sessão atual", async () => {
    passwordResetService.redefinirSenha.mockResolvedValue({
      mensagem: "Senha alterada com sucesso.",
    });

    const resposta = await request(criarApp())
      .post("/auth/redefinir-senha")
      .set("Cookie", "af_session=sessao-antiga")
      .send({ token: "A".repeat(43), senha: "senha-segura" });

    expect(resposta.status).toBe(200);
    expect(resposta.headers["cache-control"]).toBe("no-store");
    expect(resposta.headers["set-cookie"][0]).toMatch(
      /^af_session=;.*Expires=Thu, 01 Jan 1970/i
    );
    expect(passwordResetService.redefinirSenha).toHaveBeenCalledWith({
      token: "A".repeat(43),
      senha: "senha-segura",
    });
  });
});
