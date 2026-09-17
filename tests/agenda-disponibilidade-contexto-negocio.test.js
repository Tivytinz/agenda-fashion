jest.mock("../src/repositories/agendaConfiguracaoRepository", () => ({
  buscarVinculoAtivoPorPapel: jest.fn(),
  buscarConfiguracao: jest.fn(),
  garantirDisponibilidadePadrao: jest.fn(),
  listarHorarios: jest.fn(),
  executarTransacao: jest.fn(),
}));

jest.mock("../src/repositories/agendaPublicaRepository", () => ({
  listarAgendamentosOcupados: jest.fn(),
  listarBloqueios: jest.fn(),
}));

jest.mock("../src/utils/fusoHorario", () => ({
  resolverFusoHorario: jest.fn((fuso) => fuso || "America/Sao_Paulo"),
  obterDataHoraNoFuso: jest.fn(() => ({
    data: "2026-09-21",
    hora: "07:00",
  })),
}));

const agendaConfiguracaoRepository = require(
  "../src/repositories/agendaConfiguracaoRepository"
);
const agendaPublicaRepository = require(
  "../src/repositories/agendaPublicaRepository"
);
const agendaConfiguracaoService = require(
  "../src/services/agendaConfiguracaoService"
);
const agendaDisponibilidadeService = require(
  "../src/services/agendaDisponibilidadeService"
);

describe("disponibilidade contextual por negócio", () => {
  beforeEach(() => {
    jest.clearAllMocks();

    agendaConfiguracaoRepository.executarTransacao
      .mockImplementation((callback) => callback({ query: jest.fn() }));

    agendaConfiguracaoRepository.garantirDisponibilidadePadrao
      .mockResolvedValue({
        configuracao: {
          profissional_id: 7,
          negocio_id: 20,
          configurado_em: "2026-09-21T10:00:00.000Z",
        },
        horarios: [],
      });

    agendaConfiguracaoRepository.buscarConfiguracao
      .mockResolvedValue({
        profissional_id: 7,
        negocio_id: 20,
        configurado_em: "2026-09-21T10:00:00.000Z",
        duracao_padrao: 60,
        intervalo_minutos: 0,
        antecedencia_agendamento: 0,
      });

    agendaConfiguracaoRepository.listarHorarios
      .mockResolvedValue([]);

    agendaPublicaRepository.listarAgendamentosOcupados
      .mockResolvedValue([]);

    agendaPublicaRepository.listarBloqueios
      .mockResolvedValue([]);
  });

  test("resolve o negócio pelo papel persistido e não por id enviado pelo frontend", async () => {
    agendaConfiguracaoRepository.buscarVinculoAtivoPorPapel
      .mockResolvedValue({
        id: 7,
        negocio_id: 20,
        papel: "profissional",
      });

    await agendaConfiguracaoService.buscarMinhaConfiguracao({
      usuarioId: 7,
      contexto: "profissional",
    });

    expect(
      agendaConfiguracaoRepository.buscarVinculoAtivoPorPapel
    ).toHaveBeenCalledWith(
      7,
      "profissional",
      expect.any(Object)
    );

    expect(
      agendaConfiguracaoRepository.garantirDisponibilidadePadrao
    ).toHaveBeenCalledWith(
      {
        profissionalId: 7,
        negocioId: 20,
      },
      expect.any(Object)
    );
  });

  test("não cai no vínculo de dona quando o contexto profissional não existe", async () => {
    agendaConfiguracaoRepository.buscarVinculoAtivoPorPapel
      .mockResolvedValue(null);

    await expect(
      agendaConfiguracaoService.buscarMinhaConfiguracao({
        usuarioId: 7,
        contexto: "profissional",
      })
    ).rejects.toMatchObject({
      statusCode: 403,
    });

    expect(
      agendaConfiguracaoRepository.buscarVinculoAtivoPorPapel
    ).toHaveBeenCalledTimes(1);
  });

  test("lê configuração recorrente no negócio e mantém ocupação global da pessoa", async () => {
    await agendaDisponibilidadeService.buscarDisponibilidade({
      profissionalId: 7,
      negocioId: 20,
      duracaoServico: 60,
      quantidadeDias: 1,
      fusoHorario: "America/Sao_Paulo",
    });

    expect(
      agendaConfiguracaoRepository.buscarConfiguracao
    ).toHaveBeenCalledWith(7, 20);

    expect(
      agendaConfiguracaoRepository.listarHorarios
    ).toHaveBeenCalledWith(7, 20);

    expect(
      agendaPublicaRepository.listarAgendamentosOcupados
    ).toHaveBeenCalledWith(
      7,
      "2026-09-21",
      "2026-09-21"
    );

    expect(
      agendaPublicaRepository.listarBloqueios
    ).toHaveBeenCalledWith(
      7,
      "2026-09-21",
      "2026-09-21"
    );
  });
});
