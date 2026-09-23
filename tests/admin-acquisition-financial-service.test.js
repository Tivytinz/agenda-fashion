const mockBuscarRetornoAquisicao =
  jest.fn();
const mockContarPendentes =
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
