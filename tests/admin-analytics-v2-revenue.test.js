jest.mock(
  "../src/repositories/adminAnalyticsV2Repository",
  () => ({
    periodoSeguro: jest.fn((periodo) => periodo || "30"),
    buscarReceita: jest.fn(),
    buscarChurnPago: jest.fn(),
    buscarMrr: jest.fn(),
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
    repository.buscarChurnPago.mockResolvedValue({
      inicio_cobertura: "2026-09-23T05:00:00.000Z",
      inicio_efetivo: "2026-09-23T05:00:00.000Z",
      periodo_ajustado_cutover: true,
      base_paga_inicio: 10,
      saidas_terminais_base_inicial: 2,
      negocios_reativados: 1,
      base_paga_fim: 9,
      saidas_cancelamento_voluntario: 1,
      saidas_inadimplencia_nao_recuperada: 1,
      saidas_encerramento_provedor: 0,
      saidas_outros_motivos: 0,
    });
    repository.buscarMrr.mockResolvedValue({
      inicio_cobertura: "2026-09-23T06:00:00.000Z",
      inicio_efetivo: "2026-09-23T06:00:00.000Z",
      periodo_ajustado_cutover: true,
      mrr_inicial: "1000.00",
      mrr_final_coorte_inicial: "950.00",
      mrr_final_total: "1200.00",
      mrr_retido_bruto: "850.00",
      new_mrr: "200.00",
      reactivation_mrr: "100.00",
      expansion_mrr: "100.00",
      contraction_mrr: "50.00",
      churned_mrr: "150.00",
      negocios_mrr_em_risco: 2,
      mrr_em_risco: "149.80",
      assinaturas_periodicidade_nao_suportada: 0,
    });
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
        cancelamentos_vencidos_pendentes_reconciliacao: 2,
        conversoes_iniciais_canonicas: 1,
        renovacoes_confirmadas_canonicas: 2,
        reativacoes_pagas: 1,
        mudancas_plano_canonicas: 1,
        pagamentos_atrasados_canonicos: 2,
        pagamentos_recuperados_canonicos: 1,
        reversoes_financeiras_canonicas: 1,
        cancelamentos_renovacao_canonicos: 1,
        saidas_base_paga_canonicas: 1,
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
      cancelamentosVencidosPendentesReconciliacao: 2,
      conversoesIniciaisCanonicas: 1,
      renovacoesConfirmadasCanonicas: 2,
      reativacoesPagas: 1,
      mudancasPlanoCanonicas: 1,
      pagamentosAtrasadosCanonicos: 2,
      pagamentosRecuperadosCanonicos: 1,
      reversoesFinanceirasCanonicas: 1,
      cancelamentosRenovacaoCanonicos: 1,
      saidasBasePagaCanonicas: 1,
      basePagaInicioChurn: 10,
      saidasTerminaisBaseInicial: 2,
      churnBrutoNegocios: 20,
      negociosReativadosChurn: 1,
      basePagaFimChurn: 9,
      saidasCancelamentoVoluntario: 1,
      saidasInadimplenciaNaoRecuperada: 1,
      mrrInicial: 1000,
      newMrr: 200,
      reactivationMrr: 100,
      expansionMrr: 100,
      contractionMrr: 50,
      churnedMrr: 150,
      mrrFinalCoorteInicial: 950,
      mrrFinalTotal: 1200,
      mrrEmRisco: 149.8,
      negociosMrrEmRisco: 2,
      grr: 85,
      nrr: 95,
      divergenciaBridgeMrr: 0,
      bridgeMrrReconciliado: true,
      assinaturasPeriodicidadeNaoSuportada: 0,
    });
    expect(resultado.metodologia.churn)
      .toMatch(/Gross logo churn v1/i);
    expect(resultado.churn).toMatchObject({
      periodoAjustadoAoCutover: true,
      historicoAnteriorInferido: false,
    });
    expect(resultado.mrr).toMatchObject({
      periodoAjustadoAoCutover: true,
      historicoAnteriorInferido: false,
      periodicidadeSuportada: "MONTHLY",
      bridgeReconciliado: true,
      confiavel: true,
    });
    expect(resultado.metodologia.mrr)
      .toMatch(/MRR v1/i);
    expect(resultado.metodologia.nrr)
      .toMatch(/NRR v1/i);
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
