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

describe(
  "reparo de vínculo Google obsoleto",
  () => {
    test(
      "substitui vínculo removido somente depois de comprovar a campanha original atual",
      async () => {
        mockProviders.status.mockReturnValue([
          {
            provedor: "google_ads",
            configurado: true,
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
          .mockResolvedValue([
            {
              campanha_id: 5,
              conta_externa_id: "6770207927",
              campanha_externa_id: "111",
              campanha_externa_nome: "Campanha removida",
            },
          ]);

        const original = {
          contaExternaId: "6770207927",
          campanhaExternaId: "555",
          campanhaExternaNome:
            "Pesquisa | Search | Aquisição Profissionais | AF",
          status: "PAUSED",
          tipo: "SEARCH",
        };

        mockProviders.buscarCampanha
          .mockRejectedValueOnce(
            Object.assign(
              new Error("Campanha não encontrada"),
              { statusCode: 404 }
            )
          )
          .mockResolvedValueOnce(original);
        mockProviders.listarCampanhas
          .mockResolvedValue([original]);
        mockProviders.listarCustos
          .mockResolvedValue([
            {
              contaExternaId: "6770207927",
              campanhaExternaId: "555",
              dataGasto: "2026-08-20",
              valorCentavos: 7516,
            },
          ]);
        mockMarketingCostSyncRepository
          .salvarVinculo
          .mockResolvedValue({ id: 9 });

        const resultado =
          await service
            .repararVinculoGoogleProfissionais({
              periodo: {
                dataInicio: "2026-07-29",
                dataFim: "2026-08-27",
              },
            });

        expect(
          mockProviders.buscarCampanha
        ).toHaveBeenNthCalledWith(
          1,
          "google_ads",
          "111"
        );
        expect(
          mockProviders.buscarCampanha
        ).toHaveBeenNthCalledWith(
          2,
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
          campanhaExternaId: "555",
        });
      }
    );

    test(
      "não ignora falha de autenticação ao validar vínculo existente",
      async () => {
        mockProviders.status.mockReturnValue([
          {
            provedor: "google_ads",
            configurado: true,
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
          .mockResolvedValue([
            {
              campanha_id: 5,
              conta_externa_id: "6770207927",
              campanha_externa_id: "111",
            },
          ]);
        mockProviders.buscarCampanha
          .mockRejectedValue(
            Object.assign(
              new Error("Credencial recusada"),
              { statusCode: 502 }
            )
          );

        await expect(
          service.repararVinculoGoogleProfissionais({
            periodo: {
              dataInicio: "2026-07-29",
              dataFim: "2026-08-27",
            },
          })
        ).rejects.toThrow("Credencial recusada");

        expect(
          mockMarketingCostSyncRepository
            .salvarVinculo
        ).not.toHaveBeenCalled();
      }
    );
  }
);
