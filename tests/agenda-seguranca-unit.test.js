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
const agendaConfiguracaoRepository = require(
  "../src/repositories/agendaConfiguracaoRepository"
);
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

  test("preserva o negócio autorizado ao montar a grade contextual da agenda geral", async () => {
    agendaRepository.buscarNegocioDono.mockResolvedValue({
      negocio_id: 33,
      fuso_horario: "America/Sao_Paulo"
    });

    agendaRepository.buscarProfissionaisDoNegocio.mockResolvedValue([
      {
        id: 10,
        nome: "Ana",
        foto_url: null
      }
    ]);

    agendaConfiguracaoRepository
      .listarConfiguracoesHorariosNegocio
      .mockResolvedValue([]);
    agendaRepository
      .buscarBloqueiosProfissionaisPorPeriodo
      .mockResolvedValue([]);

    await agendaService.buscarAgendaGeral({
      usuarioId: 7
    });

    expect(
      agendaConfiguracaoRepository
        .listarConfiguracoesHorariosNegocio
    ).toHaveBeenCalledWith({
      negocioId: 33,
      profissionalIds: [10]
    });

    expect(
      agendaRepository.buscarBloqueiosProfissionaisPorPeriodo
    ).toHaveBeenCalledWith(
      33,
      [10],
      expect.any(String),
      expect.any(String)
    );
  });

  test("notificações de dono usam o negócio do contexto já autorizado", async () => {
    agendaRepository.contarNotificacoesAgendaDono.mockResolvedValue(4);

    const resultado = await agendaService.buscarNotificacoesAgenda({
      usuarioId: 7,
      negocioIdContexto: 33,
      papelContexto: "dono"
    });

    expect(
      agendaRepository.buscarVinculoUsuarioNegocio
    ).not.toHaveBeenCalled();
    expect(
      agendaRepository.contarNotificacoesAgendaDono
    ).toHaveBeenCalledWith(33);
    expect(
      agendaRepository.contarNotificacoesAgendaProfissional
    ).not.toHaveBeenCalled();
    expect(resultado).toEqual({ total: 4 });
  });

  test("notificações profissionais ficam escopadas ao negócio do contexto", async () => {
    agendaRepository.contarNotificacoesAgendaProfissional.mockResolvedValue(2);

    const resultado = await agendaService.buscarNotificacoesAgenda({
      usuarioId: 10,
      negocioIdContexto: 44,
      papelContexto: "profissional"
    });

    expect(
      agendaRepository.buscarVinculoUsuarioNegocio
    ).not.toHaveBeenCalled();
    expect(
      agendaRepository.contarNotificacoesAgendaProfissional
    ).toHaveBeenCalledWith(10, 44);
    expect(
      agendaRepository.contarNotificacoesAgendaDono
    ).not.toHaveBeenCalled();
    expect(resultado).toEqual({ total: 2 });
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
    ).toHaveBeenCalledWith(10, "2026-08-10", "09:00", mockClient);
    expect(
      agendaRepository.buscarAgendamentoAtivo
    ).toHaveBeenCalledWith(10, "2026-08-10", "09:00", 33, mockClient);
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
