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

jest.mock(
  "../src/services/adminAcquisitionFinancialService",
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
const adminAcquisitionFinancialService = require(
  "../src/services/adminAcquisitionFinancialService"
);
const {
  buscar,
  buscarOverview,
  buscarAcquisition,
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
      clientes_com_agendamento: 14,
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
    expect(resultado.entidades).toEqual({
      profissionaisNoFunil: 10,
      negociosCriados: 8,
      clientesComAgendamento: 14,
    });
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

  test("CA-ANA-05: profissionais, negócios e clientes permanecem métricas distintas", () => {
    const resultado = mapearVisaoGeral(
      {
        periodo: "30",
        sessoes: 100,
        clientes_com_agendamento: 17,
        agendamentos_validos: 24,
      },
      {
        cadastros: 40,
        negociosCriados: 12,
        servicosCriados: 10,
        negociosPublicados: 9,
        primeirosAgendamentos: 6,
        assinaturasAtivadas: 2,
      }
    );

    expect(resultado.entidades).toEqual({
      profissionaisNoFunil: 40,
      negociosCriados: 12,
      clientesComAgendamento: 17,
    });
    expect(
      resultado.audiencia.sessoes
    ).toBe(100);
    expect(
      resultado.ativacao.primeirosAgendamentos
    ).toBe(6);
    expect(
      resultado.demanda.agendamentosValidos
    ).toBe(24);

    expect(
      resultado.entidades.profissionaisNoFunil
    ).not.toBe(
      resultado.entidades.negociosCriados
    );
    expect(
      resultado.entidades.clientesComAgendamento
    ).not.toBe(
      resultado.ativacao.primeirosAgendamentos
    );
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

  test("integra retorno financeiro sem substituir o funil do período", async () => {
    repository.listarAquisicao.mockResolvedValue({
      periodo: "30",
      origens: [],
    });
    professionalFunnelService.buscarFunil
      .mockResolvedValue({
        campanhas: [
          {
            origem: "google",
            midia: "cpc",
            campanha: "google_ads_profissionais",
            campanhaOficialId: 10,
            classificacaoAtribuicao: "oficial",
            cadastros: 20,
            negociosCriados: 10,
            servicosCriados: 8,
            negociosPublicados: 7,
            primeirosAgendamentos: 5,
            checkoutsIniciados: 3,
            assinaturasAtivadas: 2,
            investimentoCentavos: 10000,
            receitaPrimeiroPagamentoCentavos: 9980,
            cacAssinanteCentavos: 5000,
            roas: 1,
          },
        ],
        qualidadeMensuracao: {
          prontaParaDecisao: true,
        },
        diagnosticoAtribuicao: {
          cadastrosOficiais: 20,
        },
      });
    adminAcquisitionFinancialService.buscar
      .mockResolvedValue({
        inicioCobertura:
          "2026-09-23T18:00:00.000Z",
        campanhas: [
          {
            campanhaOficialId: 10,
            janelas: [
              {
                dias: 30,
                retornoBruto: 1.2,
              },
            ],
          },
        ],
      });

    const resultado =
      await buscarAcquisition("30");

    expect(resultado.funilPorCampanha[0])
      .toMatchObject({
        campanha: "google_ads_profissionais",
        cadastros: 20,
        assinaturasAtivadas: 2,
        cacAssinanteCentavos: 5000,
      });
    expect(resultado.retornoAquisicao)
      .toMatchObject({
        inicioCobertura:
          "2026-09-23T18:00:00.000Z",
      });
    expect(
      adminAcquisitionFinancialService.buscar
    ).toHaveBeenCalledTimes(1);
    expect(
      resultado.metodologia.retornoFinanceiro
    ).toMatch(/Wave 27/i);
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

  test("não usa diferença de sessionização como divergência de eventos", () => {
    const resultado = mapearReconciliacaoPipelines({
      periodo: "30",
      inicioComparavel: "2026-09-20T12:00:00.000Z",
      eventos: [
        {
          evento: "profile_viewed",
          legado_eventos_periodo: 10,
          v2_eventos_periodo: 10,
          legado_eventos_comparaveis: 10,
          v2_eventos_comparaveis: 10,
          legado_sessoes_comparaveis: 6,
          v2_sessoes_comparaveis: 8,
        },
      ],
    });

    expect(resultado).toMatchObject({
      estado: "paridade_exata",
      eventosComDivergencia: 0,
    });
    expect(resultado.eventos[0]).toMatchObject({
      paridadeExata: true,
      paridadeSessoes: false,
      diferencaSessoes: 2,
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
