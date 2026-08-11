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
  listarCustos: jest.fn()
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
  "../src/services/marketingCostProviders",
  () => mockProviders
);

const service = require(
  "../src/services/marketingCostSyncService"
);

describe("marketingCostSyncService", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRepository.iniciarSincronizacao.mockResolvedValue({ id: 10 });
    mockRepository.finalizarSincronizacao.mockResolvedValue();
    mockRepository.salvarGastoAutomatico.mockResolvedValue({ id: 1 });
  });

  test("sincroniza apenas campanhas explicitamente vinculadas", async () => {
    mockRepository.buscarVinculosPorProvedor.mockResolvedValue([
      {
        campanha_id: 7,
        conta_externa_id: "6770207927",
        campanha_externa_id: "123"
      }
    ]);
    mockProviders.listarCustos.mockResolvedValue([
      {
        contaExternaId: "6770207927",
        campanhaExternaId: "123",
        dataGasto: "2026-08-10",
        valorCentavos: 2500
      },
      {
        contaExternaId: "6770207927",
        campanhaExternaId: "999",
        dataGasto: "2026-08-10",
        valorCentavos: 900
      }
    ]);

    const result = await service.sincronizar({
      provedor: "google_ads",
      payload: {
        dataInicio: "2026-08-01",
        dataFim: "2026-08-10"
      },
      usuarioId: 3
    });

    expect(mockRepository.salvarGastoAutomatico).toHaveBeenCalledTimes(1);
    expect(mockRepository.salvarGastoAutomatico).toHaveBeenCalledWith({
      campanhaId: 7,
      dataGasto: "2026-08-10",
      valorCentavos: 2500,
      provedor: "google_ads"
    });
    expect(result).toMatchObject({
      status: "parcial",
      registrosImportados: 1,
      campanhasNaoVinculadas: 1
    });
    expect(mockRepository.finalizarSincronizacao).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 10,
        status: "parcial",
        importados: 1,
        naoVinculadas: 1
      })
    );
  });

  test("registra erro de sincronização sem engolir a falha", async () => {
    mockRepository.buscarVinculosPorProvedor.mockResolvedValue([]);
    mockProviders.listarCustos.mockRejectedValue(
      Object.assign(new Error("Credencial recusada"), { statusCode: 502 })
    );

    await expect(service.sincronizar({
      provedor: "meta_ads",
      payload: {
        dataInicio: "2026-08-01",
        dataFim: "2026-08-10"
      }
    })).rejects.toThrow("Credencial recusada");

    expect(mockRepository.finalizarSincronizacao).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 10,
        status: "erro",
        erroCodigo: "http_502"
      })
    );
  });

  test("recusa período maior que 90 dias", () => {
    expect(() => service.periodoPadrao({
      dataInicio: "2026-01-01",
      dataFim: "2026-08-10"
    })).toThrow("até 90 dias");
  });

  test("salva vínculo somente para campanha existente", async () => {
    mockCampaignRepository.buscarPorId.mockResolvedValue({ id: 5, nome: "Teste" });
    mockRepository.salvarVinculo.mockResolvedValue({ id: 9, campanha_id: 5 });

    const result = await service.vincularCampanha({
      payload: {
        campanhaId: 5,
        provedor: "google_ads",
        contaExternaId: "677-020-7927",
        campanhaExternaId: "555",
        campanhaExternaNome: "Aquisição"
      }
    });

    expect(mockRepository.salvarVinculo).toHaveBeenCalledWith({
      campanhaId: 5,
      provedor: "google_ads",
      contaExternaId: "677-020-7927",
      campanhaExternaId: "555",
      campanhaExternaNome: "Aquisição"
    });
    expect(result.vinculo.id).toBe(9);
  });
});
