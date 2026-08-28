const mockRepository = {
  garantirCampanhaImportadaComVinculo: jest.fn()
};

jest.mock(
  "../src/repositories/marketingCostSyncRepository",
  () => mockRepository
);

const service = require(
  "../src/services/marketingCampaignSyncService"
);

describe("marketingCampaignSyncService", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("cria identidade estável usando o ID real da campanha externa", () => {
    expect(
      service.desiredInternalCampaign({
        provider: "google_ads",
        externalCampaign: {
          contaExternaId: "677-020-7927",
          campanhaExternaId: "123-456",
          campanhaExternaNome: "Profissionais Goiás"
        },
        userId: 9,
        active: true
      })
    ).toMatchObject({
      nome: "Profissionais Goiás",
      canal: "google",
      objetivo: "indefinido",
      utmSource: "google",
      utmMedium: "cpc",
      utmCampaign: "123456",
      destinoPath: "/",
      ativo: true,
      criadoPorUsuarioId: 9,
      provedor: "google_ads",
      contaExternaId: "6770207927",
      campanhaExternaId: "123456"
    });
  });

  test("importa campanhas operacionais e campanhas pausadas que tiveram gasto", async () => {
    mockRepository.garantirCampanhaImportadaComVinculo
      .mockImplementation(async (payload) => ({
        campanhaCriada: true,
        vinculoCriado: true,
        campanha: {
          id: payload.campanhaExternaId === "123" ? 10 : 11,
          objetivo: "indefinido",
          ativo: payload.ativo,
          canal: payload.canal
        },
        vinculo: {
          campanha_id: payload.campanhaExternaId === "123" ? 10 : 11,
          provedor: payload.provedor,
          conta_externa_id: payload.contaExternaId,
          campanha_externa_id: payload.campanhaExternaId,
          campanha_externa_nome: payload.campanhaExternaNome
        }
      }));

    const result = await service.reconcileExternalCampaigns({
      provider: "google_ads",
      externalCampaigns: [
        {
          contaExternaId: "6770207927",
          campanhaExternaId: "123",
          campanhaExternaNome: "Ativa",
          status: "ENABLED"
        },
        {
          contaExternaId: "6770207927",
          campanhaExternaId: "999",
          campanhaExternaNome: "Pausada com histórico",
          status: "PAUSED"
        },
        {
          contaExternaId: "6770207927",
          campanhaExternaId: "888",
          campanhaExternaNome: "Pausada sem gasto",
          status: "PAUSED"
        }
      ],
      costs: [
        {
          contaExternaId: "6770207927",
          campanhaExternaId: "999",
          dataGasto: "2026-08-10",
          valorCentavos: 900
        }
      ],
      links: [],
      userId: 3,
      isOperational: (item) =>
        !["PAUSED", "REMOVED", "DELETED", "ARCHIVED"]
          .includes(String(item.status || "").toUpperCase())
    });

    expect(
      mockRepository.garantirCampanhaImportadaComVinculo
    ).toHaveBeenCalledTimes(2);
    expect(result).toMatchObject({
      importedCampaigns: 2,
      automaticLinks: 2,
      unresolved: 0
    });
    expect(result.links).toHaveLength(2);

    expect(
      mockRepository.garantirCampanhaImportadaComVinculo
    ).toHaveBeenCalledWith(
      expect.objectContaining({
        campanhaExternaId: "999",
        ativo: false
      })
    );
  });

  test("não recria campanha que já está vinculada", async () => {
    const result = await service.reconcileExternalCampaigns({
      provider: "meta_ads",
      externalCampaigns: [
        {
          contaExternaId: "1122334455",
          campanhaExternaId: "901",
          campanhaExternaNome: "Meta profissionais",
          status: "ACTIVE"
        }
      ],
      costs: [],
      links: [
        {
          campanha_id: 7,
          provedor: "meta_ads",
          conta_externa_id: "1122334455",
          campanha_externa_id: "901"
        }
      ],
      isOperational: () => true
    });

    expect(
      mockRepository.garantirCampanhaImportadaComVinculo
    ).not.toHaveBeenCalled();
    expect(result).toMatchObject({
      importedCampaigns: 0,
      automaticLinks: 0,
      unresolved: 0
    });
  });

  test("mantém conflito como pendência em vez de inventar vínculo", async () => {
    mockRepository.garantirCampanhaImportadaComVinculo
      .mockResolvedValue({
        conflito: true,
        vinculo: null
      });

    const result = await service.reconcileExternalCampaigns({
      provider: "google_ads",
      externalCampaigns: [
        {
          contaExternaId: "6770207927",
          campanhaExternaId: "123",
          campanhaExternaNome: "Campanha ambígua",
          status: "ENABLED"
        }
      ],
      costs: [],
      links: [],
      isOperational: () => true
    });

    expect(result.unresolved).toBe(1);
    expect(result.links).toHaveLength(0);
  });
});
