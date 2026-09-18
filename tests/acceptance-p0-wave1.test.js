jest.mock("../src/db/db", () => ({
  executarTransacao: jest.fn(),
}));

jest.mock("../src/repositories/agendamentoLifecycleRepository", () => ({}));

jest.mock("../src/utils/fusoHorario", () => ({
  obterDataHoraNoFuso: jest.fn(),
}));

jest.mock("../src/repositories/agendaConfiguracaoRepository", () => ({
  buscarVinculoAtivoPorPapel: jest.fn(),
  buscarConfiguracao: jest.fn(),
  criarConfiguracao: jest.fn(),
  atualizarConfiguracao: jest.fn(),
  marcarConfigurada: jest.fn(),
  salvarHorario: jest.fn(),
  executarTransacao: jest.fn(),
}));

const {
  obterDataHoraNoFuso,
} = require("../src/utils/fusoHorario");
const lifecycleService = require(
  "../src/services/agendamentoLifecycleService"
);
const cancelamentoService = require(
  "../src/services/agendamentoCancelamentoService"
);
const agendaConfiguracaoRepository = require(
  "../src/repositories/agendaConfiguracaoRepository"
);
const agendaConfiguracaoService = require(
  "../src/services/agendaConfiguracaoService"
);

function horariosValidos() {
  return Array.from({ length: 7 }, (_, diaSemana) => ({
    diaSemana,
    trabalha: false,
    horaInicio: null,
    horaFim: null,
    intervaloInicio: null,
    intervaloFim: null,
  }));
}

describe("P0 baseline v1.16 - cutoff e no-show", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("CA-AG-13/14: falta é rejeitada em +14 min e aceita em +15 min", () => {
    const agendamento = {
      data: "2026-09-18",
      horario: "10:00",
      fuso_horario: "America/Sao_Paulo",
      duracao_minutos: 60,
    };

    obterDataHoraNoFuso.mockReturnValue({
      data: "2026-09-18",
      hora: "10:14",
    });

    expect(() =>
      lifecycleService.validarMomentoAtendimento(
        agendamento,
        "falta"
      )
    ).toThrow(/15 minutos/i);

    obterDataHoraNoFuso.mockReturnValue({
      data: "2026-09-18",
      hora: "10:15",
    });

    expect(() =>
      lifecycleService.validarMomentoAtendimento(
        agendamento,
        "falta"
      )
    ).not.toThrow();
  });

  test("CA-AG-06/10: fallback de cancelamento é 2 horas", () => {
    expect(
      cancelamentoService.ANTECEDENCIA_CANCELAMENTO_PADRAO
    ).toBe(2);

    expect(
      cancelamentoService.normalizarAntecedenciaCancelamento(
        undefined
      )
    ).toBe(2);

    expect(
      cancelamentoService.normalizarAntecedenciaCancelamento(
        -1
      )
    ).toBe(2);
  });

  test("RF57: configuração rejeita antecedência acima de 168 horas", async () => {
    await expect(
      agendaConfiguracaoService.salvarMinhaConfiguracao({
        usuarioId: 10,
        contexto: "dono",
        duracaoPadrao: 60,
        intervaloMinutos: 0,
        antecedenciaAgendamento: 0,
        antecedenciaCancelamento: 169,
        horarios: horariosValidos(),
      })
    ).rejects.toMatchObject({
      statusCode: 400,
      message: expect.stringMatching(/0 e 168/i),
    });

    expect(
      agendaConfiguracaoRepository.executarTransacao
    ).not.toHaveBeenCalled();
  });

  test("RF57: limite de 168 horas é aceito e persistido", async () => {
    const client = { query: jest.fn() };

    agendaConfiguracaoRepository.executarTransacao.mockImplementation(
      async (callback) => callback(client)
    );
    agendaConfiguracaoRepository.buscarVinculoAtivoPorPapel.mockResolvedValue({
      negocio_id: 7,
      papel: "dono",
    });
    agendaConfiguracaoRepository.buscarConfiguracao.mockResolvedValue(null);
    agendaConfiguracaoRepository.criarConfiguracao.mockResolvedValue({
      id: 1,
      antecedencia_cancelamento: 168,
    });
    agendaConfiguracaoRepository.salvarHorario.mockImplementation(
      async (dados) => ({
        id: Number(dados.diaSemana) + 1,
        dia_semana: dados.diaSemana,
        trabalha: false,
      })
    );
    agendaConfiguracaoRepository.marcarConfigurada.mockResolvedValue({
      id: 1,
      antecedencia_cancelamento: 168,
      origem_horarios: "personalizado",
    });

    await agendaConfiguracaoService.salvarMinhaConfiguracao({
      usuarioId: 10,
      contexto: "dono",
      duracaoPadrao: 60,
      intervaloMinutos: 0,
      antecedenciaAgendamento: 0,
      antecedenciaCancelamento: 168,
      horarios: horariosValidos(),
    });

    expect(
      agendaConfiguracaoRepository.criarConfiguracao
    ).toHaveBeenCalledWith(
      expect.objectContaining({
        antecedenciaCancelamento: 168,
      }),
      client
    );
  });
});
