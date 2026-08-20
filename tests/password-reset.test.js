const crypto = require("crypto");

process.env.JWT_SECRET = "segredo-de-teste";
process.env.PUBLIC_APP_URL = "https://app.agendafashion.com.br";
process.env.BCRYPT_ROUNDS = "10";

jest.mock("bcrypt", () => ({
  hash: jest.fn(),
}));

jest.mock("../src/repositories/authRepository", () => ({
  buscarUsuarioPorEmail: jest.fn(),
}));

jest.mock("../src/repositories/passwordResetRepository", () => ({
  substituirToken: jest.fn(),
  invalidarToken: jest.fn(),
  redefinirSenha: jest.fn(),
}));

jest.mock("../src/providers/emailProvider", () => ({
  enviarRedefinicaoSenha: jest.fn(),
}));

const bcrypt = require("bcrypt");
const authRepository = require("../src/repositories/authRepository");
const passwordResetRepository = require("../src/repositories/passwordResetRepository");
const emailProvider = require("../src/providers/emailProvider");
const service = require("../src/services/passwordResetService");

describe("recuperação de senha", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    bcrypt.hash.mockResolvedValue("senha-hash");
    passwordResetRepository.substituirToken.mockResolvedValue({ id: 1 });
    passwordResetRepository.invalidarToken.mockResolvedValue();
    passwordResetRepository.redefinirSenha.mockResolvedValue({ usuarioId: 7 });
    emailProvider.enviarRedefinicaoSenha.mockResolvedValue({ id: "email-1" });
  });

  test("não revela quando o e-mail não está cadastrado", async () => {
    authRepository.buscarUsuarioPorEmail.mockResolvedValue(null);

    const resultado = await service.solicitarRedefinicao({
      email: "ausente@example.com",
    });

    expect(resultado.mensagem).toMatch(/Se o e-mail estiver cadastrado/i);
    expect(passwordResetRepository.substituirToken).not.toHaveBeenCalled();
    expect(emailProvider.enviarRedefinicaoSenha).not.toHaveBeenCalled();
  });

  test("salva somente o hash e envia o token pelo link", async () => {
    authRepository.buscarUsuarioPorEmail.mockResolvedValue({
      id: 7,
      nome: "Ana Silva",
      email: "ana@example.com",
      ativo: true,
    });

    await service.solicitarRedefinicao({ email: " ANA@EXAMPLE.COM " });

    const registro = passwordResetRepository.substituirToken.mock.calls[0][0];
    const envio = emailProvider.enviarRedefinicaoSenha.mock.calls[0][0];
    const token = new URL(envio.link).searchParams.get("token");

    expect(registro.usuarioId).toBe(7);
    expect(registro.tokenHash).toMatch(/^[a-f0-9]{64}$/);
    expect(registro.tokenHash).toBe(
      crypto.createHash("sha256").update(token).digest("hex")
    );
    expect(envio.link).toContain("/redefinir-senha?token=");
    expect(envio.link).not.toContain(registro.tokenHash);
  });

  test("invalida o token quando o envio falha sem revelar a conta", async () => {
    authRepository.buscarUsuarioPorEmail.mockResolvedValue({
      id: 7,
      nome: "Ana",
      email: "ana@example.com",
      ativo: true,
    });
    emailProvider.enviarRedefinicaoSenha.mockRejectedValue(
      Object.assign(new Error("indisponível"), { code: "EMAIL_PROVIDER_ERROR" })
    );

    const resultado = await service.solicitarRedefinicao({
      email: "ana@example.com",
    });

    const tokenHash = passwordResetRepository.substituirToken.mock.calls[0][0].tokenHash;
    expect(passwordResetRepository.invalidarToken).toHaveBeenCalledWith(tokenHash);
    expect(resultado.mensagem).toMatch(/Se o e-mail estiver cadastrado/i);
  });

  test("mantém a resposta neutra quando não consegue registrar o token", async () => {
    authRepository.buscarUsuarioPorEmail.mockResolvedValue({
      id: 7,
      nome: "Ana",
      email: "ana@example.com",
      ativo: true,
    });
    passwordResetRepository.substituirToken.mockRejectedValue(
      Object.assign(new Error("indisponível"), { code: "DATABASE_ERROR" })
    );

    const resultado = await service.solicitarRedefinicao({
      email: "ana@example.com",
    });

    expect(resultado.mensagem).toMatch(/Se o e-mail estiver cadastrado/i);
    expect(emailProvider.enviarRedefinicaoSenha).not.toHaveBeenCalled();
    expect(passwordResetRepository.invalidarToken).toHaveBeenCalled();
  });

  test("consome o token uma única vez e atualiza a senha", async () => {
    const token = Buffer.alloc(32, 7).toString("base64url");

    const resultado = await service.redefinirSenha({
      token,
      senha: "nova-senha-segura",
    });

    expect(bcrypt.hash).toHaveBeenCalledWith("nova-senha-segura", 10);
    expect(passwordResetRepository.redefinirSenha).toHaveBeenCalledWith({
      tokenHash: service.hashToken(token),
      senhaHash: "senha-hash",
    });
    expect(resultado.mensagem).toMatch(/Senha alterada com sucesso/i);
  });

  test("rejeita token inválido, expirado ou já utilizado", async () => {
    const token = Buffer.alloc(32, 8).toString("base64url");
    passwordResetRepository.redefinirSenha.mockResolvedValue(null);

    await expect(service.redefinirSenha({
      token,
      senha: "nova-senha-segura",
    })).rejects.toMatchObject({ statusCode: 400 });
  });
});
