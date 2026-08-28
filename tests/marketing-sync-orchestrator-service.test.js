const mockCostSyncService = {
  normalizarProvedor: jest.fn((value) => value),
  periodoPadrao: jest.fn(() => ({
    dataInicio: "2026-08-01",
    dataFim: "2026-08-28"
  })),
  testarIntegracao: jest.fn(),
  sincronizar: jest.fn()
};
const mockCampaignSyncService = {
  reconcileExternalCampaigns: jest.fn()
};
const mockProviders = {
  listarCampanhas: jest.fn(),
  listarCustos: jest.fn()
};
const mockRepository = {
  buscarVinculosPorProvedor: jest.fn(),
  listarVinculos: jest.fn()
};
const mockLockRepository = {
  executarComLock: jest.fn()
};

jest.mock(
  "../src/services/marketingCostSyncService",
  () => mockCostSyncService
);
jest.mock(
  "../src/services/marketingCampaignSyncService",
  () => mockCampaignSyncService
);
jest.mock(
  "../src/services/marketingCostProviders",
  () => mockProviders
);
jest.mock(
  "../src/repositories/marketingCostSyncRepository",
  () => mockRepository
);
jest.mock(
  "../src/repositories/marketingCampaignSyncLockRepository",
  () => mockLockRepository
);

const service = require(
  "../src/services/marketingSyncOrchestratorService"
);

describe("marketingSyncOrchestratorService", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockCostSyncService.testarIntegracao.mockResolvedValue({
      conectado: true,
      moeda: "BRL"
    });
    mockProviders.listarCampanhas.mockResolvedValue([]);
    mockProviders.listarCustos.mockResolvedValue([]);
    mockRepository.buscarVinculosPorProvedor.mockResolvedValue([]);
    mockCampaignSyncService.reconcileExternalCampaigns.mockResolvedValue({
      links: [],
      importedCampaigns: 0,
      automaticLinks: 0,
      unresolved: 0
    });
    mockLockRepository.executarComLock.mockImplementation(
      async (_provider, callback) => ({
        executado: true,
        resultado: await callback()
      })
    );
  });

  test("valida integração antes de consultar e importar campanhas", async () => {
    await service.reconcileProviderCampaigns({
      provedor: "google_ads",
      usuarioId: 9,
      payload: {}
    });

    expect(mockCostSyncService.testarIntegracao)
      .toHaveBeenCalledWith({ provedor: "google_ads" });
    expect(mockProviders.listarCampanhas).toHaveBeenCalledWith("google_ads");
    expect(mockProviders.listarCustos).toHaveBeenCalledWith(
      "google_ads",
      {
        dataInicio: "2026-08-01",
        dataFim: "2026-08-28"
      }
    );
    expect(mockCampaignSyncService.reconcileExternalCampaigns)
      .toHaveBeenCalledTimes(1);
  });

  test("não inicia segunda reconciliação concorrente", async () => {
    mockLockRepository.executarComLock.mockResolvedValue({
      executado: false,
      resultado: null
    });

    await expect(service.reconcileProviderCampaigns({
      provedor: "meta_ads",
      payload: {}
    })).rejects.toMatchObject({
      statusCode: 409
    });

    expect(mockCostSyncService.testarIntegracao).not.toHaveBeenCalled();
    expect(mockProviders.listarCampanhas).not.toHaveBeenCalled();
  });
});
