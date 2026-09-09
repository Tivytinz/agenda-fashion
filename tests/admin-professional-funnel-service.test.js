jest.mock(
  "../src/repositories/adminProfessionalFunnelRepository",
  () => ({
    periodoSeguro: jest.fn((value) => value || "30"),
    listarPorCampanha: jest.fn(),
  })
);

const repository = require(
  "../src/repositories/adminProfessionalFunnelRepository"
);
const service = require(
  "../src/services/adminProfessionalFunnelService"
);

function linhaBase(sobrescritas = {}) {
  return {
    origem: "meta",
    midia: "cpc",
    campanha: "profissionais_goiania",
    campanha_oficial_id: 7,
    classificacao_atribuicao: "oficial",
    cadastros: 20,
    negocios_criados: 12,
    servicos_criados: 10,
    negocios_publicados: 8,
    primeiros_agendamentos: 6,
    checkouts_iniciados: 5,
    assinaturas_ativadas: 4,
    cadastros_maduros_ativacao: 20,
    cadastros_maduros_monetizacao: 20,
    negocios_publicados_maduros_ativacao: 8,
    primeiros_agendamentos_maduros_ativacao: 6,
    assinaturas_ativadas_maduras_monetizacao: 4,
    investimento_centavos: 40000,
    receita_primeiro_pagamento_centavos: 59600,
    ...sobrescritas,
  };
}

describe("funil profissional administrativo", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("calcula somente os marcos canônicos sem agenda", async () => {
    repository.listarPorCampanha.mockResolvedValue([linhaBase()]);

    const resultado = await service.buscarFunil({ periodo: "30" });
    const campanha = resultado.campanhas[0];

    expect(campanha).toMatchObject({
      cadastros: 20,
      negociosCriados: 12,
      servicosCriados: 10,
      negociosPublicados: 8,
      primeirosAgendamentos: 6,
      checkoutsIniciados: 5,
      assinaturasAtivadas: 4,
      taxaNegocio: 60,
      taxaServico: 50,
      taxaPublicacao: 40,
      taxaPrimeiroAgendamento: 30,
      taxaCheckout: 25,
      taxaAssinatura: 20,
      custoCadastroCentavos: 2000,
      custoCheckoutCentavos: 8000,
      cacAssinanteCentavos: 10000,
      receitaPrimeiroPagamentoCentavos: 59600,
      roas: 1.49,
      decisao: expect.objectContaining({
        codigo: "escalar",
      }),
    });

    expect(campanha).not.toHaveProperty("agendasConfiguradas");
    expect(campanha).not.toHaveProperty("taxaAgenda");
    expect(campanha).not.toHaveProperty("taxaDivulgacaoPosAgenda");
    expect(resultado.resumo).not.toHaveProperty("agendasConfiguradas");
  });

  test("consolida aliases históricos do Google Ads na campanha canônica", async () => {
    repository.listarPorCampanha.mockResolvedValue([
      linhaBase({
        origem: "google",
        campanha: "aquisicao_profissionais",
        campanha_oficial_id: 7,
        classificacao_atribuicao: "oficial",
        cadastros: 8,
        investimento_centavos: 0,
      }),
      linhaBase({
        origem: "google",
        campanha: "search_aquisicao_profissionais",
        campanha_oficial_id: 7,
        classificacao_atribuicao: "oficial",
        cadastros: 4,
        investimento_centavos: 0,
      }),
      linhaBase({
        origem: "google",
        campanha: "google_ads_profissionais",
        cadastros: 0,
        negocios_criados: 0,
        servicos_criados: 0,
        negocios_publicados: 0,
        primeiros_agendamentos: 0,
        checkouts_iniciados: 0,
        assinaturas_ativadas: 0,
        cadastros_maduros_ativacao: 0,
        cadastros_maduros_monetizacao: 0,
        negocios_publicados_maduros_ativacao: 0,
        primeiros_agendamentos_maduros_ativacao: 0,
        assinaturas_ativadas_maduras_monetizacao: 0,
        investimento_centavos: 20000,
        receita_primeiro_pagamento_centavos: 0,
      }),
    ]);

    const resultado = await service.buscarFunil({ periodo: "30" });
    expect(resultado.campanhas).toHaveLength(1);
    expect(resultado.campanhas[0]).toMatchObject({
      origem: "google",
      midia: "cpc",
      campanha: "google_ads_profissionais",
      cadastros: 12,
      investimentoCentavos: 20000,
      consolidada: true,
    });
    expect(resultado.campanhas[0].identidadesUtm).toHaveLength(3);
  });

  test("mantém orgânico separado de registros sem evidência", () => {
    const linhas = service.consolidarLinhasCampanha([
      {
        origem: "organico",
        midia: "none",
        campanha: "organico",
        classificacao_atribuicao: "organico",
        cadastros: 2,
      },
      {
        origem: "organico",
        midia: "none",
        campanha: "organico",
        classificacao_atribuicao: "sem_evidencia",
        cadastros: 1,
      },
    ]);

    expect(linhas).toHaveLength(2);
  });

  test("não mistura aliases sem evidência com o investimento oficial", async () => {
    repository.listarPorCampanha.mockResolvedValue([
      linhaBase({ origem: "google", campanha: "aquisicao_profissionais", campanha_oficial_id: null, classificacao_atribuicao: null, investimento_centavos: 0 }),
      linhaBase({ origem: "google", campanha: "google_ads_profissionais" })
    ]);
    const resultado = await service.buscarFunil({ periodo: "30" });
    expect(resultado.campanhas).toHaveLength(2);
    const semEvidencia = resultado.campanhas.find((campanha) => !campanha.oficial);
    expect(semEvidencia.cacAssinanteCentavos).toBeNull();
    expect(semEvidencia.investimentoCentavos).toBe(0);
    expect(resultado.qualidadeMensuracao.prontaParaDecisao).toBe(false);
  });

  test("não inventa CAC ou ROAS quando não há investimento", async () => {
    repository.listarPorCampanha.mockResolvedValue([
      linhaBase({
        origem: "organico",
        midia: "none",
        campanha: "organico",
        campanha_oficial_id: null,
        classificacao_atribuicao: "organico",
        cadastros: 3,
        investimento_centavos: 0,
        receita_primeiro_pagamento_centavos: 0,
      }),
    ]);

    const resultado = await service.buscarFunil({ periodo: "all" });
    const campanha = resultado.campanhas[0];

    expect(campanha.custoCadastroCentavos).toBeNull();
    expect(campanha.custoCheckoutCentavos).toBeNull();
    expect(campanha.cacAssinanteCentavos).toBeNull();
    expect(campanha.roas).toBeNull();
    expect(campanha.decisao.codigo).toBe("sem_dados");
  });

  test("bloqueia decisão financeira quando a atribuição paga está incompleta", async () => {
    repository.listarPorCampanha.mockResolvedValue([
      linhaBase({
        classificacao_atribuicao: "oficial",
        cadastros: 7,
        investimento_centavos: 20000,
      }),
      linhaBase({
        campanha: "(sem campanha)",
        campanha_oficial_id: null,
        classificacao_atribuicao: "rastreamento_incompleto",
        cadastros: 6,
        investimento_centavos: 0,
      }),
    ]);

    const resultado = await service.buscarFunil({ periodo: "30" });

    expect(resultado.qualidadeMensuracao).toMatchObject({
      coberturaAtribuicaoPagaPercentual: 53.85,
      prontaParaDecisao: false,
    });
    expect(resultado.campanhasOficiais[0].decisao.codigo)
      .toBe("mensuracao_incompleta");
  });

  test("aguarda maturidade de ativação antes de julgar uma coorte recente", () => {
    const decisao = service.recomendarCampanha(
      {
        investimentoCentavos: 40000,
        cadastros: 20,
        assinaturasAtivadas: 0,
        cadastrosMadurosAtivacao: 4,
        cadastrosMadurosMonetizacao: 0,
        roas: 0,
      },
      {
        metaRoas: 1,
        multiplicadorEscala: 1.2,
        minimoCadastros: 10,
        minimoAssinaturas: 2,
        diasMaturacaoAtivacao: 14,
        diasMaturacaoMonetizacao: 21,
      }
    );

    expect(decisao).toMatchObject({
      codigo: "observar",
      rotulo: "Aguardar maturidade",
    });
  });

  test("revisa ativação quando coorte madura publica mas não recebe primeiro agendamento", () => {
    const decisao = service.recomendarCampanha(
      {
        investimentoCentavos: 40000,
        cadastros: 12,
        assinaturasAtivadas: 0,
        cadastrosMadurosAtivacao: 12,
        cadastrosMadurosMonetizacao: 12,
        negociosPublicadosMadurosAtivacao: 8,
        primeirosAgendamentosMadurosAtivacao: 0,
        assinaturasAtivadasMadurasMonetizacao: 0,
        roas: 0,
      },
      {
        metaRoas: 1,
        multiplicadorEscala: 1.2,
        minimoCadastros: 10,
        minimoAssinaturas: 2,
        diasMaturacaoAtivacao: 14,
        diasMaturacaoMonetizacao: 21,
      }
    );

    expect(decisao).toMatchObject({
      codigo: "revisar",
      rotulo: "Revisar ativação",
    });
  });
});
