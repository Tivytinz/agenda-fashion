const mockAdminCampaignRepository = {
  buscarPorIdentidade: jest.fn(),
  buscarPorId: jest.fn(),
};

const mockMarketingCostSyncRepository = {
  buscarVinculosPorProvedor: jest.fn(),
  salvarVinculo: jest.fn(),
};

const mockProviders = {
  status: jest.fn(),
  listarCampanhas: jest.fn(),
  listarCustos: jest.fn(),
  buscarCampanha: jest.fn(),
};

jest.mock(
  "../src/repositories/adminCampaignRepository",
  () => mockAdminCampaignRepository
);

jest.mock(
  "../src/repositories/marketingCostSyncRepository",
  () => mockMarketingCostSyncRepository
);

jest.mock(
  "../src/services/marketingCostProviders",
  () => mockProviders
);

jest.mock(
  "../src/services/marketingCanonicalCleanupService",
  () => ({
    CAMPANHA_OFICIAL: "google_ads_profissionais",
  })
);

const service = require(
  "../src/services/marketingGoogleCampaignLinkService"
);

const periodo = {
  dataInicio: "2026-07-29",
  dataFim: "2026-08-27",
};

function prepararCampanhaInterna() {
  mockProviders.status.mockReturnValue([
    {
      provedor: "google_ads",
      configurado: true,
      contaExternaId: "6770207927",
    },
  ]);
  mockAdminCampaignRepository
    .buscarPorIdentidade
    .mockResolvedValue({ id: 5 });
  mockAdminCampaignRepository
    .buscarPorId
    .mockResolvedValue({
      id: 5,
      canal: "google",
      objetivo: "profissional",
      ativo: true,
    });
  mockMarketingCostSyncRepository
    .buscarVinculosPorProvedor
    .mockResolvedValue([]);
}

describe(
  "marketingGoogleCampaignLinkService",
  () => {
    beforeEach(() => {
      jest.clearAllMocks();
      prepararCampanhaInterna();
      mockMarketingCostSyncRepository
        .salvarVinculo
        .mockResolvedValue({ id: 1 });
    });

    test(
      "reconstrói o vínculo com o campaign.id original devolvido pelo Google Ads",
      async () => {
        const original = {
          contaExternaId: "6770207927",
          campanhaExternaId: "555",
          campanhaExternaNome:
            "Pesquisa | Search | Aquisição Profissionais | AF",
          status: "PAUSED",
          tipo: "SEARCH",
        };

        mockProviders.listarCampanhas
          .mockResolvedValue([original]);
        mockProviders.listarCustos
          .mockResolvedValue([
            {
              contaExternaId: "6770207927",
              campanhaExternaId: "555",
              campanhaExternaNome:
                original.campanhaExternaNome,
              dataGasto: "2026-08-20",
              valorCentavos: 7516,
            },
          ]);
        mockProviders.buscarCampanha
          .mockResolvedValue(original);

        const resultado =
          await service
            .repararVinculoGoogleProfissionais({
              periodo,
            });

        expect(
          mockProviders.buscarCampanha
        ).toHaveBeenCalledWith(
          "google_ads",
          "555"
        );
        expect(
          mockMarketingCostSyncRepository
            .salvarVinculo
        ).toHaveBeenCalledWith({
          campanhaId: 5,
          provedor: "google_ads",
          contaExternaId: "6770207927",
          campanhaExternaId: "555",
          campanhaExternaNome:
            "Pesquisa | Search | Aquisição Profissionais | AF",
        });
        expect(resultado).toMatchObject({
          reparado: true,
          campanhaId: 5,
          campanhaExternaId: "555",
          motivo:
            "campanha_original_google_verificada",
        });
      }
    );

    test(
      "não escolhe campanha quando duas originais compatíveis tiveram gasto no período",
      async () => {
        mockProviders.listarCampanhas
          .mockResolvedValue([
            {
              contaExternaId: "6770207927",
              campanhaExternaId: "555",
              campanhaExternaNome:
                "Search | Aquisição Profissionais | AF",
              tipo: "SEARCH",
            },
            {
              contaExternaId: "6770207927",
              campanhaExternaId: "777",
              campanhaExternaNome:
                "Search | Aquisição Profissionais | AF 2",
              tipo: "SEARCH",
            },
          ]);
        mockProviders.listarCustos
          .mockResolvedValue([
            {
              contaExternaId: "6770207927",
              campanhaExternaId: "555",
              dataGasto: "2026-08-20",
              valorCentavos: 5000,
            },
            {
              contaExternaId: "6770207927",
              campanhaExternaId: "777",
              dataGasto: "2026-08-21",
              valorCentavos: 4000,
            },
          ]);

        const resultado =
          await service
            .repararVinculoGoogleProfissionais({
              periodo,
            });

        expect(resultado).toMatchObject({
          reparado: false,
          motivo: "campanha_original_ambigua",
          candidatas: 2,
        });
        expect(
          mockMarketingCostSyncRepository
            .salvarVinculo
        ).not.toHaveBeenCalled();
        expect(
          mockProviders.buscarCampanha
        ).not.toHaveBeenCalled();
      }
    );

    test(
      "não cria vínculo sem gasto externo que prove qual campanha participou do período",
      async () => {
        mockProviders.listarCampanhas
          .mockResolvedValue([
            {
              contaExternaId: "6770207927",
              campanhaExternaId: "555",
              campanhaExternaNome:
                "Search | Aquisição Profissionais | AF",
              tipo: "SEARCH",
            },
          ]);
        mockProviders.listarCustos
          .mockResolvedValue([]);

        const resultado =
          await service
            .repararVinculoGoogleProfissionais({
              periodo,
            });

        expect(resultado).toMatchObject({
          reparado: false,
          motivo:
            "campanha_original_nao_determinada",
        });
        expect(
          mockMarketingCostSyncRepository
            .salvarVinculo
        ).not.toHaveBeenCalled();
      }
    );

    test(
      "preserva vínculo existente quando o Google confirma a mesma identidade externa",
      async () => {
        mockMarketingCostSyncRepository
          .buscarVinculosPorProvedor
          .mockResolvedValue([
            {
              campanha_id: 5,
              conta_externa_id: "6770207927",
              campanha_externa_id: "555",
              campanha_externa_nome:
                "Pesquisa | Search | Aquisição Profissionais | AF",
            },
          ]);
        mockProviders.buscarCampanha
          .mockResolvedValue({
            contaExternaId: "6770207927",
            campanhaExternaId: "555",
            campanhaExternaNome:
              "Pesquisa | Search | Aquisição Profissionais | AF",
            tipo: "SEARCH",
          });

        const resultado =
          await service
            .repararVinculoGoogleProfissionais({
              periodo,
            });

        expect(resultado).toMatchObject({
          reparado: false,
          jaVinculado: true,
          campanhaExternaId: "555",
          motivo: "vinculo_original_verificado",
        });
        expect(
          mockProviders.listarCampanhas
        ).not.toHaveBeenCalled();
        expect(
          mockProviders.listarCustos
        ).not.toHaveBeenCalled();
        expect(
          mockMarketingCostSyncRepository
            .salvarVinculo
        ).not.toHaveBeenCalled();
      }
    );

    test(
      "reconhece nome de aquisição profissional com acentos sem depender do idioma da interface",
      () => {
        expect(
          service.campanhaOriginalCompativel({
            campanhaExternaNome:
              "Pesquisa | Aquisição de Profissionais | AF",
            tipo: "SEARCH",
          })
        ).toBe(true);
      }
    );
  }
);
