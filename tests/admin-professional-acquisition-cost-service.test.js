const {
  criarCustosRecorrenciaMadura,
  criarDiagnosticoMedicao,
  enriquecerCampanhas,
  enriquecerRecorrencia,
} = require(
  "../src/services/adminProfessionalAcquisitionCostService"
);

function campanhaBase() {
  return {
    chave: "campanha:10",
    campanhaOficialId: "10",
    origem: "google",
    midia: "cpc",
    campanha: "google_ads_profissionais",
    metodosResolucao: ["utm_exata"],
    profissionais: 4,
    comPrimeiroAgendamento: 3,
    taxaPrimeiroSobreProfissionais: 75,
    comSegundoAgendamento: 2,
    taxaSegundoSobrePrimeiro: 66.67,
    comTerceiroAgendamento: 1,
    taxaTerceiroSobrePrimeiro: 33.33,
    janelasCandidatas: [
      {
        janelaDias: 7,
        elegiveis: 3,
        comSegundoNaJanela: 2,
        taxaSegundoNaJanela: 66.67,
        comTerceiroNaJanela: 1,
        taxaTerceiroNaJanela: 33.33,
      },
    ],
  };
}

function linhaOficial({
  atribuicao,
  primeiro,
  segundo,
  terceiro = null,
} = {}) {
  return {
    classificacao_atribuicao: "oficial",
    campanha_oficial_id: "10",
    atribuicao_em: atribuicao,
    primeiro_agendamento_em: primeiro,
    segundo_agendamento_em: segundo,
    terceiro_agendamento_em: terceiro,
  };
}

describe(
  "adminProfessionalAcquisitionCostService",
  () => {
    test(
      "calcula custo observado simples sem misturar custo de recorrencia madura",
      () => {
        const campanhas = enriquecerCampanhas({
          qualidadeCampanhasOficiais: [
            campanhaBase(),
          ],
          qualidadeAquisicao: [
            {
              classificacaoAtribuicao: "oficial",
              profissionais: 4,
            },
            {
              classificacaoAtribuicao:
                "rastreamento_incompleto",
              profissionais: 1,
            },
            {
              classificacaoAtribuicao:
                "sem_evidencia",
              profissionais: 2,
            },
          ],
          investimentos: [
            {
              campanha_id: "10",
              investimento_centavos: "12000",
              dias_com_gasto: 3,
              utm_source: "google",
              utm_medium: "cpc",
              utm_campaign:
                "google_ads_profissionais",
            },
          ],
        });

        expect(campanhas).toHaveLength(1);
        expect(campanhas[0])
          .toMatchObject({
            campanhaOficialId: "10",
            investimentoCentavos: 12000,
            diasComGasto: 3,
            profissionais: 4,
            comPrimeiroAgendamento: 3,
            custoObservadoPorProfissionalCentavos: 3000,
            custoObservadoPrimeiroAgendamentoCentavos: 4000,
            leituraCusto:
              "observado_medicao_incompleta",
            medicaoCusto: {
              profissionaisOficiais: 4,
              pagosSemAtribuicaoOficial: 1,
              profissionaisSemEvidencia: 2,
              coberturaAtribuicaoPaga: 80,
              medicaoIncompleta: true,
            },
          });
        expect(
          campanhas[0]
            .custoObservadoPorRecorrenteCentavos
        ).toBeUndefined();
        expect(
          campanhas[0].janelasCandidatas[0]
            .taxaSegundoNaJanela
        ).toBe(66.67);
      }
    );

    test(
      "mantem visivel campanha com gasto e zero profissionais atribuidos",
      () => {
        const campanhas = enriquecerCampanhas({
          qualidadeCampanhasOficiais: [],
          qualidadeAquisicao: [],
          investimentos: [
            {
              campanha_id: 20,
              campanha_nome: "Meta profissionais",
              canal: "meta",
              utm_source: "meta",
              utm_medium: "cpc",
              utm_campaign: "meta_profissionais",
              investimento_centavos: "8000",
              dias_com_gasto: "2",
            },
          ],
        });

        expect(campanhas).toHaveLength(1);
        expect(campanhas[0])
          .toMatchObject({
            campanhaOficialId: "20",
            origem: "meta",
            campanha: "meta_profissionais",
            profissionais: 0,
            investimentoCentavos: 8000,
            custoObservadoPorProfissionalCentavos: null,
            custoObservadoPrimeiroAgendamentoCentavos: null,
            leituraCusto:
              "investimento_sem_profissional_atribuido",
          });
      }
    );

    test(
      "distingue campanha atribuida sem gasto registrado",
      () => {
        const campanhas = enriquecerCampanhas({
          qualidadeCampanhasOficiais: [
            campanhaBase(),
          ],
          qualidadeAquisicao: [
            {
              classificacaoAtribuicao: "oficial",
              profissionais: 4,
            },
            {
              classificacaoAtribuicao: "organico",
              profissionais: 2,
            },
          ],
          investimentos: [],
        });

        expect(campanhas[0])
          .toMatchObject({
            investimentoCentavos: 0,
            custoObservadoPorProfissionalCentavos: null,
            custoObservadoPrimeiroAgendamentoCentavos: null,
            leituraCusto:
              "sem_investimento_registrado",
            medicaoCusto: {
              coberturaAtribuicaoPaga: 100,
              medicaoIncompleta: false,
            },
          });
      }
    );

    test(
      "alinha gasto e profissionais na base madura de D7 e respeita a fronteira de D14",
      () => {
        const custos =
          criarCustosRecorrenciaMadura({
            campanha: campanhaBase(),
            agora:
              new Date(
                "2026-08-29T12:00:00.000Z"
              ),
            configuracao: {
              minimoCadastros: 2,
              coberturaMinimaPercentual: 100,
              diasMaturacaoAtivacao: 14,
            },
            medicao: {
              coberturaAtribuicaoPaga: 100,
              profissionaisSemEvidencia: 0,
            },
            investimentosDiarios: [
              {
                campanha_id: "10",
                data_gasto: "2026-08-01",
                idade_dias: 28,
                investimento_centavos: "6000",
              },
              {
                campanha_id: "10",
                data_gasto: "2026-08-20",
                idade_dias: 9,
                investimento_centavos: "4000",
              },
            ],
            linhasRecorrencia: [
              linhaOficial({
                atribuicao:
                  "2026-08-01T14:00:00.000Z",
                primeiro:
                  "2026-08-05T14:00:00.000Z",
                segundo:
                  "2026-08-10T14:00:00.000Z",
                terceiro:
                  "2026-08-13T14:00:00.000Z",
              }),
              linhaOficial({
                atribuicao:
                  "2026-08-01T18:00:00.000Z",
                primeiro:
                  "2026-08-10T18:00:00.000Z",
                segundo:
                  "2026-08-18T18:00:00.000Z",
              }),
              linhaOficial({
                atribuicao:
                  "2026-08-20T14:00:00.000Z",
                primeiro:
                  "2026-08-21T14:00:00.000Z",
                segundo:
                  "2026-08-22T14:00:00.000Z",
              }),
            ],
          });

        const d7 = custos.find(
          (item) => item.janelaDias === 7
        );
        const d14 = custos.find(
          (item) => item.janelaDias === 14
        );

        expect(d7).toMatchObject({
          diasMaturacaoAtivacao: 14,
          diasNecessarios: 21,
          investimentoMaduroCentavos: 6000,
          diasMadurosComGasto: 1,
          profissionaisMadurosComGasto: 2,
          profissionaisMadurosSemGasto: 0,
          comPrimeiroNaAtivacao: 2,
          comSegundoNaJanela: 1,
          comTerceiroNaJanela: 0,
          custoObservadoPrimeiroMaduroCentavos: 3000,
          custoObservadoSegundoMaduroCentavos: 6000,
          custoObservadoTerceiroMaduroCentavos: null,
          baseComparavel: true,
          leitura: "base_madura_comparavel",
        });
        expect(d14).toMatchObject({
          diasNecessarios: 28,
          investimentoMaduroCentavos: 0,
          diasMadurosComGasto: 0,
          profissionaisMadurosComGasto: 0,
          leitura: "aguardando_gasto_maduro",
          baseComparavel: false,
        });
      }
    );

    test(
      "bloqueia comparacao quando existe profissional maduro em dia sem gasto registrado",
      () => {
        const custos =
          criarCustosRecorrenciaMadura({
            campanha: campanhaBase(),
            agora:
              new Date(
                "2026-08-29T12:00:00.000Z"
              ),
            configuracao: {
              minimoCadastros: 1,
              coberturaMinimaPercentual: 100,
              diasMaturacaoAtivacao: 14,
            },
            medicao: {
              coberturaAtribuicaoPaga: 100,
              profissionaisSemEvidencia: 0,
            },
            investimentosDiarios: [
              {
                campanha_id: "10",
                data_gasto: "2026-08-01",
                idade_dias: 28,
                investimento_centavos: 5000,
              },
            ],
            linhasRecorrencia: [
              linhaOficial({
                atribuicao:
                  "2026-08-01T14:00:00.000Z",
                primeiro:
                  "2026-08-02T14:00:00.000Z",
                segundo:
                  "2026-08-04T14:00:00.000Z",
              }),
              linhaOficial({
                atribuicao:
                  "2026-07-30T14:00:00.000Z",
                primeiro:
                  "2026-08-01T14:00:00.000Z",
                segundo:
                  "2026-08-03T14:00:00.000Z",
              }),
            ],
          });

        expect(custos[0]).toMatchObject({
          janelaDias: 7,
          profissionaisMadurosComGasto: 1,
          profissionaisMadurosSemGasto: 1,
          baseComparavel: false,
          leitura:
            "cobertura_custo_incompleta",
        });
      }
    );

    test(
      "reutiliza as reguas de atribuicao e tamanho minimo antes de liberar comparacao madura",
      () => {
        const base = {
          campanha: campanhaBase(),
          agora:
            new Date(
              "2026-08-29T12:00:00.000Z"
            ),
          investimentosDiarios: [
            {
              campanha_id: "10",
              data_gasto: "2026-08-01",
              idade_dias: 28,
              investimento_centavos: 5000,
            },
          ],
          linhasRecorrencia: [
            linhaOficial({
              atribuicao:
                "2026-08-01T14:00:00.000Z",
              primeiro:
                "2026-08-02T14:00:00.000Z",
              segundo:
                "2026-08-03T14:00:00.000Z",
            }),
          ],
        };

        const atribuicaoIncompleta =
          criarCustosRecorrenciaMadura({
            ...base,
            configuracao: {
              minimoCadastros: 1,
              coberturaMinimaPercentual: 100,
              diasMaturacaoAtivacao: 14,
            },
            medicao: {
              coberturaAtribuicaoPaga: 80,
              profissionaisSemEvidencia: 0,
            },
          });

        expect(atribuicaoIncompleta[0])
          .toMatchObject({
            baseComparavel: false,
            leitura:
              "atribuicao_paga_incompleta",
          });

        const amostraPequena =
          criarCustosRecorrenciaMadura({
            ...base,
            configuracao: {
              minimoCadastros: 2,
              coberturaMinimaPercentual: 100,
              diasMaturacaoAtivacao: 14,
            },
            medicao: {
              coberturaAtribuicaoPaga: 100,
              profissionaisSemEvidencia: 0,
            },
          });

        expect(amostraPequena[0])
          .toMatchObject({
            minimoCadastros: 2,
            baseComparavel: false,
            leitura: "amostra_madura_pequena",
          });
      }
    );

    test(
      "preserva o contrato da recorrencia e documenta a metodologia madura",
      () => {
        const resultado = enriquecerRecorrencia({
          recorrencia: {
            periodo: "30",
            resumo: {
              comPrimeiroAgendamento: 3,
            },
            qualidadeAquisicao: [
              {
                classificacaoAtribuicao: "oficial",
                profissionais: 4,
              },
            ],
            qualidadeCampanhasOficiais: [
              campanhaBase(),
            ],
            metodologia: {
              unidade: "profissional",
            },
          },
          linhasRecorrencia: [],
          investimentos: [
            {
              campanha_id: 10,
              investimento_centavos: 12000,
              dias_com_gasto: 3,
            },
          ],
          investimentosDiarios: [],
          configuracao: {
            minimoCadastros: 10,
            coberturaMinimaPercentual: 100,
            diasMaturacaoAtivacao: 14,
          },
        });

        expect(resultado.periodo).toBe("30");
        expect(
          resultado.resumo.comPrimeiroAgendamento
        ).toBe(3);
        expect(
          resultado.qualidadeCampanhasOficiais[0]
            .custoObservadoPorProfissionalCentavos
        ).toBe(3000);
        expect(
          resultado.qualidadeCampanhasOficiais[0]
            .custosRecorrenciaMadura
        ).toHaveLength(3);
        expect(
          resultado.metodologia.custos
        ).toMatch(/não CAC ou ROAS/i);
        expect(
          resultado.metodologia.custosRecorrencia
        ).toMatch(/dias completos de gasto/i);
        expect(
          resultado.metodologia.custosRecorrencia
        ).toMatch(/14 dias de ativação/i);
      }
    );

    test(
      "calcula cobertura somente sobre sinais pagos classificaveis",
      () => {
        expect(
          criarDiagnosticoMedicao([
            {
              classificacaoAtribuicao: "oficial",
              profissionais: 6,
            },
            {
              classificacaoAtribuicao:
                "identidade_nao_oficial",
              profissionais: 2,
            },
            {
              classificacaoAtribuicao: "organico",
              profissionais: 5,
            },
          ])
        ).toMatchObject({
          profissionaisOficiais: 6,
          profissionaisOrganicos: 5,
          pagosSemAtribuicaoOficial: 2,
          coberturaAtribuicaoPaga: 75,
          medicaoIncompleta: true,
        });
      }
    );
  }
);
