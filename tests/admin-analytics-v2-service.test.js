jest.mock(
  "../src/repositories/adminAnalyticsV2Repository",
  () => ({
    periodoSeguro: jest.fn((periodo) => periodo || "30"),
    buscarVisaoGeral: jest.fn(),
    listarAquisicao: jest.fn(),
    buscarJornada: jest.fn(),
    buscarReceita: jest.fn(),
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
const professionalFunnelService = require(
  "../src/services/adminProfessionalFunnelService"
);
const {
  buscar,
  buscarOverview,
  buscarRevenue,
  mapearVisaoGeral,
} = require(
  "../src/services/adminAnalyticsV2Service"
);

describe("adminAnalyticsV2Service", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("usa a coorte profissional nas taxas e preserva receita como fato do período", async () => {
    repository.buscarVisaoGeral.mockResolvedValue({
      periodo: "30",
      sessoes: 20,
      usuarios_ativos: 12,
      visualizacoes: 80,
      tempo_engajado_ms: 600000,
      cadastros_profissionais: 99,
      negocios_criados: 70,
      negocios_publicados: 60,
      agendamentos_validos: 18,
      primeiros_agendamentos: 10,
      pagamentos_confirmados: 4,
      negocios_com_pagamento: 3,
      receita_confirmada: "199.80",
    });

    professionalFunnelService.buscarFunil.mockResolvedValue({
      resumo: {
        cadastros: 10,
        negociosCriados: 8,
        servicosCriados: 7,
        negociosPublicados: 6,
        primeirosAgendamentos: 3,
        assinaturasAtivadas: 2,
        taxaNegocio: 80,
        taxaServico: 70,
        taxaPublicacao: 60,
        taxaPrimeiroAgendamento: 30,
        taxaAssinatura: 20,
      },
    });

    const resultado = await buscarOverview("30");

    expect(resultado.aquisicao.cadastrosProfissionais).toBe(10);
    expect(resultado.ativacao).toMatchObject({
      negociosCriados: 8,
      servicosCriados: 7,
      negociosPublicados: 6,
      primeirosAgendamentos: 3,
      taxaNegocioSobreCadastro: 80,
      taxaServicoSobreCadastro: 70,
      taxaPublicacaoSobreCadastro: 60,
      taxaPrimeiroAgendamentoSobreCadastro: 30,
    });
    expect(resultado.receita).toMatchObject({
      pagamentosConfirmados: 4,
      negociosComPagamento: 3,
      receitaConfirmada: 199.8,
      assinaturasAtivadasCohorte: 2,
      taxaAssinaturaSobreCadastro: 20,
    });

    expect(repository.buscarVisaoGeral).toHaveBeenCalledWith("30");
    expect(professionalFunnelService.buscarFunil).toHaveBeenCalledWith({
      periodo: "30",
    });
  });

  test("expõe reembolsos e ajustes sem misturá-los com receita confirmada", async () => {
    repository.buscarReceita.mockResolvedValue({
      periodo: "30",
      resumo: {
        checkouts_iniciados: 4,
        checkouts_concluidos: 3,
        checkouts_falhos: 1,
        negocios_com_checkout: 3,
        negocios_checkout_convertidos: 2,
        pagamentos_confirmados: 2,
        negocios_pagantes: 2,
        novas_assinaturas_pagas: 1,
        assinaturas_pagas_ativas: 1,
        receita_total: "149.80",
        receita_primeiro_pagamento: "49.90",
        pagamentos_reembolsados: 1,
        valor_reembolsado: "49.90",
        pagamentos_com_ajuste: 2,
      },
      planos: [],
    });

    const resultado = await buscarRevenue("30");

    expect(resultado.resumo).toMatchObject({
      receitaTotal: 149.8,
      receitaPrimeiroPagamento: 49.9,
      pagamentosReembolsados: 1,
      valorReembolsado: 49.9,
      pagamentosComAjuste: 2,
      negociosComCheckoutCohorte: 3,
      negociosCheckoutConvertidos: 2,
      conversaoCheckoutParaAssinaturaPaga: 66.67,
    });
    expect(resultado.metodologia.receita)
      .toMatch(/Reembolsos integrais e outros ajustes/i);
  });

  test("não calcula conversão quando a coorte não tem cadastro", () => {
    const resultado = mapearVisaoGeral(
      {
        periodo: "7",
        sessoes: 0,
        receita_confirmada: 0,
      },
      {
        cadastros: 0,
      }
    );

    expect(resultado.ativacao.taxaNegocioSobreCadastro).toBeNull();
    expect(resultado.receita.taxaAssinaturaSobreCadastro).toBeNull();
  });

  test("rejeita seção administrativa desconhecida", async () => {
    await expect(
      buscar({
        secao: "financeiro-inventado",
        periodo: "30",
      })
    ).rejects.toMatchObject({
      statusCode: 404,
    });
  });
});
