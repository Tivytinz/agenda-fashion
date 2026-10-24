jest.mock("../src/services/equipeAnalyticsService", () => ({ registrarTransicao: jest.fn() }));
jest.mock("../src/db/db", () => ({ executarTransacao: jest.fn() }));
jest.mock("../src/repositories/profissionaisRepository");
jest.mock("../src/services/planoService", () => ({ buscarUsoPlano: jest.fn(), criarErroLimite: jest.fn() }));
const db = require("../src/db/db");
const repo = require("../src/repositories/profissionaisRepository");
const service = require("../src/services/profissionaisService");
const client = { query: jest.fn() };
beforeEach(() => {
  jest.resetAllMocks();
  db.executarTransacao.mockImplementation((callback) => callback(client));
  repo.buscarNegocioDono.mockResolvedValue({ negocio_id: 7 });
  repo.bloquearContaDonaAtiva.mockResolvedValue({ id: 1 });
  repo.bloquearVinculoProfissionalDaDona.mockResolvedValue({ id: 42, papel: "profissional", ativo: true });
  repo.inativarVinculoProfissional.mockResolvedValue({ id: 42, ativo: false, motivo_inatividade: "inativado_pela_dona" });
});

test.each([null, undefined, "abc", "1.5", -1, 0, "9007199254740992"])("recusa identidade inválida %s sem iniciar a escrita", async (id) => {
  await expect(service.inativarProfissional({ usuarioId: 1, profissionalId: id })).rejects.toMatchObject({ statusCode: 400 });
  expect(db.executarTransacao).not.toHaveBeenCalled();
});

test.each(["ativarProfissional", "inativarProfissional"])("%s revalida a conta antes de bloquear capacidade ou alterar vínculo", async (operation) => {
  repo.bloquearContaDonaAtiva.mockResolvedValue(null);
  await expect(service[operation]({ usuarioId: 1, profissionalId: 20 })).rejects.toMatchObject({ statusCode: 403 });
  expect(repo.bloquearCadastroProfissional).not.toHaveBeenCalled();
  expect(repo.inativarVinculoProfissional).not.toHaveBeenCalled();
});

test.each(["ativarProfissional", "inativarProfissional"])("perda do vínculo de dona ou negócio ativo impede %s", async (operation) => {
  repo.bloquearVinculoProfissionalDaDona.mockResolvedValue(null);
  await expect(service[operation]({ usuarioId: 1, profissionalId: 20 })).rejects.toMatchObject({ statusCode: 404 });
  expect(repo.inativarVinculoProfissional).not.toHaveBeenCalled();
});

test.each([null, "aguardando_vaga_plano", "excedente_limite_plano", "inativado_pela_dona"])("repetir inativação preserva o motivo anterior %s", async (motivo) => {
  repo.bloquearVinculoProfissionalDaDona.mockResolvedValue({ id: 42, ativo: false, motivo_inatividade: motivo });
  await expect(service.inativarProfissional({ usuarioId: 1, profissionalId: 20 })).resolves.toMatchObject({ ativo: false, motivo_inatividade: motivo });
  expect(repo.inativarVinculoProfissional).not.toHaveBeenCalled();
});
