const service = require(
  "../src/services/adminProfessionalRecurrenceFinancialReadinessService"
);

const CONFIGURACAO = Object.freeze({
  minimoCadastros: 2,
  minimoAssinaturas: 2,
  coberturaMinimaPercentual: 100,
  diasMaturacaoAtivacao: 14,
  diasMaturacaoMonetizacao: 21,
});

function custo({
  janelaDias = 7,
  diasNecessarios = 21,
  profissionais = 2,
  leitura = "base_madura_comparavel",
  baseComparavel = true,
} = {}) {
  return {
    janelaDias,
    diasNecessarios,
    investimentoMaduroCentavos: 10000,
    diasMadurosComGasto: 1,
    profissionaisMadurosComGasto:
      profissionais,
    profissionaisMadurosSemGasto: 0,
    leitura,
    baseComparavel,
  };
}

function monetizacao({
  janelaDias = 7,
  diasMaturidadeNecessarios = 21,
} = {}) {
  return {
    janelaDias,
    diasMaturidadeNecessarios,
    profissionaisMaduros: 2,
  };
}

function campanhaBase(overrides = {}) {
  return {
    chave: "campanha:10",
    campanhaOficialId: "10",
    origem: "google",
    midia: "cpc",
    campanha: "google_ads_profissionais",
    custosRecorrenciaMadura: [
      custo(),
      custo({
        janelaDias: 14,
        diasNecessarios: 28,
      }),
      custo({
        janelaDias: 30,
        diasNecessarios: 44,
        profissionais: 0,
        leitura: "aguardando_gasto_maduro",
        baseComparavel: false,
      }),
    ],
    monetizacaoRecorrencia: [
      monetizacao(),
      monetizacao({
        janelaDias: 14,
        diasMaturidadeNecessarios: 28,
      }),
      monetizacao({
        janelaDias: 30,
        diasMaturidadeNecessarios: 44,
      }),
    ],
    ...overrides,
  };
}

function linhaBase(overrides = {}) {
  return {
    usuario_id: 1,
    classificacao_atribuicao: "oficial",
    campanha_oficial_id: "10",
    atribuicao_em:
      "2026-08-01T14:00:00.000Z",
    primeiro_agendamento_em:
      "2026-08-03T14:00:00.000Z",
    segundo_agendamento_em:
      "2026-08-06T14:00:00.000Z",
    terceiro_agendamento_em:
      "2026-08-07T14:00:00.000Z",
    pagamento_inicial_valido: true,
    primeiro_pagamento_em: "2026-08-11",
    ...overrides,
  };
}

const INVESTIMENTOS = [
  {
    campanha_id: "10",
    data_gasto: "2026-08-01",
    idade_dias: 29,
    investimento_centavos: 10000,
  },
];

const AGORA = new Date(
  "2026-08-30T12:00:00.000Z"
);

describe(
  "adminProfessionalRecurrenceFinancialReadinessService",
  () => {
    test(
      "libera leitura conjunta quando custo, recorrencia e monetizacao usam a mesma base madura",
      () => {
        const janela =
          service.criarJanelaProntidao({
            campanha: campanhaBase(),
            linhasRecorrencia: [
              linhaBase(),
              linhaBase({
                usuario_id: 2,
                segundo_agendamento_em: null,
                terceiro_agendamento_em: null,
                pagamento_inicial_valido: false,
                primeiro_pagamento_em:
                  "2026-08-12",
              }),
            ],
            investimentosDiarios:
              INVESTIMENTOS,
            janelaDias: 7,
            agora: AGORA,
            configuracao: CONFIGURACAO,
          });

        expect(janela).toMatchObject({
          janelaDias: 7,
          diasMaturidadeFinanceira: 21,
          investimentoMaduroCentavos: 10000,
          profissionaisMadurosComGasto: 2,
          profissionaisReconstruidos: 2,
          profissionaisMadurosSemGasto: 0,
          comPrimeiroNaAtivacao: 2,
          comSegundoNaJanela: 1,
          comTerceiroNaJanela: 1,
          assinaturasNaMonetizacao: 1,
          assinaturasEntreSegundo: 1,
          assinaturasEntreTerceiro: 1,
          minimoAssinaturasReguaRoas: 2,
          atingiuMinimoAssinaturasReguaRoas: false,
          prontaParaLeituraConjunta: true,
          leitura: {
            codigo:
              "leitura_conjunta_disponivel",
            pronta: true,
          },
        });
      }
    );

    test(
      "resultado zero de assinatura nao bloqueia uma base integra",
      () => {
        const janela =
          service.criarJanelaProntidao({
            campanha: campanhaBase(),
            linhasRecorrencia: [
              linhaBase({
                pagamento_inicial_valido: false,
              }),
              linhaBase({
                usuario_id: 2,
                pagamento_inicial_valido: false,
              }),
            ],
            investimentosDiarios:
              INVESTIMENTOS,
            janelaDias: 7,
            agora: AGORA,
            configuracao: CONFIGURACAO,
          });

        expect(janela.assinaturasNaMonetizacao)
          .toBe(0);
        expect(janela.prontaParaLeituraConjunta)
          .toBe(true);
        expect(
          janela.atingiuMinimoAssinaturasReguaRoas
        ).toBe(false);
      }
    );

    test(
      "herda bloqueio da base madura de custo sem transformar resultado em decisao",
      () => {
        const campanha = campanhaBase({
          custosRecorrenciaMadura: [
            custo({
              leitura:
                "atribuicao_paga_incompleta",
              baseComparavel: false,
            }),
          ],
          monetizacaoRecorrencia: [
            monetizacao(),
          ],
        });
        const janela =
          service.criarJanelaProntidao({
            campanha,
            linhasRecorrencia: [
              linhaBase(),
              linhaBase({ usuario_id: 2 }),
            ],
            investimentosDiarios:
              INVESTIMENTOS,
            janelaDias: 7,
            agora: AGORA,
            configuracao: CONFIGURACAO,
          });

        expect(janela).toMatchObject({
          prontaParaLeituraConjunta: false,
          leitura: {
            codigo:
              "atribuicao_paga_incompleta",
            pronta: false,
          },
        });
      }
    );

    test(
      "bloqueia quando monetizacao exige maturidade maior que a base financeira de recorrencia",
      () => {
        const campanha = campanhaBase({
          custosRecorrenciaMadura: [
            custo({
              diasNecessarios: 21,
            }),
          ],
          monetizacaoRecorrencia: [
            monetizacao({
              diasMaturidadeNecessarios: 30,
            }),
          ],
        });
        const janela =
          service.criarJanelaProntidao({
            campanha,
            linhasRecorrencia: [
              linhaBase(),
              linhaBase({ usuario_id: 2 }),
            ],
            investimentosDiarios:
              INVESTIMENTOS,
            janelaDias: 7,
            agora: AGORA,
            configuracao: CONFIGURACAO,
          });

        expect(janela).toMatchObject({
          diasMaturidadeFinanceira: 30,
          prontaParaLeituraConjunta: false,
          leitura: {
            codigo:
              "maturidade_financeira_desalinhada",
          },
        });
      }
    );

    test(
      "bloqueia se a base reconstruida nao coincidir com a base madura de custo",
      () => {
        const campanha = campanhaBase({
          custosRecorrenciaMadura: [
            custo({ profissionais: 3 }),
          ],
          monetizacaoRecorrencia: [
            monetizacao(),
          ],
        });
        const janela =
          service.criarJanelaProntidao({
            campanha,
            linhasRecorrencia: [
              linhaBase(),
              linhaBase({ usuario_id: 2 }),
            ],
            investimentosDiarios:
              INVESTIMENTOS,
            janelaDias: 7,
            agora: AGORA,
            configuracao: CONFIGURACAO,
          });

        expect(janela).toMatchObject({
          profissionaisMadurosComGasto: 3,
          profissionaisReconstruidos: 2,
          prontaParaLeituraConjunta: false,
          leitura: {
            codigo:
              "base_financeira_inconsistente",
          },
        });
      }
    );

    test(
      "enriquece campanhas sem alterar a recomendacao financeira do funil",
      () => {
        const resultado =
          service
            .enriquecerRecorrenciaComProntidaoFinanceira({
              recorrencia: {
                periodo: "30",
                qualidadeCampanhasOficiais: [
                  campanhaBase(),
                ],
                metodologia: {
                  unidade: "profissional",
                },
              },
              linhasRecorrencia: [
                linhaBase(),
                linhaBase({ usuario_id: 2 }),
              ],
              investimentosDiarios:
                INVESTIMENTOS,
              agora: AGORA,
              configuracao: CONFIGURACAO,
            });

        expect(
          resultado.qualidadeCampanhasOficiais[0]
            .prontidaoFinanceiraRecorrencia
        ).toHaveLength(3);
        expect(
          resultado.diagnosticoProntidaoFinanceira
        ).toMatchObject({
          minimoCadastros: 2,
          minimoAssinaturas: 2,
          diasMaturacaoAtivacao: 14,
          diasMaturacaoMonetizacao: 21,
        });
        expect(
          resultado.metodologia
            .prontidaoFinanceira
        ).toMatch(/não substitui a decisão financeira/i);
        expect(resultado.decisao)
          .toBeUndefined();
      }
    );
  }
);
