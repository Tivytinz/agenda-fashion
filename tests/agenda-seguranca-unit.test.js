const mockClient = {
  query: jest.fn()
};

jest.mock("../src/db/db", () => ({
  executarTransacao: jest.fn(async (callback) => callback(mockClient))
}));

jest.mock("../src/repositories/agendaRepository");
jest.mock("../src/repositories/agendaConfiguracaoRepository");

const db = require("../src/db/db");
const agendaRepository = require("../src/repositories/agendaRepository");
const agendaService = require("../src/services/agendaService");

describe("Segurança da agenda", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("profissional comum não acessa a agenda geral", async () => {
    agendaRepository.buscarNegocioDono.mockResolvedValue(null);

    await expect(
      agendaService.buscarAgendaGeral({ usuarioId: 10 })
    ).rejects.toMatchObject({
      statusCode: 403,
      message: "Apenas o dono pode acessar a agenda geral."
    });

    expect(
      agendaRepository.buscarProfissionaisDoNegocio
    ).not.toHaveBeenCalled();
  });

  test("preserva o negócio autorizado ao carregar compromissos da agenda geral", async () => {
    agendaRepository.buscarNegocioDono.mockResolvedValue({
      negocio_id: 33
    });

    agendaRepository.buscarProfissionaisDoNegocio.mockResolvedValue([
      {
        id: 10,
        nome: "Ana",
        foto_url: null
      }
    ]);

    agendaRepository.buscarBloqueiosProfissionaisPorPeriodo.mockResolvedValue([]);
    agendaRepository.buscarAgendamentosProfissionaisPorPeriodo.mockResolvedValue([]);

    await agendaService.buscarAgendaGeral({
      usuarioId: 7
    });

    expect(
      agendaRepository.buscarAgendamentosProfissionaisPorPeriodo
    ).toHaveBeenCalledWith(
      33,
      [10],
      expect.any(String),
      expect.any(String)
    );
  });

  test("bloqueia, consulta e grava o horário na mesma transação", async () => {
    agendaRepository.bloquearAlteracaoHorario.mockResolvedValue();
    agendaRepository.buscarAgendamentoAtivo.mockResolvedValue(null);
    agendaRepository.buscarBloqueioHorarioNovo.mockResolvedValue(null);
    agendaRepository.buscarBloqueioGlobalLegado.mockResolvedValue(null);
    agendaRepository.criarBloqueioHorario.mockResolvedValue();

    const resultado = await agendaService.alternarBloqueioHorario({
      usuarioId: 10,
      data: "2026-08-10",
      hora: "09:00",
      negocioIdContexto: 33,
      papelContexto: "profissional"
    });

    expect(db.executarTransacao).toHaveBeenCalledTimes(1);
    expect(
      agendaRepository.bloquearAlteracaoHorario
).toHaveBeenCalledWith(10, "2026-08-10", "09:00", 33, mockClient);
    expect(
      agendaRepository.buscarAgendamentoAtivo
    ).toHaveBeenCalledWith(10, "2026-08-10", "09:00", mockClient);
    expect(
      agendaRepository.buscarBloqueioHorarioNovo
    ).toHaveBeenCalledWith(10, 33, "2026-08-10", "09:00", mockClient);
    expect(
      agendaRepository.buscarBloqueioGlobalLegado
    ).toHaveBeenCalledWith(10, "2026-08-10", "09:00", mockClient);
    expect(
      agendaRepository.criarBloqueioHorario
    ).toHaveBeenCalledWith(10, 33, "2026-08-10", "09:00", mockClient);
    expect(resultado.status).toBe("bloqueado");
  });

  test("converte violação única de bloqueio em erro operacional", async () => {
    agendaRepository.bloquearAlteracaoHorario.mockResolvedValue();
    agendaRepository.buscarAgendamentoAtivo.mockResolvedValue(null);
    agendaRepository.buscarBloqueioHorarioNovo.mockResolvedValue(null);
    agendaRepository.buscarBloqueioGlobalLegado.mockResolvedValue(null);
    agendaRepository.criarBloqueioHorario.mockRejectedValue({
      code: "23505"
    });

    await expect(
      agendaService.alternarBloqueioHorario({
        usuarioId: 10,
        data: "2026-08-10",
        hora: "09:00",
        negocioIdContexto: 33,
        papelContexto: "profissional"
      })
    ).rejects.toMatchObject({
      statusCode: 400,
      message: "Horário já está bloqueado."
    });
  });
});
