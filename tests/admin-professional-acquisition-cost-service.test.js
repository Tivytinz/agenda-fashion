const {
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

describe(
  "adminProfessionalAcquisitionCostService",
  () => {
    test(
      "calcula custo observado sem chamar de custo por recorrente",
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
      "preserva o contrato da recorrencia e adiciona metodologia de custo",
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
          investimentos: [
            {
              campanha_id: 10,
              investimento_centavos: 12000,
              dias_com_gasto: 3,
            },
          ],
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
          resultado.metodologia.custos
        ).toMatch(/não são CAC ou ROAS/i);
        expect(
          resultado.metodologia.custos
        ).toMatch(/não é calculado custo por recorrente/i);
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
