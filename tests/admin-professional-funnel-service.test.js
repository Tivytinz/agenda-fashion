jest.mock(
  "../src/repositories/adminProfessionalFunnelRepository",
  () => ({
    periodoSeguro:
      jest.fn((value) => value || "30"),
    listarPorCampanha:
      jest.fn(),
  })
);

const repository = require(
  "../src/repositories/adminProfessionalFunnelRepository"
);

const service = require(
  "../src/services/adminProfessionalFunnelService"
);

describe(
  "funil profissional administrativo",
  () => {
    beforeEach(() => {
      jest.clearAllMocks();
    });

    test(
      "calcula conversões, custos, receita, ROAS e decisão",
      async () => {
        repository.listarPorCampanha
          .mockResolvedValue([
            {
              origem: "meta",
              midia: "cpc",
              campanha: "profissionais_goiania",
              cadastros: "20",
              negocios_criados: "12",
              servicos_criados: "10",
              agendas_configuradas: "8",
              negocios_publicados: "7",
              checkouts_iniciados: "5",
              assinaturas_ativadas: "4",
              investimento_centavos: "40000",
              receita_primeiro_pagamento_centavos:
                "59600",
            },
          ]);

        const resultado =
          await service.buscarFunil({
            periodo: "30",
          });

        expect(
          resultado.campanhas[0]
        ).toMatchObject({
          cadastros: 20,
          negociosCriados: 12,
          assinaturasAtivadas: 4,
          taxaNegocio: 60,
          taxaAssinatura: 20,
          custoCadastroCentavos: 2000,
          custoCheckoutCentavos: 8000,
          cacAssinanteCentavos: 10000,
          receitaPrimeiroPagamentoCentavos: 59600,
          roas: 1.49,
          decisao: {
            codigo: "escalar",
            rotulo: "Escalar",
            confianca: "alta",
          },
        });

        expect(
          resultado.resumo
        ).toMatchObject({
          cadastros: 20,
          assinaturasAtivadas: 4,
          investimentoCentavos: 40000,
          custoCadastroCentavos: 2000,
          custoCheckoutCentavos: 8000,
          cacAssinanteCentavos: 10000,
          receitaPrimeiroPagamentoCentavos: 59600,
          roas: 1.49,
        });

        expect(
          resultado.decisao
        ).toMatchObject({
          metaRoas: 1,
          faixaEscalaRoas: 1.2,
          minimoCadastros: 10,
          minimoAssinaturas: 2,
          contagem: {
            escalar: 1,
            manter: 0,
            observar: 0,
            revisar: 0,
            pausar: 0,
            semDados: 0,
          },
        });
      }
    );

    test(
      "consolida UTMs históricas do Google Ads com o investimento da campanha canônica",
      async () => {
        repository.listarPorCampanha
          .mockResolvedValue([
            {
              origem: "google",
              midia: "cpc",
              campanha: "aquisicao_profissionais",
              cadastros: 8,
              investimento_centavos: 0,
              receita_primeiro_pagamento_centavos: 0,
            },
            {
              origem: "google",
              midia: "cpc",
              campanha: "search_aquisicao_profissionais",
              cadastros: 4,
              investimento_centavos: 0,
              receita_primeiro_pagamento_centavos: 0,
            },
            {
              origem: "google",
              midia: "cpc",
              campanha: "google_ads_profissionais",
              cadastros: 0,
              investimento_centavos: 20000,
              receita_primeiro_pagamento_centavos: 0,
            },
            {
              origem: "organico",
              midia: "none",
              campanha: "organico",
              cadastros: 1,
              investimento_centavos: 0,
              receita_primeiro_pagamento_centavos: 0,
            },
          ]);

        const resultado = await service.buscarFunil({
          periodo: "30",
        });

        expect(resultado.campanhas).toHaveLength(2);

        const google = resultado.campanhas.find(
          (campanha) =>
            campanha.campanha === "google_ads_profissionais"
        );

        expect(google).toMatchObject({
          origem: "google",
          midia: "cpc",
          campanha: "google_ads_profissionais",
          cadastros: 12,
          investimentoCentavos: 20000,
          custoCadastroCentavos: 1667,
          consolidada: true,
          decisao: {
            codigo: "pausar",
            confianca: "media",
          },
        });
        expect(google.identidadesUtm).toEqual(
          expect.arrayContaining([
            {
              origem: "google",
              midia: "cpc",
              campanha: "aquisicao_profissionais",
            },
            {
              origem: "google",
              midia: "cpc",
              campanha: "search_aquisicao_profissionais",
            },
            {
              origem: "google",
              midia: "cpc",
              campanha: "google_ads_profissionais",
            },
          ])
        );
        expect(resultado.resumo).toMatchObject({
          cadastros: 13,
          investimentoCentavos: 20000,
          custoCadastroCentavos: 1538,
        });
      }
    );

    test(
      "não inventa CAC, ROAS ou decisão forte quando não existe investimento",
      async () => {
        repository.listarPorCampanha
          .mockResolvedValue([
            {
              origem: "organico",
              midia: "none",
              campanha: "organico",
              cadastros: 3,
              negocios_criados: 2,
              servicos_criados: 1,
              agendas_configuradas: 1,
              negocios_publicados: 1,
              checkouts_iniciados: 0,
              assinaturas_ativadas: 0,
              investimento_centavos: 0,
              receita_primeiro_pagamento_centavos: 0,
            },
          ]);

        const resultado =
          await service.buscarFunil({
            periodo: "all",
          });

        expect(
          resultado.campanhas[0]
            .custoCadastroCentavos
        ).toBeNull();

        expect(
          resultado.campanhas[0]
            .custoCheckoutCentavos
        ).toBeNull();

        expect(
          resultado.campanhas[0]
            .cacAssinanteCentavos
        ).toBeNull();

        expect(
          resultado.campanhas[0].roas
        ).toBeNull();

        expect(
          resultado.campanhas[0].decisao
        ).toMatchObject({
          codigo: "sem_dados",
          rotulo: "Sem investimento atribuído",
          confianca: "baixa",
        });
      }
    );

    test(
      "separa a coorte oficial de cadastros pagos sem campanha e orgânicos",
      async () => {
        repository.listarPorCampanha
          .mockResolvedValue([
            {
              origem: "google",
              midia: "cpc",
              campanha:
                "google_ads_profissionais",
              campanha_oficial_id: 9,
              classificacao_atribuicao:
                "oficial",
              cadastros: 7,
              negocios_criados: 6,
              servicos_criados: 5,
              agendas_configuradas: 2,
              negocios_publicados: 4,
              checkouts_iniciados: 0,
              assinaturas_ativadas: 0,
              investimento_centavos: 20000,
              receita_primeiro_pagamento_centavos: 0,
            },
            {
              origem: "google",
              midia: "cpc",
              campanha: "(sem campanha)",
              classificacao_atribuicao:
                "rastreamento_incompleto",
              cadastros: 6,
              negocios_criados: 5,
              servicos_criados: 2,
              agendas_configuradas: 0,
              negocios_publicados: 3,
              checkouts_iniciados: 0,
              assinaturas_ativadas: 0,
              investimento_centavos: 0,
              receita_primeiro_pagamento_centavos: 0,
            },
            {
              origem: "organico",
              midia: "none",
              campanha: "organico",
              classificacao_atribuicao:
                "organico",
              cadastros: 2,
              negocios_criados: 1,
              servicos_criados: 1,
              agendas_configuradas: 0,
              negocios_publicados: 0,
              checkouts_iniciados: 0,
              assinaturas_ativadas: 0,
              investimento_centavos: 0,
              receita_primeiro_pagamento_centavos: 0,
            },
          ]);

        const resultado =
          await service.buscarFunil({
            periodo: "30",
          });

        expect(resultado.resumo)
          .toMatchObject({
            cadastros: 15,
            investimentoCentavos: 20000,
            custoCadastroCentavos: 1333,
          });

        expect(resultado.resumoOficial)
          .toMatchObject({
            cadastros: 7,
            negociosPublicados: 4,
            investimentoCentavos: 20000,
            custoCadastroCentavos: 2857,
          });

        expect(
          resultado.campanhasOficiais
        ).toHaveLength(1);
        expect(
          resultado
            .diagnosticoAtribuicao
        ).toEqual({
          cadastrosOficiais: 7,
          cadastrosSemCampanha: 6,
          cadastrosIdentidadeNaoOficial: 0,
          cadastrosOrganicos: 2,
        });
        expect(
          resultado.decisao.contagem
        ).toMatchObject({
          observar: 1,
          semDados: 0,
        });
      }
    );

    test(
      "observa amostra pequena antes de recomendar escala ou pausa",
      () => {
        const decisao =
          service.recomendarCampanha(
            {
              investimentoCentavos: 15000,
              cadastros: 4,
              assinaturasAtivadas: 0,
              roas: 0,
            },
            {
              metaRoas: 1,
              multiplicadorEscala: 1.2,
              minimoCadastros: 10,
              minimoAssinaturas: 2,
            }
          );

        expect(decisao)
          .toMatchObject({
            codigo: "observar",
            confianca: "baixa",
          });
      }
    );

    test(
      "recomenda pausar quando a campanha tem amostra suficiente sem assinatura",
      () => {
        const decisao =
          service.recomendarCampanha(
            {
              investimentoCentavos: 40000,
              cadastros: 12,
              assinaturasAtivadas: 0,
              roas: 0,
            },
            {
              metaRoas: 1,
              multiplicadorEscala: 1.2,
              minimoCadastros: 10,
              minimoAssinaturas: 2,
            }
          );

        expect(decisao)
          .toMatchObject({
            codigo: "pausar",
            confianca: "media",
          });
      }
    );

    test(
      "distingue manter, revisar e pausar pela meta de ROAS depois do volume mínimo",
      () => {
        const configuracao = {
          metaRoas: 1,
          multiplicadorEscala: 1.2,
          minimoCadastros: 10,
          minimoAssinaturas: 2,
        };
        const base = {
          investimentoCentavos: 40000,
          cadastros: 20,
          assinaturasAtivadas: 3,
        };

        expect(
          service.recomendarCampanha(
            { ...base, roas: 1.1 },
            configuracao
          ).codigo
        ).toBe("manter");

        expect(
          service.recomendarCampanha(
            { ...base, roas: 0.8 },
            configuracao
          ).codigo
        ).toBe("revisar");

        expect(
          service.recomendarCampanha(
            { ...base, roas: 0.4 },
            configuracao
          ).codigo
        ).toBe("pausar");
      }
    );

    test(
      "permite configurar a régua de decisão sem expor regra ao frontend",
      () => {
        expect(
          service.configuracaoDecisao({
            MARKETING_DECISION_ROAS_TARGET:
              "1.5",
            MARKETING_DECISION_SCALE_MULTIPLIER:
              "1.3",
            MARKETING_DECISION_MIN_SIGNUPS:
              "20",
            MARKETING_DECISION_MIN_SUBSCRIPTIONS:
              "4",
          })
        ).toEqual({
          metaRoas: 1.5,
          multiplicadorEscala: 1.3,
          minimoCadastros: 20,
          minimoAssinaturas: 4,
        });
      }
    );
  }
);
