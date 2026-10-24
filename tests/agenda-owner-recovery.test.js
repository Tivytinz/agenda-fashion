jest.mock("../src/db/db", () => ({ executarTransacao: jest.fn() }));
jest.mock("../src/repositories/agendaRepository");
jest.mock("../src/repositories/agendaConfiguracaoRepository");
const db = require("../src/db/db");
const repository = require("../src/repositories/agendaRepository");
const configuracaoRepository = require("../src/repositories/agendaConfiguracaoRepository");
const service = require("../src/services/agendaService");

beforeEach(() => {
  jest.resetAllMocks();
  repository.buscarNegocioDono.mockResolvedValue({ negocio_id: 55, fuso_horario: "America/Sao_Paulo" });
  repository.buscarProfissionaisDoNegocio.mockResolvedValue([{ id: 7, nome: "Ana" }]);
  configuracaoRepository.listarConfiguracoesHorariosNegocio.mockResolvedValue([]);
  repository.buscarBloqueiosProfissionaisPorPeriodo.mockResolvedValue([]);
});

describe("período explícito da agenda geral", () => {
  test.each(["2026-10-20", "2026-11-02", "2028-02-29", "0001-01-01", "9999-12-25"])("consulta sete dias a partir de %s no negócio autorizado", async (dataInicio) => {
    const result = await service.buscarAgendaGeral({ usuarioId: 1, dataInicio });
    expect(result.agenda).toHaveLength(7);
    expect(result.agenda[0].data).toBe(dataInicio);
    const end = new Date(`${dataInicio}T12:00:00Z`);
    end.setUTCDate(end.getUTCDate() + 6);
    expect(result.agenda[6].data).toBe(end.toISOString().slice(0, 10));
    expect(repository.buscarBloqueiosProfissionaisPorPeriodo).toHaveBeenCalledWith(55, [7], dataInicio, result.agenda[6].data);
  });

  test.each(["", "2026-02-30", "2026-02-29", "2026-13-01", "2026-1-01", "2026-10-21T12:00:00Z", "0000-01-01", "9999-12-26", null, ["2026-10-21"], { data: "2026-10-21" }])("rejeita data inicial inválida %j sem consultar reservas", async (dataInicio) => {
    await expect(service.buscarAgendaGeral({ usuarioId: 1, dataInicio })).rejects.toMatchObject({ statusCode: 400 });
    expect(repository.buscarBloqueiosProfissionaisPorPeriodo).not.toHaveBeenCalled();
  });

  test("mantém hoje no fuso do negócio quando a data não é informada", async () => {
    jest.useFakeTimers().setSystemTime(new Date("2026-10-21T01:00:00Z"));
    try {
      const result = await service.buscarAgendaGeral({ usuarioId: 1 });
      expect(result.agenda[0].data).toBe("2026-10-20");
    } finally { jest.useRealTimers(); }
  });

  test("preserva o dia da semana nos anos iniciais aceitos pelo formato ISO", async () => {
    configuracaoRepository.listarConfiguracoesHorariosNegocio.mockResolvedValue([{
      profissional_id: 7, dia_semana: 1, trabalha: true,
      hora_inicio: "09:00", hora_fim: "10:00", duracao_padrao: 30,
    }]);
    const result = await service.buscarAgendaGeral({ usuarioId: 1, dataInicio: "0001-01-01" });
    expect(result.agenda[0].profissionais[0].horarios[0].hora).toBe("09:00");
  });

  test("escolher uma data não concede acesso à profissional sem vínculo de dona", async () => {
    repository.buscarNegocioDono.mockResolvedValue(null);
    await expect(service.buscarAgendaGeral({ usuarioId: 7, dataInicio: "2026-10-20" })).rejects.toMatchObject({ statusCode: 403 });
    expect(repository.buscarProfissionaisDoNegocio).not.toHaveBeenCalled();
  });

  test("a grade de profissional inativa permite somente materializar reservas existentes", async () => {
    repository.buscarProfissionaisDoNegocio.mockResolvedValue([{ id: 7, nome: "Ana", ativo: false, servico_ids: [9] }]);
    const result = await service.buscarAgendaGeral({ usuarioId: 1, dataInicio: "2026-10-20" });
    expect(repository.buscarProfissionaisDoNegocio).toHaveBeenCalledWith(55, "2026-10-20", "2026-10-26");
    expect(result.agenda.every((day) => day.profissionais[0].ativo === false
      && day.profissionais[0].horarios.length === 0 && day.profissionais[0].servico_ids.length === 0)).toBe(true);
  });
});

describe("estado desejado de bloqueio", () => {
  const args = { usuarioId: 7, negocioIdContexto: 55, papelContexto: "profissional", data: "2026-10-22", hora: "09:00" };
  beforeEach(() => {
    db.executarTransacao.mockImplementation((callback) => callback({ query: jest.fn() }));
  });

  test("repetir bloquear e liberar mantém o estado pedido e preserva toggle para clientes antigos", async () => {
    let block = null;
    repository.buscarBloqueioHorarioNovo.mockImplementation(async () => block);
    repository.criarBloqueioHorario.mockImplementation(async () => { block = { id: 9 }; });
    repository.removerBloqueioHorario.mockImplementation(async () => { block = null; });
    for (const bloqueado of [true, true, false, false]) {
      expect((await service.alternarBloqueioHorario({ ...args, bloqueado })).status).toBe(bloqueado ? "bloqueado" : "livre");
    }
    expect(repository.criarBloqueioHorario).toHaveBeenCalledTimes(1);
    expect(repository.removerBloqueioHorario).toHaveBeenCalledTimes(1);
    expect((await service.alternarBloqueioHorario(args)).status).toBe("bloqueado");
    expect((await service.alternarBloqueioHorario(args)).status).toBe("livre");
    expect(repository.bloquearAlteracaoHorario).toHaveBeenCalledTimes(6);
  });

  test.each(["true", "false", 0, 1, null, []])("rejeita estado que não seja booleano: %j", async (bloqueado) => {
    await expect(service.alternarBloqueioHorario({ ...args, bloqueado })).rejects.toMatchObject({ statusCode: 400 });
    expect(db.executarTransacao).not.toHaveBeenCalled();
  });

  test("não trata reserva ativa como horário livre mesmo em pedido idempotente", async () => {
    repository.buscarAgendamentoAtivo.mockResolvedValue({ id: 1 });
    await expect(service.alternarBloqueioHorario({ ...args, bloqueado: false })).rejects.toThrow("Horário já está agendado.");
    expect(repository.removerBloqueioHorario).not.toHaveBeenCalled();
  });

  test("não libera bloqueio global legado com estado explícito", async () => {
    repository.buscarBloqueioGlobalLegado.mockResolvedValue({ id: 1 });
    await expect(service.alternarBloqueioHorario({ ...args, bloqueado: false })).rejects.toThrow(/bloqueio legado global/);
    expect(repository.removerBloqueioHorario).not.toHaveBeenCalled();
  });
});
