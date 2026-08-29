const service = require(
  "../src/services/adminProfessionalRecurrenceMonetizationService"
);

const CONFIGURACAO = Object.freeze({
  diasMaturacaoAtivacao: 14,
  diasMaturacaoMonetizacao: 21,
  minimoCadastros: 10,
});

function linhaBase(overrides = {}) {
  return {
    usuario_id: 1,
    classificacao_atribuicao: "oficial",
    campanha_oficial_id: "10",
    origem: "google",
    midia: "cpc",
    campanha: "google_ads_profissionais",
    atribuicao_em:
      "2026-07-01T00:00:00.000Z",
    primeiro_agendamento_em:
      "2026-07-05T00:00:00.000Z",
    segundo_agendamento_em:
      "2026-07-10T00:00:00.000Z",
    terceiro_agendamento_em:
      "2026-07-12T00:00:00.000Z",
    pagamento_inicial_valido: true,
    primeiro_pagamento_em:
      "2026-07-13T00:00:00.000Z",
    receita_primeiro_pagamento_centavos:
      "4990",
    ...overrides,
  };
}

describe(
  "adminProfessionalRecurrenceMonetizationService",
  () => {
    test(
      "considera madura a aquisição exatamente no limite de timestamp",
      () => {
        expect(
          service.estaMaduroDesdeAquisicao(
            "2026-08-08T12:00:00.000Z",
            new Date(
              "2026-08-29T12:00:00.000Z"
            ),
            21
          )
        ).toBe(true);

        expect(
          service.estaMaduroDesdeAquisicao(
            "2026-08-08T12:00:00.001Z",
            new Date(
              "2026-08-29T12:00:00.000Z"
            ),
            21
          )
        ).toBe(false);
      }
    );

    test(
      "aceita primeiro pagamento válido no limite e rejeita depois, antes ou inválido",
      () => {
        expect(
          service.pagamentoInicialNaJanela(
            linhaBase({
              atribuicao_em:
                "2026-08-01T00:00:00.000Z",
              primeiro_pagamento_em:
                "2026-08-22T00:00:00.000Z",
            }),
            21
          )
        ).toBe(true);

        expect(
          service.pagamentoInicialNaJanela(
            linhaBase({
              atribuicao_em:
                "2026-08-01T00:00:00.000Z",
              primeiro_pagamento_em:
                "2026-08-22T00:00:00.001Z",
            }),
            21
          )
        ).toBe(false);

        expect(
          service.pagamentoInicialNaJanela(
            linhaBase({
              atribuicao_em:
                "2026-08-01T00:00:00.000Z",
              primeiro_pagamento_em:
                "2026-07-31T23:59:59.999Z",
            }),
            21
          )
        ).toBe(false);

        expect(
          service.pagamentoInicialNaJanela(
            linhaBase({
              pagamento_inicial_valido: false,
            }),
            21
          )
        ).toBe(false);
      }
    );

    test(
      "relaciona assinatura e repetição sem inferir causalidade",
      () => {
        const janela =
          service.criarJanelaMonetizacao(
            [
              linhaBase(),
              linhaBase({
                usuario_id: 2,
                segundo_agendamento_em: null,
                terceiro_agendamento_em: null,
                pagamento_inicial_valido: false,
                primeiro_pagamento_em:
                  "2026-07-15T00:00:00.000Z",
              }),
              linhaBase({
                usuario_id: 3,
                primeiro_agendamento_em:
                  "2026-07-20T00:00:00.000Z",
                segundo_agendamento_em:
                  "2026-07-21T00:00:00.000Z",
                terceiro_agendamento_em: null,
                primeiro_pagamento_em:
                  "2026-07-18T00:00:00.000Z",
              }),
            ],
            7,
            new Date(
              "2026-08-29T00:00:00.000Z"
            ),
            CONFIGURACAO
          );

        expect(janela).toEqual({
          janelaDias: 7,
          diasMaturidadeNecessarios: 21,
          profissionaisMaduros: 3,
          comPrimeiroNaAtivacao: 2,
          comSegundoNaJanela: 1,
          comTerceiroNaJanela: 1,
          assinaturasNaMonetizacao: 2,
          taxaAssinaturaBaseMadura: 66.67,
          assinaturasEntrePrimeiro: 1,
          taxaAssinaturaEntrePrimeiro: 50,
          assinaturasEntreSegundo: 1,
          taxaAssinaturaEntreSegundo: 100,
          assinaturasEntreTerceiro: 1,
          taxaAssinaturaEntreTerceiro: 100,
          minimoCadastrosReguaOperacional: 10,
          baseAbaixoReguaOperacional: true,
        });
      }
    );

    test(
      "usa o maior prazo entre monetização e ativação somada à recorrência",
      () => {
        const resultado =
          service.criarMonetizacaoPorCampanha({
            linhas: [linhaBase()],
            agora: new Date(
              "2026-08-29T00:00:00.000Z"
            ),
            configuracao: CONFIGURACAO,
          });

        expect(
          resultado[0].janelas.map(
            (janela) => ({
              janelaDias: janela.janelaDias,
              diasMaturidadeNecessarios:
                janela.diasMaturidadeNecessarios,
            })
          )
        ).toEqual([
          {
            janelaDias: 7,
            diasMaturidadeNecessarios: 21,
          },
          {
            janelaDias: 14,
            diasMaturidadeNecessarios: 28,
          },
          {
            janelaDias: 30,
            diasMaturidadeNecessarios: 44,
          },
        ]);
      }
    );

    test(
      "retorna Sem base por contrato quando não há denominador",
      () => {
        const janela =
          service.criarJanelaMonetizacao(
            [],
            30,
            new Date(
              "2026-08-29T00:00:00.000Z"
            ),
            CONFIGURACAO
          );

        expect(janela.profissionaisMaduros)
          .toBe(0);
        expect(janela.taxaAssinaturaBaseMadura)
          .toBeNull();
        expect(janela.taxaAssinaturaEntrePrimeiro)
          .toBeNull();
        expect(janela.taxaAssinaturaEntreSegundo)
          .toBeNull();
        expect(janela.taxaAssinaturaEntreTerceiro)
          .toBeNull();
        expect(janela.baseAbaixoReguaOperacional)
          .toBe(true);
      }
    );

    test(
      "preserva o contrato da recorrência e acrescenta metodologia de monetização",
      () => {
        const resultado =
          service
            .enriquecerRecorrenciaComMonetizacao({
              recorrencia: {
                periodo: "30",
                qualidadeCampanhasOficiais: [
                  {
                    chave: "campanha:10",
                    campanhaOficialId: "10",
                    campanha:
                      "google_ads_profissionais",
                  },
                ],
                metodologia: {
                  unidade: "profissional",
                },
              },
              linhasRecorrencia: [
                linhaBase(),
              ],
              agora: new Date(
                "2026-08-29T00:00:00.000Z"
              ),
              configuracao: CONFIGURACAO,
            });

        expect(resultado.periodo).toBe("30");
        expect(
          resultado.qualidadeCampanhasOficiais[0]
            .monetizacaoRecorrencia
        ).toHaveLength(3);
        expect(
          resultado
            .diagnosticoMonetizacaoRecorrencia
        ).toMatchObject({
          diasMaturacaoAtivacao: 14,
          diasMaturacaoMonetizacao: 21,
          minimoCadastros: 10,
        });
        expect(
          resultado.metodologia
            .monetizacaoRecorrencia
        ).toMatch(/não provam causalidade/i);
        expect(
          resultado.metodologia
            .monetizacaoRecorrencia
        ).toMatch(/primeiro pagamento/i);
      }
    );
  }
);
