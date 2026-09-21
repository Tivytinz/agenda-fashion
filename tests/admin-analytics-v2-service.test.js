jest.mock(
  "../src/repositories/adminAnalyticsV2Repository",
  () => ({
    periodoSeguro: jest.fn((periodo) => periodo || "30"),
    buscarVisaoGeral: jest.fn(),
    listarAquisicao: jest.fn(),
    buscarJornada: jest.fn(),
    buscarReconciliacaoPipelines: jest.fn(),
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
  "../src/services/adminProfessionalRecurrenceAnalysisService",
  () => ({
    buscar: jest.fn(),
  })
);

const repository = require(
  "../src/repositories/adminAnalyticsV2Repository"
);
const professionalFunnelService = require(
  "../src/services/adminProfessionalFunnelService"
);
const professionalRecurrenceAnalysisService = require(
  "../src/services/adminProfessionalRecurrenceAnalysisService"
);
const {
  buscar,
  buscarOverview,
  buscarJourney,
  buscarRetention,
  mapearReconciliacaoPipelines,
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

  test("reconcilia eventos equivalentes sem somar os pipelines", async () => {
    repository.buscarJornada.mockResolvedValue({
      periodo: "30",
      telas: [],
      transicoes: [],
      eventos: [],
      dispositivos: [],
    });
    repository.buscarReconciliacaoPipelines.mockResolvedValue({
      periodo: "30",
      inicioComparavel: "2026-09-20T12:00:00.000Z",
      eventos: [
        {
          evento: "profile_viewed",
          legado_eventos_periodo: 12,
          v2_eventos_periodo: 10,
          legado_eventos_comparaveis: 10,
          v2_eventos_comparaveis: 9,
          legado_sessoes_comparaveis: 8,
          v2_sessoes_comparaveis: 8,
          booking_completed_vinculados: 0,
        },
        {
          evento: "booking_completed",
          legado_eventos_periodo: 4,
          v2_eventos_periodo: 4,
          legado_eventos_comparaveis: 4,
          v2_eventos_comparaveis: 4,
          legado_sessoes_comparaveis: 4,
          v2_sessoes_comparaveis: 4,
          booking_completed_vinculados: 4,
        },
      ],
    });

    const resultado = await buscarJourney("30");

    expect(resultado.reconciliacaoPipelines).toMatchObject({
      estado: "divergencia_observada",
      eventosComDivergencia: 1,
      legadoEventosPeriodo: 16,
      v2EventosPeriodo: 14,
    });
    expect(
      resultado.reconciliacaoPipelines.eventos[0]
    ).toMatchObject({
      evento: "profile_viewed",
      diferencaEventos: -1,
      coberturaV2SobreLegado: 90,
      paridadeExata: false,
    });
    expect(
      resultado.reconciliacaoPipelines.eventos[1]
    ).toMatchObject({
      evento: "booking_completed",
      bookingCompletedVinculados: 4,
      paridadeExata: true,
    });
  });

  test("marca sem base quando ainda não existe evento V2 comparável", () => {
    expect(
      mapearReconciliacaoPipelines({
        periodo: "7",
        inicioComparavel: null,
        eventos: [
          {
            evento: "profile_viewed",
            legado_eventos_periodo: 5,
            v2_eventos_periodo: 0,
          },
        ],
      })
    ).toMatchObject({
      estado: "sem_base_v2",
      legadoEventosPeriodo: 5,
      v2EventosPeriodo: 0,
    });
  });

  test("usa a mesma análise avançada na Retenção V2", async () => {
    const avancada = {
      periodo: "7",
      resumo: {
        comPrimeiroAgendamento: 3,
      },
      qualidadeCampanhasOficiais: [
        {
          chave: "campanha:10",
        },
      ],
    };
    professionalRecurrenceAnalysisService.buscar
      .mockResolvedValue(avancada);

    await expect(
      buscarRetention("7")
    ).resolves.toBe(avancada);
    expect(
      professionalRecurrenceAnalysisService.buscar
    ).toHaveBeenCalledWith({
      periodo: "7",
    });
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
