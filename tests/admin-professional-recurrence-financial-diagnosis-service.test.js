const {
  criarResumoDiagnostico,
  diagnosticarCampanha,
  enriquecerRecorrenciaComDiagnosticoExecutivo,
} = require(
  "../src/services/adminProfessionalRecurrenceFinancialDiagnosisService"
);

function campanhaComJanelas(janelas) {
  return {
    chave: "campanha:10",
    campanhaOficialId: "10",
    origem: "google",
    midia: "cpc",
    campanha: "google_ads_profissionais",
    prontidaoFinanceiraRecorrencia:
      janelas,
  };
}

function janela(
  janelaDias,
  codigo,
  pronta = false
) {
  return {
    janelaDias,
    prontaParaLeituraConjunta: pronta,
    leitura: {
      codigo,
    },
  };
}

describe(
  "adminProfessionalRecurrenceFinancialDiagnosisService",
  () => {
    test(
      "marca campanha com todas as janelas disponíveis sem inventar bloqueio",
      () => {
        const diagnostico =
          diagnosticarCampanha(
            campanhaComJanelas([
              janela(
                7,
                "leitura_conjunta_disponivel",
                true
              ),
              janela(
                14,
                "leitura_conjunta_disponivel",
                true
              ),
              janela(
                30,
                "leitura_conjunta_disponivel",
                true
              ),
            ])
          );

        expect(diagnostico)
          .toMatchObject({
            estado: {
              codigo:
                "todas_janelas_disponiveis",
            },
            janelasDisponiveis: [
              7,
              14,
              30,
            ],
            janelasBloqueadas: [],
            bloqueioPrincipal: null,
            bloqueios: [],
          });
      }
    );

    test(
      "consolida leitura parcial e preserva as janelas afetadas pelo mesmo bloqueio",
      () => {
        const diagnostico =
          diagnosticarCampanha(
            campanhaComJanelas([
              janela(
                7,
                "leitura_conjunta_disponivel",
                true
              ),
              janela(
                14,
                "aguardando_gasto_maduro"
              ),
              janela(
                30,
                "aguardando_gasto_maduro"
              ),
            ])
          );

        expect(diagnostico.estado.codigo)
          .toBe("leitura_parcial");
        expect(diagnostico.janelasDisponiveis)
          .toEqual([7]);
        expect(diagnostico.janelasBloqueadas)
          .toEqual([14, 30]);
        expect(diagnostico.bloqueioPrincipal)
          .toMatchObject({
            codigo:
              "aguardando_gasto_maduro",
            categoria: "maturidade",
            janelas: [14, 30],
          });
      }
    );

    test(
      "prioriza integridade e cobertura antes de maturidade e amostra sem usar resultado comercial",
      () => {
        const diagnostico =
          diagnosticarCampanha(
            campanhaComJanelas([
              janela(
                7,
                "amostra_madura_pequena"
              ),
              janela(
                14,
                "atribuicao_paga_incompleta"
              ),
              janela(
                30,
                "base_financeira_inconsistente"
              ),
            ])
          );

        expect(diagnostico.estado.codigo)
          .toBe("leitura_bloqueada");
        expect(
          diagnostico.bloqueioPrincipal.codigo
        ).toBe(
          "base_financeira_inconsistente"
        );
        expect(
          diagnostico.bloqueios.map(
            (bloqueio) => bloqueio.codigo
          )
        ).toEqual([
          "base_financeira_inconsistente",
          "atribuicao_paga_incompleta",
          "amostra_madura_pequena",
        ]);
      }
    );

    test(
      "resume campanhas e conta cada bloqueio uma vez por campanha com suas ocorrências de janela",
      () => {
        const campanhas = [
          diagnosticarCampanha(
            campanhaComJanelas([
              janela(
                7,
                "leitura_conjunta_disponivel",
                true
              ),
              janela(
                14,
                "aguardando_gasto_maduro"
              ),
              janela(
                30,
                "aguardando_gasto_maduro"
              ),
            ])
          ),
          diagnosticarCampanha({
            ...campanhaComJanelas([
              janela(
                7,
                "atribuicao_paga_incompleta"
              ),
              janela(
                14,
                "aguardando_gasto_maduro"
              ),
              janela(
                30,
                "aguardando_gasto_maduro"
              ),
            ]),
            chave: "campanha:20",
            campanhaOficialId: "20",
            origem: "meta",
            campanha: "meta_profissionais",
          }),
        ];
        const resumo =
          criarResumoDiagnostico(campanhas);

        expect(resumo)
          .toMatchObject({
            campanhas: 2,
            comLeituraCompleta: 0,
            comLeituraParcial: 1,
            bloqueadas: 1,
            semJanelas: 0,
          });
        expect(resumo.bloqueios)
          .toEqual(
            expect.arrayContaining([
              expect.objectContaining({
                codigo:
                  "atribuicao_paga_incompleta",
                campanhas: 1,
                ocorrenciasJanelas: 1,
              }),
              expect.objectContaining({
                codigo:
                  "aguardando_gasto_maduro",
                campanhas: 2,
                ocorrenciasJanelas: 4,
              }),
            ])
          );
      }
    );

    test(
      "adiciona o diagnóstico ao contrato sem alterar as campanhas originais",
      () => {
        const recorrencia = {
          periodo: "30",
          qualidadeCampanhasOficiais: [
            campanhaComJanelas([
              janela(
                7,
                "leitura_conjunta_disponivel",
                true
              ),
            ]),
          ],
        };

        const resultado =
          enriquecerRecorrenciaComDiagnosticoExecutivo({
            recorrencia,
          });

        expect(
          resultado.qualidadeCampanhasOficiais
        ).toBe(
          recorrencia.qualidadeCampanhasOficiais
        );
        expect(
          resultado
            .diagnosticoExecutivoProntidaoFinanceira
            .campanhas[0]
            .estado.codigo
        ).toBe(
          "todas_janelas_disponiveis"
        );
        expect(
          resultado
            .diagnosticoExecutivoProntidaoFinanceira
            .metodologia
        ).toMatch(
          /nenhuma campanha recebe recomendação automática de orçamento/i
        );
      }
    );
  }
);
