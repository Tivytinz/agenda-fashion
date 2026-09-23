const mockBuscarRetornoAquisicao =
  jest.fn();
const mockContarPendentes =
  jest.fn();
const mockBuscarRetornoLiquidoAquisicao =
  jest.fn();
const mockBuscarProntidaoContribuicao =
  jest.fn();
const mockBuscarRetornoContribuicaoAquisicao =
  jest.fn();

jest.mock(
  "../src/repositories/adminAcquisitionFinancialRepository",
  () => ({
    buscarRetornoAquisicao:
      mockBuscarRetornoAquisicao,
  })
);

jest.mock(
  "../src/repositories/aquisicaoFinanceiraRepository",
  () => ({
    contarPendentes:
      mockContarPendentes,
  })
);
jest.mock(
  "../src/repositories/adminPaymentEconomicsRepository",
  () => ({
    buscarRetornoLiquidoAquisicao:
      mockBuscarRetornoLiquidoAquisicao,
  })
);

jest.mock(
  "../src/repositories/adminContributionReturnRepository",
  () => ({
    buscarProntidao:
      mockBuscarProntidaoContribuicao,
    buscarRetornoContribuicaoAquisicao:
      mockBuscarRetornoContribuicaoAquisicao,
  })
);

jest.mock(
  "../src/services/adminProfessionalFunnelService",
  () => ({
    configuracaoDecisao:
      jest.fn(() => ({
        diasMaturacaoMonetizacao: 21,
      })),
  })
);

const service = require(
  "../src/services/adminAcquisitionFinancialService"
);

describe(
  "adminAcquisitionFinancialService",
  () => {
    beforeEach(() => {
      jest.clearAllMocks();
      mockContarPendentes
        .mockResolvedValue(0);
      mockBuscarProntidaoContribuicao
        .mockResolvedValue({
          inicio_cobertura_wave30:
            "2026-09-23T21:30:00.000Z",
          inicio_cobertura_contribuicao:
            "2026-09-23T20:00:00.000Z",
          fontes_obrigatorias: 0,
          fontes_cobertas_ate_hoje: 0,
          inicio_cobertura_fontes: null,
          menor_coberto_ate: null,
          cobertura_contribuicao_completa_hoje:
            false,
        });
      mockBuscarRetornoContribuicaoAquisicao
        .mockResolvedValue({
          inicio_cobertura:
            "2026-09-23T21:30:00.000Z",
          dias_maturacao_monetizacao:
            21,
          campanhas: [],
        });
      mockBuscarRetornoLiquidoAquisicao
        .mockResolvedValue({
          inicio_cobertura:
            "2026-09-23T19:00:00.000Z",
          campanhas: [
            {
              campanha_id: 10,
              negocios_d30: 2,
              negocios_d60: 2,
              negocios_d90: 0,
              incompletos_d30: 0,
              incompletos_d60: 0,
              incompletos_d90: 0,
              receita_liquida_d30:
                "280.00",
              receita_liquida_d60:
                "470.00",
              receita_liquida_d90:
                "0.00",
            },
          ],
        });
      mockBuscarRetornoAquisicao
        .mockResolvedValue({
          inicio_cobertura:
            "2026-09-23T18:00:00.000Z",
          primeiro_dia_completo:
            "2026-09-24",
          dias_maturacao_monetizacao:
            21,
          diagnostico: {
            snapshots_total: 4,
            snapshots_oficiais: 3,
            snapshots_organicos: 1,
            snapshots_atribuicao_incompleta:
              0,
            snapshots_aquisicao_pre_cutover:
              0,
          },
          campanhas: [
            {
              campanha_id: 10,
              campanha_nome:
                "Google profissionais",
              canal: "google",
              utm_source: "google",
              utm_medium: "cpc",
              utm_campaign:
                "google_ads_profissionais",
              investimento_d30_centavos:
                20000,
              investimento_d60_centavos:
                20000,
              investimento_d90_centavos:
                0,
              dias_maduros_d30: 2,
              dias_maduros_d60: 2,
              dias_maduros_d90: 0,
              negocios_pagos_d30: 2,
              negocios_pagos_d60: 2,
              negocios_pagos_d90: 0,
              receita_d30_centavos:
                30000,
              receita_d60_centavos:
                50000,
              receita_d90_centavos: 0,
              valor_exposto_reversoes_centavos:
                4990,
              pagantes_sem_custo_d30: 0,
              pagantes_sem_custo_d60: 0,
              pagantes_sem_custo_d90: 0,
            },
          ],
        });
    });

    test(
      "calcula CAC de mídia e retorno bruto na mesma coorte",
      async () => {
        const resultado =
          await service.buscar();

        expect(
          mockBuscarRetornoAquisicao
        ).toHaveBeenCalledWith({
          diasMaturacaoMonetizacao: 21,
        });
        expect(resultado).toMatchObject({
          independenteDoFiltroPeriodo: true,
          unidade: "negocio",
          diasMaturacaoMonetizacao: 21,
          diagnostico: {
            snapshotsTotal: 4,
            snapshotsOficiais: 3,
            snapshotsOrganicos: 1,
            snapshotsPendentes: 0,
            pagantesSemCustoD30: 0,
          },
        });

        const campanha =
          resultado.campanhas[0];
        const d30 =
          campanha.janelas.find(
            (item) => item.dias === 30
          );
        const d60 =
          campanha.janelas.find(
            (item) => item.dias === 60
          );
        const d90 =
          campanha.janelas.find(
            (item) => item.dias === 90
          );

        expect(d30).toMatchObject({
          investimentoCentavos: 20000,
          negociosPagos: 2,
          cacMidiaCentavos: 10000,
          receitaBrutaCentavos: 30000,
          ltvBrutoCentavos: 15000,
          retornoBruto: 1.5,
          ltvBrutoSobreCacMidia: 1.5,
          custoConfiavel: true,
          leitura: {
            codigo: "base_comparavel",
            comparavel: true,
          },
          economiaLiquida: {
            comparavel: true,
            codigo: "base_comparavel",
            negociosCobertos: 2,
            pagamentosOuNegociosIncompletos: 0,
          },
          receitaLiquidaGatewayCentavos: 28000,
          ltvLiquidoGatewayCentavos: 14000,
          retornoLiquidoGateway: 1.4,
          ltvLiquidoGatewaySobreCacMidia: 1.4,
          contribuicao: {
            codigo:
              "sem_fonte_contribuicao",
            comparavel: false,
            retornoContribuicao: null,
            ltvContribuicaoSobreCacMidia:
              null,
          },
        });
        expect(d60.retornoBruto)
          .toBe(2.5);
        expect(d90.leitura)
          .toMatchObject({
            codigo:
              "aguardando_maturidade",
            comparavel: false,
          });
        expect(
          campanha
            .primeiraRecuperacaoReceitaBrutaDias
        ).toBe(30);
        expect(
          campanha
            .primeiraRecuperacaoLiquidaGatewayDias
        ).toBe(30);
        expect(
          mockBuscarRetornoLiquidoAquisicao
        ).toHaveBeenCalledWith({
          diasMaturacaoMonetizacao: 21,
        });
        expect(
          mockBuscarProntidaoContribuicao
        ).toHaveBeenCalledTimes(1);
        expect(
          mockBuscarRetornoContribuicaoAquisicao
        ).toHaveBeenCalledWith({
          diasMaturacaoMonetizacao: 21,
        });
        expect(
          resultado.contribuicaoProntidao
        ).toMatchObject({
          fontesObrigatorias: 0,
          fontesCobertasAteHoje: 0,
          coberturaCompletaHoje: false,
          ltvContribuicaoDisponivel:
            false,
          retornoContribuicaoDisponivel:
            false,
        });
        expect(
          campanha
            .primeiraRecuperacaoContribuicaoDias
        ).toBeNull();
      }
    );

    test(
      "bloqueia leitura quando pagante maduro não tem custo do dia de aquisição",
      async () => {
        mockBuscarRetornoAquisicao
          .mockResolvedValue({
            inicio_cobertura:
              "2026-09-23T18:00:00.000Z",
            primeiro_dia_completo:
              "2026-09-24",
            dias_maturacao_monetizacao:
              21,
            diagnostico: {},
            campanhas: [
              {
                campanha_id: 20,
                campanha_nome: "Meta",
                dias_maduros_d30: 0,
                investimento_d30_centavos:
                  0,
                negocios_pagos_d30: 1,
                receita_d30_centavos:
                  12000,
                pagantes_sem_custo_d30:
                  1,
                pagantes_sem_custo_d60:
                  0,
                pagantes_sem_custo_d90:
                  0,
              },
            ],
          });

        const resultado =
          await service.buscar();
        const d30 =
          resultado.campanhas[0]
            .janelas[0];

        expect(d30.leitura)
          .toMatchObject({
            codigo:
              "cobertura_custo_incompleta",
            comparavel: false,
          });
        expect(d30.custoConfiavel)
          .toBe(false);
        expect(
          resultado.campanhas[0]
            .primeiraRecuperacaoReceitaBrutaDias
        ).toBeNull();
      }
    );

    test(
      "não libera retorno sem janela madura posterior ao cutover da Wave 30",
      async () => {
        mockBuscarProntidaoContribuicao
          .mockResolvedValue({
            inicio_cobertura_wave30:
              "2026-09-23T21:30:00.000Z",
            inicio_cobertura_contribuicao:
              "2026-09-23T20:00:00.000Z",
            fontes_obrigatorias: 2,
            fontes_cobertas_ate_hoje: 2,
            inicio_cobertura_fontes:
              "2026-09-23",
            menor_coberto_ate:
              "2026-09-23",
            cobertura_contribuicao_completa_hoje:
              true,
          });
        mockBuscarRetornoContribuicaoAquisicao
          .mockResolvedValue({
            inicio_cobertura:
              "2026-09-23T21:30:00.000Z",
            dias_maturacao_monetizacao:
              21,
            campanhas: [
              {
                campanha_id: 10,
                fontes_obrigatorias: 2,
                investimento_d30_centavos: 0,
                dias_maduros_d30: 0,
                negocios_d30: 0,
                negocios_cobertos_d30: 0,
                incompletos_d30: 0,
                pagantes_sem_custo_d30: 0,
                contribuicao_d30: "0.00",
              },
            ],
          });

        const resultado =
          await service.buscar();
        const d30 =
          resultado.campanhas[0]
            .janelas[0];

        expect(d30.contribuicao)
          .toMatchObject({
            codigo:
              "aguardando_maturidade",
            comparavel: false,
            retornoContribuicao: null,
          });

        expect(
          resultado
            .contribuicaoProntidao
            .retornoContribuicaoDisponivel
        ).toBe(false);
      }
    );

    test(
      "calcula retorno e recuperação de contribuição somente com a base totalmente coberta",
      async () => {
        mockBuscarProntidaoContribuicao
          .mockResolvedValue({
            inicio_cobertura_wave30:
              "2026-06-01T00:00:00.000Z",
            inicio_cobertura_contribuicao:
              "2026-05-01T00:00:00.000Z",
            fontes_obrigatorias: 1,
            fontes_cobertas_ate_hoje: 1,
            inicio_cobertura_fontes:
              "2026-05-01",
            menor_coberto_ate:
              "2026-09-23",
            cobertura_contribuicao_completa_hoje:
              true,
          });
        mockBuscarRetornoContribuicaoAquisicao
          .mockResolvedValue({
            inicio_cobertura:
              "2026-06-01T00:00:00.000Z",
            dias_maturacao_monetizacao:
              21,
            campanhas: [
              {
                campanha_id: 10,
                fontes_obrigatorias: 1,
                investimento_d30_centavos:
                  20000,
                investimento_d60_centavos:
                  20000,
                investimento_d90_centavos:
                  0,
                dias_maduros_d30: 2,
                dias_maduros_d60: 2,
                dias_maduros_d90: 0,
                negocios_d30: 2,
                negocios_d60: 2,
                negocios_d90: 0,
                negocios_cobertos_d30: 2,
                negocios_cobertos_d60: 2,
                negocios_cobertos_d90: 0,
                incompletos_d30: 0,
                incompletos_d60: 0,
                incompletos_d90: 0,
                pagantes_sem_custo_d30: 0,
                pagantes_sem_custo_d60: 0,
                pagantes_sem_custo_d90: 0,
                contribuicao_d30: "240.00",
                contribuicao_d60: "360.00",
                contribuicao_d90: "0.00",
              },
            ],
          });

        const resultado =
          await service.buscar();
        const campanha =
          resultado.campanhas[0];
        const d30 =
          campanha.janelas[0];

        expect(d30.contribuicao)
          .toMatchObject({
            codigo: "base_comparavel",
            comparavel: true,
            fontesObrigatorias: 1,
            negocios: 2,
            negociosCobertos: 2,
            incompletos: 0,
            investimentoCentavos: 20000,
            cacMidiaCentavos: 10000,
            contribuicaoCentavos: 24000,
            ltvContribuicaoCentavos:
              12000,
            retornoContribuicao: 1.2,
            ltvContribuicaoSobreCacMidia:
              1.2,
          });
        expect(
          campanha
            .primeiraRecuperacaoContribuicaoDias
        ).toBe(30);
        expect(
          resultado
            .contribuicaoProntidao
            .ltvContribuicaoDisponivel
        ).toBe(true);
        expect(
          resultado
            .contribuicaoProntidao
            .retornoContribuicaoDisponivel
        ).toBe(true);
      }
    );

    test(
      "bloqueia retorno quando algum negócio maduro está incompleto",
      async () => {
        mockBuscarProntidaoContribuicao
          .mockResolvedValue({
            fontes_obrigatorias: 1,
            fontes_cobertas_ate_hoje: 1,
            cobertura_contribuicao_completa_hoje:
              true,
          });
        mockBuscarRetornoContribuicaoAquisicao
          .mockResolvedValue({
            inicio_cobertura:
              "2026-06-01T00:00:00.000Z",
            campanhas: [
              {
                campanha_id: 10,
                fontes_obrigatorias: 1,
                investimento_d30_centavos:
                  20000,
                dias_maduros_d30: 2,
                negocios_d30: 2,
                negocios_cobertos_d30: 1,
                incompletos_d30: 1,
                pagantes_sem_custo_d30: 0,
                contribuicao_d30: "120.00",
              },
            ],
          });

        const resultado =
          await service.buscar();
        const d30 =
          resultado.campanhas[0]
            .janelas[0];

        expect(d30.contribuicao)
          .toMatchObject({
            codigo:
              "cobertura_contribuicao_incompleta",
            comparavel: false,
            retornoContribuicao: null,
            contribuicaoCentavos: null,
          });
      }
    );

    test(
      "preserva contribuição negativa como perda observada",
      async () => {
        mockBuscarProntidaoContribuicao
          .mockResolvedValue({
            fontes_obrigatorias: 1,
            fontes_cobertas_ate_hoje: 1,
            cobertura_contribuicao_completa_hoje:
              true,
          });
        mockBuscarRetornoContribuicaoAquisicao
          .mockResolvedValue({
            inicio_cobertura:
              "2026-06-01T00:00:00.000Z",
            campanhas: [
              {
                campanha_id: 10,
                fontes_obrigatorias: 1,
                investimento_d30_centavos:
                  10000,
                dias_maduros_d30: 1,
                negocios_d30: 1,
                negocios_cobertos_d30: 1,
                incompletos_d30: 0,
                pagantes_sem_custo_d30: 0,
                contribuicao_d30: "-20.00",
              },
            ],
          });

        const resultado =
          await service.buscar();
        const d30 =
          resultado.campanhas[0]
            .janelas[0];

        expect(d30.contribuicao)
          .toMatchObject({
            comparavel: true,
            contribuicaoCentavos: -2000,
            ltvContribuicaoCentavos:
              -2000,
            retornoContribuicao: -0.2,
            ltvContribuicaoSobreCacMidia:
              -0.2,
          });
      }
    );

    test(
      "não chama ausência de pagante de CAC zero",
      () => {
        expect(
          service.mapearJanela(
            {
              investimento_d30_centavos:
                10000,
              negocios_pagos_d30: 0,
              receita_d30_centavos: 0,
              dias_maduros_d30: 1,
              pagantes_sem_custo_d30: 0,
            },
            30
          )
        ).toMatchObject({
          cacMidiaCentavos: null,
          ltvBrutoCentavos: null,
          retornoBruto: 0,
          ltvBrutoSobreCacMidia: null,
        });
      }
    );
  }
);
