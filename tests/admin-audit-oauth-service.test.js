jest.mock("../src/repositories/sessaoRepository", () => ({
  buscarAdministradorAtivoPorUsuarioId: jest.fn()
}));
jest.mock("../src/services/adminAuditService", () => ({
  start: jest.fn(), finish: jest.fn()
}));

const sessions = require("../src/repositories/sessaoRepository");
const audit = require("../src/services/adminAuditService");
const oauth = require("../src/services/adminAuditOAuthService");

beforeEach(() => {
  jest.clearAllMocks();
  sessions.buscarAdministradorAtivoPorUsuarioId.mockResolvedValue({ papel: "admin" });
  audit.start.mockResolvedValue({ tentativaId: "attempt", acao: "tiktok_oauth_concluir" });
  audit.finish.mockResolvedValue(null);
});

test("revalida permissão do dono do state antes de trocar credenciais", async () => {
  sessions.buscarAdministradorAtivoPorUsuarioId.mockResolvedValueOnce(null);
  const execute = jest.fn();
  await expect(oauth.run({ userId: 7, action: "tiktok_oauth_concluir", execute }))
    .rejects.toMatchObject({ statusCode: 403 });
  expect(execute).not.toHaveBeenCalled();
  expect(audit.start).not.toHaveBeenCalled();
});

test("audita sucesso e falha do callback sem gravar auth_code", async () => {
  const execute = jest.fn().mockResolvedValue({ autorizado: true });
  await oauth.run({ userId: 7, action: "tiktok_oauth_concluir", execute });
  expect(audit.start).toHaveBeenCalledWith({
    admin: { usuarioId: 7, papel: "admin" }, action: "tiktok_oauth_concluir"
  });
  expect(audit.finish).toHaveBeenCalledWith(expect.anything(), { status: 200 });
  execute.mockRejectedValueOnce({ statusCode: 502 });
  await expect(oauth.run({ userId: 7, action: "pinterest_oauth_concluir", execute }))
    .rejects.toMatchObject({ statusCode: 502 });
  expect(audit.finish).toHaveBeenLastCalledWith(expect.anything(), { status: 502 });
});
