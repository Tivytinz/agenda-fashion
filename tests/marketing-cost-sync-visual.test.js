const mockCampaignRepository = {
  buscarPorId: jest.fn()
};

const mockRepository = {
  listarVinculos: jest.fn(),
  listarUltimasSincronizacoes: jest.fn(),
  salvarVinculo: jest.fn(),
  buscarVinculosPorProvedor: jest.fn(),
  salvarGastoAutomatico: jest.fn(),
  iniciarSincronizacao: jest.fn(),
  finalizarSincronizacao: jest.fn()
};

const mockProviders = {
  status: jest.fn(),
  listarCustos: jest.fn(),
  listarCampanhas: jest.fn(),
  buscarCampanha: jest.fn(),
  testarConexao: jest.fn()
};

jest.mock(
  "../src/repositories/adminCampaignRepository",
  () => mockCampaignRepository
);

jest.mock(
  "../src/repositories/marketingCostSyncRepository",
  () => mockRepository
);

jest.mock(
  "../src/services/marketingCostProviderRegistry",
  () => mockProviders
);

const service = require("../src/services/marketingCostSyncService");

describe("marketingCostSyncService Pinterest e TikTok", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRepository.iniciarSincronizacao.mockResolvedValue({ id: 20 });
    mockRepository.finalizarSincronizacao.mockResolvedValue();
    mockRepository.salvarGastoAutomatico.mockResolvedValue({ id: 1 });
    mockRepository.salvarVinculo.mockResolvedValue({ id: 30 });
    mockProviders.status.mockReturnValue([
      {
        provedor: "pinterest_ads",
        configurado: true,
        contaExternaId: "549768356618"
      },
      {
        provedor: "tiktok_ads",
        configurado: true,
        contaExternaId: "7488990011223344556"
      }
    ]);
  });

  test("aceita os dois novos provedores", () => {
    expect(service.normalizarProvedor("PINTEREST_ADS")).toBe("pinterest_ads");
    expect(service.normalizarProvedor("tiktok_ads")).toBe("tiktok_ads");
  });

  test("impede cruzar campanha Pinterest do AF com TikTok Ads", async () => {
    mockCampaignRepository.buscarPorId.mockResolvedValue({
      id: 11,
      nome: "Pinterest Agosto",
      canal: "pinterest"
    });

    await expect(
      service.vincularCampanha({
        payload: {
          campanhaId: 11,
          provedor: "tiktok_ads",
          campanhaExternaId: "2001"
        }
      })
    ).rejects.toThrow("canal pinterest");

    expect(mockProviders.buscarCampanha).not.toHaveBeenCalled();
    expect(mockRepository.salvarVinculo).not.toHaveBeenCalled();
  });

  test("revalida campanha Pinterest no backend antes de salvar vínculo", async () => {
    mockCampaignRepository.buscarPorId.mockResolvedValue({
      id: 11,
      nome: "Pinterest Agosto",
      canal: "pinterest"
    });
    mockProviders.buscarCampanha.mockResolvedValue({
      contaExternaId: "549768356618",
      campanhaExternaId: "101",
      campanhaExternaNome: "Pinterest Profissionais",
      status: "ACTIVE",
      tipo: "TRAFFIC"
    });

    await service.vincularCampanha({
      payload: {
        campanhaId: 11,
        provedor: "pinterest_ads",
        contaExternaId: "549768356618",
        campanhaExternaId: "101",
        campanhaExternaNome: "Nome adulterado"
      }
    });

    expect(mockProviders.buscarCampanha).toHaveBeenCalledWith(
      "pinterest_ads",
      "101"
    );
    expect(mockRepository.salvarVinculo).toHaveBeenCalledWith({
      campanhaId: 11,
      provedor: "pinterest_ads",
      contaExternaId: "549768356618",
      campanhaExternaId: "101",
      campanhaExternaNome: "Pinterest Profissionais"
    });
  });

  test("sincroniza custo TikTok somente quando existe vínculo explícito", async () => {
    mockRepository.buscarVinculosPorProvedor.mockResolvedValue([
      {
        campanha_id: 12,
        conta_externa_id: "7488990011223344556",
        campanha_externa_id: "2001"
      }
    ]);
    mockProviders.listarCustos.mockResolvedValue([
      {
        contaExternaId: "7488990011223344556",
        campanhaExternaId: "2001",
        dataGasto: "2026-08-10",
        valorCentavos: 1234
      },
      {
        contaExternaId: "7488990011223344556",
        campanhaExternaId: "9999",
        dataGasto: "2026-08-10",
        valorCentavos: 500
      }
    ]);

    const result = await service.sincronizar({
      provedor: "tiktok_ads",
      payload: {
        dataInicio: "2026-08-01",
        dataFim: "2026-08-10"
      },
      usuarioId: 3
    });

    expect(mockRepository.salvarGastoAutomatico).toHaveBeenCalledTimes(1);
    expect(mockRepository.salvarGastoAutomatico).toHaveBeenCalledWith({
      campanhaId: 12,
      dataGasto: "2026-08-10",
      valorCentavos: 1234,
      provedor: "tiktok_ads"
    });
    expect(result).toMatchObject({
      status: "parcial",
      registrosImportados: 1,
      campanhasNaoVinculadas: 1
    });
  });
});
