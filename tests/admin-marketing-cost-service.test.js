jest.mock(
  "../src/repositories/adminCampaignRepository",
  () => ({
    buscarPorId: jest.fn(),
  })
);

jest.mock(
  "../src/repositories/adminMarketingCostRepository",
  () => ({
    listarDesempenho: jest.fn(),
    listarGastos: jest.fn(),
    salvarGastoManual: jest.fn(),
  })
);

const adminCampaignRepository =
  require(
    "../src/repositories/adminCampaignRepository"
  );

const adminMarketingCostRepository =
  require(
    "../src/repositories/adminMarketingCostRepository"
  );

const adminMarketingCostService =
  require(
    "../src/services/adminMarketingCostService"
  );

describe(
  "custos do marketing administrativo",
  () => {
    beforeEach(() => {
      jest.clearAllMocks();
    });

    test(
      "calcula custo por sessão e CPA com centavos inteiros",
      async () => {
        adminMarketingCostRepository
          .listarDesempenho
          .mockResolvedValue([
            {
              id: 4,
              nome: "Cílios Goiânia",
              canal: "meta",
              utm_source: "meta",
              utm_medium: "cpc",
              utm_campaign: "cilios_goiania",
              ativo: true,
              sessoes: 20,
              agendamentos_concluidos: 4,
              investimento_centavos: "10000",
            },
          ]);

        const resultado =
          await adminMarketingCostService
            .buscarCustos({
              periodo: "30dias",
            });

        expect(
          adminMarketingCostRepository
            .listarDesempenho
        ).toHaveBeenCalledWith(
          "30"
        );

        expect(resultado)
          .toMatchObject({
            periodo: "30",
            moeda: "BRL",
            investimentoCentavos: 10000,
            sessoes: 20,
            agendamentosConcluidos: 4,
            custoPorSessaoCentavos: 500,
            cpaCentavos: 2500,
          });

        expect(
          resultado.campanhas[0]
        ).toMatchObject({
          campanhaId: 4,
          investimentoCentavos: 10000,
          custoPorSessaoCentavos: 500,
          cpaCentavos: 2500,
        });
      }
    );

    test(
      "não apresenta CPA zero quando ainda não existe conversão",
      async () => {
        adminMarketingCostRepository
          .listarDesempenho
          .mockResolvedValue([
            {
              id: 8,
              nome: "Google pesquisa",
              canal: "google",
              utm_source: "google",
              utm_medium: "cpc",
              utm_campaign: "agenda_beleza",
              ativo: true,
              sessoes: 10,
              agendamentos_concluidos: 0,
              investimento_centavos: "5000",
            },
          ]);

        const resultado =
          await adminMarketingCostService
            .buscarCustos();

        expect(resultado.cpaCentavos)
          .toBeNull();

        expect(
          resultado.campanhas[0]
            .cpaCentavos
        ).toBeNull();

        expect(
          resultado.custoPorSessaoCentavos
        ).toBe(500);
      }
    );

    test(
      "registra gasto manual e permite corrigir o mesmo dia pelo repository",
      async () => {
        adminCampaignRepository
          .buscarPorId
          .mockResolvedValue({
            id: 3,
            nome: "Meta Agosto",
            canal: "meta",
            utm_source: "meta",
            utm_medium: "cpc",
            utm_campaign: "meta_agosto",
          });

        adminMarketingCostRepository
          .salvarGastoManual
          .mockResolvedValue({
            id: 11,
            campanha_id: 3,
            data_gasto: "2026-08-10",
            valor_centavos: "12345",
            moeda: "BRL",
            fonte: "manual",
            observacao: "Fechamento do dia",
            updated_at:
              "2026-08-10T23:00:00.000Z",
          });

        const resultado =
          await adminMarketingCostService
            .registrarGasto({
              payload: {
                campanhaId: 3,
                dataGasto:
                  "2026-08-10",
                valorCentavos: 12345,
                observacao:
                  " Fechamento do dia ",
              },
              usuarioId: 7,
            });

        expect(
          adminMarketingCostRepository
            .salvarGastoManual
        ).toHaveBeenCalledWith({
          campanhaId: 3,
          dataGasto: "2026-08-10",
          valorCentavos: 12345,
          observacao:
            "Fechamento do dia",
          usuarioId: 7,
        });

        expect(resultado.gasto)
          .toMatchObject({
            id: 11,
            campanhaId: 3,
            campanhaNome: "Meta Agosto",
            valorCentavos: 12345,
            fonte: "manual",
          });
      }
    );

    test(
      "rejeita gasto para campanha inexistente",
      async () => {
        adminCampaignRepository
          .buscarPorId
          .mockResolvedValue(null);

        await expect(
          adminMarketingCostService
            .registrarGasto({
              payload: {
                campanhaId: 99,
                dataGasto:
                  "2026-08-10",
                valorCentavos: 1000,
              },
              usuarioId: 7,
            })
        ).rejects.toMatchObject({
          statusCode: 404,
        });

        expect(
          adminMarketingCostRepository
            .salvarGastoManual
        ).not.toHaveBeenCalled();
      }
    );

    test(
      "valida data e investimento antes de salvar",
      async () => {
        adminCampaignRepository
          .buscarPorId
          .mockResolvedValue({
            id: 2,
          });

        await expect(
          adminMarketingCostService
            .registrarGasto({
              payload: {
                campanhaId: 2,
                dataGasto:
                  "2026-02-31",
                valorCentavos: 1000,
              },
              usuarioId: 7,
            })
        ).rejects.toMatchObject({
          statusCode: 400,
        });

        await expect(
          adminMarketingCostService
            .registrarGasto({
              payload: {
                campanhaId: 2,
                dataGasto:
                  "2026-08-10",
                valorCentavos: 0,
              },
              usuarioId: 7,
            })
        ).rejects.toMatchObject({
          statusCode: 400,
        });
      }
    );
  }
);
