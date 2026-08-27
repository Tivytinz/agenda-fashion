const mockSyncService = {
  statusIntegracoes: jest.fn(),
  sincronizar: jest.fn(),
  periodoPadrao: jest.fn(),
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

const mockGoogleCampaignLinkService = {
  repararVinculoGoogleProfissionais:
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
  "../src/services/marketingGoogleCampaignLinkService",
  () => mockGoogleCampaignLinkService
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
  const periodo = {
    dataInicio: "2026-07-29",
    dataFim: "2026-08-27",
  };

  beforeEach(() => {
    jest.clearAllMocks();
    process.env = { ...envOriginal };
    worker.pararWorkerCustosMarketing();
    mockSyncService.periodoPadrao
      .mockReturnValue(periodo);
    mockRecoveryRepository
      .recuperarGoogleProfissionaisPorEventos
      .mockResolvedValue({ rowCount: 0 });
    mockCanonicalCleanupService
      .executarLimpezaGoogleProfissionais
      .mockResolvedValue({
        campanhaOficialId: 1,
      });
    mockGoogleCampaignLinkService
      .repararVinculoGoogleProfissionais
      .mockResolvedValue({
        reparado: false,
        jaVinculado: true,
        motivo: "vinculo_original_verificado",
      });
  });

  afterEach(() => {
    worker.pararWorkerCustosMarketing();
    process.env = envOriginal;
  });

  test("recupera atribuição, repara o vínculo original e reconcilia sem ação manual", async () => {
    mockRecoveryRepository
      .recuperarGoogleProfissionaisPorEventos
      .mockResolvedValue({ rowCount: 4 });
    mockGoogleCampaignLinkService
      .repararVinculoGoogleProfissionais
      .mockResolvedValue({
        reparado: true,
        jaVinculado: false,
        campanhaId: 1,
        campanhaExternaId: "555",
        motivo:
          "campanha_original_google_verificada",
      });
    mockSyncService.sincronizar
      .mockResolvedValue({
        status: "sucesso",
        registrosImportados: 3,
        campanhasNaoVinculadas: 0,
      });

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
    expect(
      mockGoogleCampaignLinkService
        .repararVinculoGoogleProfissionais
    ).toHaveBeenCalledWith({
      periodo,
    });
    expect(mockSyncService.sincronizar)
      .toHaveBeenCalledWith({
        provedor: "google_ads",
        payload: {},
        usuarioId: null,
      });
    expect(resultado).toMatchObject({
      campanhaOficialId: 1,
      atribuicoesRecuperadasAntesDaLimpeza: 4,
      reparoVinculoGoogle: {
        reparado: true,
        campanhaExternaId: "555",
      },
      sincronizacaoAposReparo: {
        status: "sucesso",
        campanhasNaoVinculadas: 0,
      },
    });
  });

  test("sincroniza somente provedores configurados e repara o Google antes da sincronização", async () => {
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

    expect(
      mockGoogleCampaignLinkService
        .repararVinculoGoogleProfissionais
    ).toHaveBeenCalledWith({
      periodo,
    });
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

  test("falha no reparo do vínculo não impede a sincronização automática", async () => {
    mockSyncService.statusIntegracoes.mockResolvedValue({
      provedores: [
        {
          provedor: "google_ads",
          configurado: true,
        },
      ],
    });
    mockGoogleCampaignLinkService
      .repararVinculoGoogleProfissionais
      .mockRejectedValue(
        new Error("Google temporariamente indisponível")
      );
    mockSyncService.sincronizar.mockResolvedValue({
      status: "parcial",
      registrosImportados: 0,
      campanhasNaoVinculadas: 1,
    });

    const resultado =
      await worker.executarSincronizacaoAgendada();

    expect(mockSyncService.sincronizar)
      .toHaveBeenCalledTimes(1);
    expect(mockRegistrador.aviso)
      .toHaveBeenCalledWith(
        expect.stringContaining(
          "reparar automaticamente"
        ),
        expect.objectContaining({
          contexto: "sincronizacao_agendada",
        })
      );
    expect(resultado.resultados[0])
      .toMatchObject({
        provedor: "google_ads",
        status: "parcial",
      });
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
