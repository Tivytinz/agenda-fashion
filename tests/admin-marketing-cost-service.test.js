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
    buscarDiagnosticoAtribuicao:
      jest.fn(),
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
      adminMarketingCostRepository
        .buscarDiagnosticoAtribuicao
        .mockResolvedValue({
          sessoes_oficiais: 0,
          sessoes_sem_campanha: 0,
          sessoes_identidade_nao_oficial: 0,
        });
    });

    test(
      "calcula custo por sessão e CPA de cliente com centavos inteiros",
      async () => {
        adminMarketingCostRepository
          .listarDesempenho
          .mockResolvedValue([
            {
              id: 4,
              nome: "Cílios Goiânia",
              canal: "meta",
              objetivo: "cliente",
              utm_source: "meta",
              utm_medium: "cpc",
              utm_campaign: "cilios_goiania",
              ativo: true,
              sessoes: 20,
              agendamentos_concluidos: 4,
              investimento_centavos: "10000",
            },
          ]);
        adminMarketingCostRepository
          .buscarDiagnosticoAtribuicao
          .mockResolvedValue({
            sessoes_oficiais: 20,
            sessoes_sem_campanha: 3,
            sessoes_identidade_nao_oficial: 2,
          });

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
            investimentoClientesCentavos: 10000,
            investimentoProfissionaisCentavos: 0,
            campanhasComInvestimento: 1,
            sessoes: 20,
            sessoesComCusto: 20,
            sessoesOficiaisSemCusto: 0,
            coberturaCustos: 100,
            sessoesPagasDetectadas: 25,
            coberturaAtribuicaoPaga: 80,
            agendamentosConcluidos: 4,
            agendamentosClientesComCusto: 4,
            agendamentosClientesSemCusto: 0,
            coberturaCustosClientes: 100,
            custoPorSessaoCentavos: 500,
            cpaCentavos: 2500,
            sessoesSemCampanha: 3,
            sessoesIdentidadeNaoOficial: 2,
            diagnosticoAtribuicao: {
              sessoesOficiais: 20,
              sessoesSemCampanha: 3,
              sessoesIdentidadeNaoOficial: 2,
              sessoesPagasDetectadas: 25,
              coberturaAtribuicaoPaga: 80,
            },
          });

        expect(
          resultado.campanhas[0]
        ).toMatchObject({
          campanhaId: 4,
          objetivo: "cliente",
          investimentoCentavos: 10000,
          sessoesComCusto: 20,
          sessoesSemCusto: 0,
          coberturaCustos: 100,
          custoPorSessaoCentavos: 500,
          cpaCentavos: 2500,
        });
      }
    );

    test(
      "não reduz CPS ou CPA usando sessões e conversões sem custo sincronizado",
      async () => {
        adminMarketingCostRepository
          .listarDesempenho
          .mockResolvedValue([
            {
              id: 4,
              nome: "Cliente com custo",
              canal: "google",
              objetivo: "cliente",
              utm_source: "google",
              utm_medium: "cpc",
              utm_campaign: "cliente_com_custo",
              ativo: true,
              sessoes: 50,
              sessoes_com_custo: 20,
              agendamentos_concluidos: 10,
              agendamentos_concluidos_com_custo: 4,
              investimento_centavos: "10000",
            },
          ]);
        adminMarketingCostRepository
          .buscarDiagnosticoAtribuicao
          .mockResolvedValue({
            sessoes_oficiais: 50,
            sessoes_sem_campanha: 0,
            sessoes_identidade_nao_oficial: 0,
          });

        const resultado =
          await adminMarketingCostService
            .buscarCustos();

        expect(resultado)
          .toMatchObject({
            investimentoCentavos: 10000,
            sessoesOficiais: 50,
            sessoesComCusto: 20,
            sessoesOficiaisSemCusto: 30,
            coberturaCustos: 40,
            agendamentosConcluidos: 10,
            agendamentosClientesComCusto: 4,
            agendamentosClientesSemCusto: 6,
            coberturaCustosClientes: 40,
            custoPorSessaoCentavos: 500,
            cpaCentavos: 2500,
            campanhasComInvestimento: 1,
          });

        expect(resultado.diagnosticoCustos)
          .toMatchObject({
            sessoesComCusto: 20,
            sessoesOficiaisSemCusto: 30,
            agendamentosClientesComCusto: 4,
            agendamentosClientesSemCusto: 6,
          });

        expect(resultado.campanhas[0])
          .toMatchObject({
            sessoes: 50,
            sessoesComCusto: 20,
            sessoesSemCusto: 30,
            coberturaCustos: 40,
            agendamentosConcluidos: 10,
            agendamentosConcluidosComCusto: 4,
            coberturaCustosConversoes: 40,
          });
      }
    );

    test(
      "não mistura investimento profissional no CPA de agendamento",
      async () => {
        adminMarketingCostRepository
          .listarDesempenho
          .mockResolvedValue([
            {
              id: 4,
              nome: "Cliente",
              canal: "meta",
              objetivo: "cliente",
              utm_source: "meta",
              utm_medium: "cpc",
              utm_campaign: "cliente",
              ativo: true,
              sessoes: 20,
              agendamentos_concluidos: 4,
              investimento_centavos: "10000",
            },
            {
              id: 5,
              nome: "Profissional",
              canal: "google",
              objetivo: "profissional",
              utm_source: "google",
              utm_medium: "cpc",
              utm_campaign: "profissional",
              ativo: true,
              sessoes: 30,
              agendamentos_concluidos: 3,
              investimento_centavos: "30000",
            },
          ]);
        adminMarketingCostRepository
          .buscarDiagnosticoAtribuicao
          .mockResolvedValue({
            sessoes_oficiais: 50,
            sessoes_sem_campanha: 0,
            sessoes_identidade_nao_oficial: 0,
          });

        const resultado =
          await adminMarketingCostService
            .buscarCustos();

        expect(resultado.investimentoCentavos)
          .toBe(40000);
        expect(resultado.investimentoClientesCentavos)
          .toBe(10000);
        expect(resultado.investimentoProfissionaisCentavos)
          .toBe(30000);
        expect(resultado.campanhasComInvestimento)
          .toBe(2);
        expect(resultado.agendamentosConcluidos)
          .toBe(4);
        expect(resultado.cpaCentavos)
          .toBe(2500);
        expect(resultado.campanhas[1].cpaCentavos)
          .toBeNull();
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
              objetivo: "cliente",
              utm_source: "google",
              utm_medium: "cpc",
              utm_campaign: "agenda_beleza",
              ativo: true,
              sessoes: 10,
              agendamentos_concluidos: 0,
              investimento_centavos: "5000",
            },
          ]);
        adminMarketingCostRepository
          .buscarDiagnosticoAtribuicao
          .mockResolvedValue({
            sessoes_oficiais: 10,
            sessoes_sem_campanha: 0,
            sessoes_identidade_nao_oficial: 0,
          });

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
      "não inventa cobertura ou custo quando não existe tráfego pago",
      async () => {
        adminMarketingCostRepository
          .listarDesempenho
          .mockResolvedValue([]);

        const resultado =
          await adminMarketingCostService
            .buscarCustos();

        expect(resultado)
          .toMatchObject({
            sessoesPagasDetectadas: 0,
            coberturaAtribuicaoPaga: null,
            coberturaCustos: null,
            custoPorSessaoCentavos: null,
            cpaCentavos: null,
            campanhasComInvestimento: 0,
          });
      }
    );

    test(
      "registra gasto manual e preserva o objetivo da campanha",
      async () => {
        adminCampaignRepository
          .buscarPorId
          .mockResolvedValue({
            id: 3,
            nome: "Meta Agosto",
            canal: "meta",
            objetivo: "cliente",
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
            objetivo: "cliente",
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
            objetivo: "cliente",
            ativo: true,
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

    test.each([
      [
        "arquivada",
        {
          id: 2,
          objetivo: "profissional",
          ativo: false,
        },
      ],
      [
        "sem objetivo classificado",
        {
          id: 2,
          objetivo: "indefinido",
          ativo: true,
        },
      ],
    ])(
      "rejeita gasto para campanha %s",
      async (_cenario, campanha) => {
        adminCampaignRepository
          .buscarPorId
          .mockResolvedValue(campanha);

        await expect(
          adminMarketingCostService
            .registrarGasto({
              payload: {
                campanhaId: 2,
                dataGasto:
                  "2026-08-10",
                valorCentavos: 1000,
              },
              usuarioId: 7,
            })
        ).rejects.toMatchObject({
          statusCode: 409,
        });

        expect(
          adminMarketingCostRepository
            .salvarGastoManual
        ).not.toHaveBeenCalled();
      }
    );
  }
);
