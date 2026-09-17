jest.mock(
  "../src/repositories/agendaPublicaRepository",
  () => ({
    listarAgendamentosOcupados: jest.fn(),
    listarBloqueios: jest.fn(),
  })
);

jest.mock(
  "../src/repositories/agendaConfiguracaoRepository",
  () => ({
    buscarConfiguracao: jest.fn(),
    listarHorarios: jest.fn(),
  })
);

const agendaPublicaRepository = require(
  "../src/repositories/agendaPublicaRepository"
);
const agendaConfiguracaoRepository = require(
  "../src/repositories/agendaConfiguracaoRepository"
);
const agendaDisponibilidadeService = require(
  "../src/services/agendaDisponibilidadeService"
);

describe("disponibilidade no fuso do negócio", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(
      new Date("2026-09-15T02:30:00.000Z")
    );

    jest.clearAllMocks();

    agendaConfiguracaoRepository
      .buscarConfiguracao
      .mockResolvedValue({
        configurado_em: new Date(),
        duracao_padrao: 60,
        intervalo_minutos: 0,
        antecedencia_agendamento: 0,
      });

    agendaConfiguracaoRepository
      .listarHorarios
      .mockResolvedValue([]);

    agendaPublicaRepository
      .listarAgendamentosOcupados
      .mockResolvedValue([]);

    agendaPublicaRepository
      .listarBloqueios
      .mockResolvedValue([]);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  test("começa no dia local do negócio, não no dia de São Paulo", async () => {
    const saoPaulo =
      await agendaDisponibilidadeService
        .buscarDisponibilidade({
          profissionalId: 9,
          negocioId: 11,
          duracaoServico: 60,
          quantidadeDias: 1,
          fusoHorario: "America/Sao_Paulo",
        });

    const noronha =
      await agendaDisponibilidadeService
        .buscarDisponibilidade({
          profissionalId: 9,
          negocioId: 11,
          duracaoServico: 60,
          quantidadeDias: 1,
          fusoHorario: "America/Noronha",
        });

    expect(saoPaulo[0].data)
      .toBe("2026-09-14");

    expect(noronha[0].data)
      .toBe("2026-09-15");
  });

  test("filtra horários passados conforme o relógio local do negócio", async () => {
    const manaus =
      await agendaDisponibilidadeService
        .buscarDisponibilidade({
          profissionalId: 9,
          negocioId: 11,
          duracaoServico: 60,
          quantidadeDias: 1,
          fusoHorario: "America/Manaus",
        });

    expect(manaus[0])
      .toMatchObject({
        data: "2026-09-14",
      });

    expect(manaus[0].horarios)
      .not.toContain("08:00");
  });
});
