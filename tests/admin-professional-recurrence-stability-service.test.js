const {
  criarDiagnosticoEstabilidade,
} = require(
  "../src/services/adminProfessionalRecurrenceStabilityService"
);

function janela({
  janelaDias,
  elegiveis,
  taxaSegundoNaJanela,
  taxaTerceiroNaJanela,
}) {
  return {
    janelaDias,
    elegiveis,
    taxaSegundoNaJanela,
    taxaTerceiroNaJanela,
  };
}

describe(
  "adminProfessionalRecurrenceStabilityService",
  () => {
    test(
      "compara somente coortes maduras e ordena a base recente",
      () => {
        const resultado =
          criarDiagnosticoEstabilidade(
            [
              {
                semanaCadastro: "2026-08-11",
                janelasCandidatas: [
                  janela({
                    janelaDias: 7,
                    elegiveis: 4,
                    taxaSegundoNaJanela: 50,
                    taxaTerceiroNaJanela: 25,
                  }),
                  janela({
                    janelaDias: 14,
                    elegiveis: 2,
                    taxaSegundoNaJanela: 50,
                    taxaTerceiroNaJanela: 0,
                  }),
                  janela({
                    janelaDias: 30,
                    elegiveis: 0,
                    taxaSegundoNaJanela: 0,
                    taxaTerceiroNaJanela: 0,
                  }),
                ],
              },
              {
                semanaCadastro: "2026-08-18",
                janelasCandidatas: [
                  janela({
                    janelaDias: 7,
                    elegiveis: 3,
                    taxaSegundoNaJanela: 66.67,
                    taxaTerceiroNaJanela: 33.33,
                  }),
                  janela({
                    janelaDias: 14,
                    elegiveis: 0,
                    taxaSegundoNaJanela: 0,
                    taxaTerceiroNaJanela: 0,
                  }),
                  janela({
                    janelaDias: 30,
                    elegiveis: 0,
                    taxaSegundoNaJanela: 0,
                    taxaTerceiroNaJanela: 0,
                  }),
                ],
              },
            ]
          );

        expect(resultado).toEqual([
          {
            janelaDias: 7,
            estado: "comparacao_disponivel",
            coortesComBase: 2,
            elegiveisTotal: 7,
            faixaTaxaSegundo: {
              minimo: 50,
              maximo: 66.67,
              amplitudePp: 16.67,
            },
            faixaTaxaTerceiro: {
              minimo: 25,
              maximo: 33.33,
              amplitudePp: 8.33,
            },
            variacaoRecenteSegundoPp: 16.67,
            variacaoRecenteTerceiroPp: 8.33,
            semanaMaisRecenteComBase:
              "2026-08-18",
            semanaAnteriorComBase:
              "2026-08-11",
          },
          {
            janelaDias: 14,
            estado: "uma_coorte_madura",
            coortesComBase: 1,
            elegiveisTotal: 2,
            faixaTaxaSegundo: {
              minimo: 50,
              maximo: 50,
              amplitudePp: 0,
            },
            faixaTaxaTerceiro: {
              minimo: 0,
              maximo: 0,
              amplitudePp: 0,
            },
            variacaoRecenteSegundoPp: null,
            variacaoRecenteTerceiroPp: null,
            semanaMaisRecenteComBase:
              "2026-08-11",
            semanaAnteriorComBase: null,
          },
          {
            janelaDias: 30,
            estado: "sem_base_madura",
            coortesComBase: 0,
            elegiveisTotal: 0,
            faixaTaxaSegundo: {
              minimo: null,
              maximo: null,
              amplitudePp: null,
            },
            faixaTaxaTerceiro: {
              minimo: null,
              maximo: null,
              amplitudePp: null,
            },
            variacaoRecenteSegundoPp: null,
            variacaoRecenteTerceiroPp: null,
            semanaMaisRecenteComBase: null,
            semanaAnteriorComBase: null,
          },
        ]);
      }
    );

    test(
      "nao inventa comparacao quando nao existe base",
      () => {
        const [d7] =
          criarDiagnosticoEstabilidade(
            [],
            [7]
          );

        expect(d7).toMatchObject({
          estado: "sem_base_madura",
          coortesComBase: 0,
          elegiveisTotal: 0,
          variacaoRecenteSegundoPp: null,
          variacaoRecenteTerceiroPp: null,
        });
      }
    );
  }
);
