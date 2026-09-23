jest.mock(
  "../src/repositories/adminAnalyticsV2Repository",
  () => ({
    periodoSeguro: jest.fn((periodo) => periodo || "30"),
    buscarReceita: jest.fn(),
    buscarVisaoGeral: jest.fn(),
    listarAquisicao: jest.fn(),
    buscarJornada: jest.fn(),
  })
);

jest.mock(
  "../src/services/adminProfessionalFunnelService",
  () => ({
    buscarFunil: jest.fn(),
  })
);

jest.mock(
  "../src/services/adminProfessionalRecurrenceService",
  () => ({
    buscarRecorrencia: jest.fn(),
  })
);

const repository = require(
  "../src/repositories/adminAnalyticsV2Repository"
);
const service = require(
  "../src/services/adminAnalyticsV2Service"
);

describe("Admin Analytics V2 - receita", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("calcula checkout para assinatura com a mesma coorte de negócios", async () => {
    repository.buscarReceita.mockResolvedValue({
      periodo: "30",
      resumo: {
        checkouts_iniciados: 10,
        checkouts_concluidos: 7,
        checkouts_falhos: 2,
        negocios_com_checkout: 4,
        negocios_checkout_convertidos: 1,
        pagamentos_confirmados: 12,
        negocios_pagantes: 6,
        novas_assinaturas_pagas: 9,
        assinaturas_pagas_ativas: 8,
        receita_total: "1190.10",
        receita_bruta: "1290.00",
        pagamentos_em_reversao: 2,
        valor_exposto_reversoes: "149.80",
        receita_primeiro_pagamento: "870.00",
      },
      planos: [],
    });

    const resultado = await service.buscarRevenue("30");

    expect(resultado.resumo).toMatchObject({
      checkoutsIniciados: 10,
      negociosComCheckoutCohorte: 4,
      negociosCheckoutConvertidos: 1,
      conversaoCheckoutParaAssinaturaPaga: 25,
      novasAssinaturasPagas: 9,
      receitaBruta: 1290,
      receitaValidaAtual: 1190.1,
      pagamentosEmReversao: 2,
      valorExpostoReversoes: 149.8,
    });

    expect(
      resultado.resumo.conversaoCheckoutParaAssinaturaPaga
    ).not.toBe(90);
  });

  test("separa conversão inicial, renovação e mudança de plano sem chamar atraso de churn", async () => {
    repository.buscarReceita.mockResolvedValue({
      periodo: "30",
      resumo: {
        receita_total: "249.60",
        novos_negocios_pagantes: 1,
        receita_primeira_conversao: "49.90",
        pagamentos_renovacao: 2,
        negocios_com_renovacao: 1,
        receita_renovacao: "99.80",
        pagamentos_mudanca_plano: 1,
        negocios_com_mudanca_plano: 1,
        receita_mudanca_plano: "99.90",
        renovacoes_previstas: 3,
        renovacoes_confirmadas: 2,
        renovacoes_com_atraso: 2,
        renovacoes_recuperadas: 1,
        cancelamentos_renovacao_agendados: 1,
        assinaturas_encerradas_apos_cancelamento: 1,
      },
      planos: [],
    });

    const resultado = await service.buscarRevenue("30");

    expect(resultado.resumo).toMatchObject({
      novosNegociosPagantes: 1,
      receitaPrimeiraConversao: 49.9,
      pagamentosRenovacao: 2,
      negociosComRenovacao: 1,
      receitaRenovacao: 99.8,
      pagamentosMudancaPlano: 1,
      negociosComMudancaPlano: 1,
      receitaMudancaPlano: 99.9,
      renovacoesPrevistas: 3,
      renovacoesConfirmadas: 2,
      taxaRenovacao: 66.67,
      renovacoesComAtraso: 2,
      renovacoesRecuperadas: 1,
      taxaRecuperacaoRenovacao: 50,
      cancelamentosRenovacaoAgendados: 1,
      assinaturasEncerradasAposCancelamento: 1,
    });
    expect(resultado.metodologia.retencaoFinanceira)
      .toMatch(/não constituem uma definição oficial de churn/i);
  });

  test("não inventa conversão quando a coorte de checkout está vazia", async () => {
    repository.buscarReceita.mockResolvedValue({
      periodo: "7",
      resumo: {
        checkouts_iniciados: 0,
        negocios_com_checkout: 0,
        negocios_checkout_convertidos: 0,
        novas_assinaturas_pagas: 2,
      },
      planos: [],
    });

    const resultado = await service.buscarRevenue("7");

    expect(
      resultado.resumo.conversaoCheckoutParaAssinaturaPaga
    ).toBeNull();
    expect(resultado.resumo.novasAssinaturasPagas).toBe(2);
  });
});
