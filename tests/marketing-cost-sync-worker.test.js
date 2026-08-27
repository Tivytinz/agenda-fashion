const mockSyncService = {
  statusIntegracoes: jest.fn(),
  sincronizar: jest.fn()
};

const mockCanonicalCleanupService = {
  CAMPANHA_OFICIAL:
    "google_ads_profissionais",
  CAMPANHAS_LEGADAS: [
    "aquisicao_profissionais",
    "search_aquisicao_profissionais",
    "profissionais_google_ads",
  ],
  executarLimpezaGoogleProfissionais:
    jest.fn(),
};

const mockRecoveryRepository = {
  recuperarGoogleProfissionaisPorEventos:
    jest.fn(),
};

const mockRegistrador = {
  informacao: jest.fn(),
  aviso: jest.fn(),
  erro: jest.fn()
};

jest.mock(
  "../src/services/marketingCostSyncService",
  () => mockSyncService
);

jest.mock(
  "../src/services/marketingCanonicalCleanupService",
  () => mockCanonicalCleanupService
);

jest.mock(
  "../src/repositories/marketingAttributionRecoveryRepository",
  () => mockRecoveryRepository
);

jest.mock(
  "../src/utils/registrador",
  () => mockRegistrador
);

const worker = require(
  "../src/services/marketingCostSyncWorker"
);

describe("marketingCostSyncWorker", () => {
  const envOriginal = process.env;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env = { ...envOriginal };
    worker.pararWorkerCustosMarketing();
    mockRecoveryRepository
      .recuperarGoogleProfissionaisPorEventos
      .mockResolvedValue({ rowCount: 0 });
    mockCanonicalCleanupService
      .executarLimpezaGoogleProfissionais
      .mockResolvedValue({
        campanhaOficialId: 1,
      });
  });

  afterEach(() => {
    worker.pararWorkerCustosMarketing();
    process.env = envOriginal;
  });

  test("recupera atribuição histórica antes da limpeza canônica", async () => {
    mockRecoveryRepository
      .recuperarGoogleProfissionaisPorEventos
      .mockResolvedValue({ rowCount: 4 });

    const resultado =
      await worker.executarLimpezaCanonica();

    expect(
      mockRecoveryRepository
        .recuperarGoogleProfissionaisPorEventos
    ).toHaveBeenCalledWith({
      campanhaOficial:
        "google_ads_profissionais",
      campanhasAceitas: [
        "google_ads_profissionais",
        "aquisicao_profissionais",
        "search_aquisicao_profissionais",
        "profissionais_google_ads",
      ],
    });
    expect(
      mockCanonicalCleanupService
        .executarLimpezaGoogleProfissionais
    ).toHaveBeenCalledTimes(1);
    expect(resultado).toMatchObject({
      campanhaOficialId: 1,
      atribuicoesRecuperadasAntesDaLimpeza: 4,
    });
  });

  test("sincroniza somente provedores configurados", async () => {
    mockSyncService.statusIntegracoes.mockResolvedValue({
      provedores: [
        {
          provedor: "google_ads",
          configurado: true
        },
        {
          provedor: "meta_ads",
          configurado: false
        }
      ]
    });

    mockSyncService.sincronizar.mockResolvedValue({
      status: "sucesso",
      registrosImportados: 4,
      campanhasNaoVinculadas: 0
    });

    const resultado =
      await worker.executarSincronizacaoAgendada();

    expect(mockSyncService.sincronizar)
      .toHaveBeenCalledTimes(1);
    expect(mockSyncService.sincronizar)
      .toHaveBeenCalledWith({
        provedor: "google_ads",
        payload: {},
        usuarioId: null
      });
    expect(resultado.resultados)
      .toEqual([
        expect.objectContaining({
          provedor: "google_ads",
          status: "sucesso",
          registrosImportados: 4
        })
      ]);
  });

  test("falha de um provedor não interrompe os demais", async () => {
    mockSyncService.statusIntegracoes.mockResolvedValue({
      provedores: [
        {
          provedor: "google_ads",
          configurado: true
        },
        {
          provedor: "meta_ads",
          configurado: true
        }
      ]
    });

    mockSyncService.sincronizar
      .mockRejectedValueOnce(
        new Error("Google indisponível")
      )
      .mockResolvedValueOnce({
        status: "sucesso",
        registrosImportados: 2,
        campanhasNaoVinculadas: 0
      });

    const resultado =
      await worker.executarSincronizacaoAgendada();

    expect(mockSyncService.sincronizar)
      .toHaveBeenCalledTimes(2);
    expect(mockRegistrador.aviso)
      .toHaveBeenCalledWith(
        expect.stringContaining(
          "sincronização agendada"
        ),
        expect.objectContaining({
          provedor: "google_ads"
        })
      );
    expect(resultado.resultados)
      .toEqual([
        expect.objectContaining({
          provedor: "google_ads",
          status: "erro"
        }),
        expect.objectContaining({
          provedor: "meta_ads",
          status: "sucesso"
        })
      ]);
  });

  test("worker permanece desligado sem flag explícita", () => {
    delete process.env.MARKETING_COST_SYNC_SCHEDULE_ENABLED;

    expect(
      worker.iniciarWorkerCustosMarketing()
    ).toBe(false);
  });

  test("intervalo é limitado entre uma e vinte e quatro horas", () => {
    process.env.MARKETING_COST_SYNC_INTERVAL_HOURS = "0.1";
    expect(worker.intervaloHoras()).toBe(1);

    process.env.MARKETING_COST_SYNC_INTERVAL_HOURS = "200";
    expect(worker.intervaloHoras()).toBe(24);

    process.env.MARKETING_COST_SYNC_INTERVAL_HOURS = "6";
    expect(worker.intervaloHoras()).toBe(6);
  });
});
