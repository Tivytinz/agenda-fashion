const {
  GROWTH_INTELLIGENCE_STATUS,
  analyzeGrowthIntelligence,
} = require(
  "../src/services/growthIntelligenceService"
);
const {
  MIN_PROFILE_VISITS_FOR_CONVERSION,
  buildGrowthSignals,
} = require(
  "../src/services/growthIntelligence/signalService"
);

const ATIVACAO_CONCLUIDA = Object.freeze({
  possui_servico_ativo: true,
  agenda_configurada: true,
  negocio_publicado: true,
  primeiro_agendamento_recebido: true,
});

const PROXIMA_ACAO_CONCLUIDA = Object.freeze({
  estado: "ATIVADO",
  concluido: true,
});

function analyze(dashboard, overrides = {}) {
  return analyzeGrowthIntelligence({
    dashboard,
    ativacao:
      overrides.ativacao ||
      ATIVACAO_CONCLUIDA,
    proximaAcaoAtivacao:
      overrides.proximaAcaoAtivacao ||
      PROXIMA_ACAO_CONCLUIDA,
  });
}

describe("growthIntelligenceService", () => {
  test("mantém 20 visitas como limiar canônico para avaliar conversão", () => {
    expect(MIN_PROFILE_VISITS_FOR_CONVERSION).toBe(20);
    expect(buildGrowthSignals({
      performance: { visitas_perfil: 19 },
    }).amostra_conversao_suficiente).toBe(false);
    expect(buildGrowthSignals({
      performance: { visitas_perfil: 20 },
    }).amostra_conversao_suficiente).toBe(true);
  });

  test("não compete com a máquina de ativação antes do primeiro agendamento", () => {
    const result = analyze(
      {
        resumo: {
          servicos_vendidos: 0,
        },
        performance: {
          visitas_perfil: 100,
          agendamentos_concluidos: 0,
          taxa_conversao: 0,
        },
      },
      {
        ativacao: {
          ...ATIVACAO_CONCLUIDA,
          primeiro_agendamento_recebido: false,
        },
        proximaAcaoAtivacao: {
          estado: "CONQUISTAR_PRIMEIRO_AGENDAMENTO",
          concluido: false,
        },
      }
    );

    expect(result).toEqual({
      status:
        GROWTH_INTELLIGENCE_STATUS.AGUARDANDO_ATIVACAO,
      oportunidade_principal: null,
      oportunidades: [],
    });
  });

  test("não força recomendação com amostra pequena", () => {
    const result = analyze({
      resumo: {
        servicos_vendidos: 0,
      },
      performance: {
        visitas_perfil: 12,
        agendamentos_concluidos: 0,
        taxa_conversao: 0,
        cliques_whatsapp: 3,
        cliques_maps: 0,
        favoritos_recebidos: 1,
      },
      ranking_servicos: [],
    });

    expect(result.status).toBe(
      GROWTH_INTELLIGENCE_STATUS.DADOS_INSUFICIENTES
    );
    expect(result.oportunidade_principal).toBeNull();
  });

  test("prioriza conversão quando há visitas suficientes e nenhum agendamento concluído", () => {
    const result = analyze({
      resumo: {
        servicos_vendidos: 0,
      },
      performance: {
        visitas_perfil: 50,
        agendamentos_concluidos: 0,
        taxa_conversao: 0,
        cliques_whatsapp: 8,
        cliques_maps: 2,
        favoritos_recebidos: 3,
      },
      ranking_servicos: [],
    });

    expect(result.status).toBe(
      GROWTH_INTELLIGENCE_STATUS.OPORTUNIDADE_PRIORIZADA
    );
    expect(result.oportunidades.length).toBeGreaterThan(1);
    expect(result.oportunidade_principal.codigo).toBe(
      "CONVERSAO_SEM_AGENDAMENTO"
    );
    expect(result.oportunidade_principal.score).toBeGreaterThan(
      result.oportunidades[1].score
    );
  });

  test("gera hipótese de interesse sem conclusão sem afirmar causalidade", () => {
    const result = analyze({
      resumo: {
        servicos_vendidos: 8,
      },
      performance: {
        visitas_perfil: 80,
        agendamentos_concluidos: 8,
        taxa_conversao: 10,
        cliques_whatsapp: 15,
        cliques_maps: 5,
        favoritos_recebidos: 3,
      },
      ranking_servicos: [
        { id: 1, nome: "Manicure", total: 4 },
        { id: 2, nome: "Pedicure", total: 4 },
      ],
    });

    expect(result.oportunidade_principal.codigo).toBe(
      "INTERESSE_SEM_CONCLUSAO_PROPORCIONAL"
    );
    expect(result.oportunidade_principal.mensagem).toMatch(
      /sem assumir uma causa específica/i
    );
  });

  test("reconhece serviço com tração usando todos os agendamentos do período como denominador", () => {
    const result = analyze({
      resumo: {
        servicos_vendidos: 20,
      },
      performance: {
        visitas_perfil: 100,
        agendamentos_concluidos: 20,
        taxa_conversao: 20,
        cliques_whatsapp: 4,
        cliques_maps: 0,
        favoritos_recebidos: 0,
      },
      ranking_servicos: [
        { id: 1, nome: "Alongamento em gel", total: 12 },
        { id: 2, nome: "Manicure", total: 5 },
        { id: 3, nome: "Pedicure", total: 3 },
      ],
    });

    expect(result.oportunidade_principal.codigo).toBe(
      "SERVICO_COM_TRACAO_CONCENTRADA"
    );
    expect(result.oportunidade_principal.acao.tipo).toBe(
      "COMPARTILHAR_PERFIL"
    );
    expect(result.oportunidade_principal.evidencias).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          chave: "participacao_servico_destaque",
          valor: 60,
        }),
      ])
    );
  });

  test("não infla participação do serviço usando apenas o top 5 do ranking", () => {
    const result = analyze({
      resumo: {
        servicos_vendidos: 20,
      },
      performance: {
        visitas_perfil: 10,
        agendamentos_concluidos: 2,
        taxa_conversao: 20,
        cliques_whatsapp: 0,
        cliques_maps: 0,
        favoritos_recebidos: 0,
      },
      ranking_servicos: [
        { id: 1, nome: "Alongamento", total: 8 },
        { id: 2, nome: "Manicure", total: 2 },
      ],
    });

    expect(result.status).toBe(
      GROWTH_INTELLIGENCE_STATUS.SEM_OPORTUNIDADE_PRIORITARIA
    );
    expect(result.oportunidade_principal).toBeNull();
  });

  test("diferencia dados suficientes de ausência de oportunidade prioritária", () => {
    const result = analyze({
      resumo: {
        servicos_vendidos: 20,
      },
      performance: {
        visitas_perfil: 100,
        agendamentos_concluidos: 20,
        taxa_conversao: 20,
        cliques_whatsapp: 1,
        cliques_maps: 0,
        favoritos_recebidos: 1,
      },
      ranking_servicos: [
        { id: 1, nome: "Manicure", total: 6 },
        { id: 2, nome: "Pedicure", total: 5 },
        { id: 3, nome: "Escova", total: 4 },
        { id: 4, nome: "Corte", total: 3 },
        { id: 5, nome: "Sobrancelha", total: 2 },
      ],
    });

    expect(result.status).toBe(
      GROWTH_INTELLIGENCE_STATUS.SEM_OPORTUNIDADE_PRIORITARIA
    );
    expect(result.oportunidade_principal).toBeNull();
  });

  test("não envia dados de clientes na recomendação estruturada", () => {
    const result = analyze({
      resumo: {
        servicos_vendidos: 0,
      },
      performance: {
        visitas_perfil: 30,
        agendamentos_concluidos: 0,
        taxa_conversao: 0,
      },
      ranking_clientes: [
        {
          id: 99,
          nome: "Cliente Exemplo",
          whatsapp: "62999999999",
        },
      ],
    });

    const serialized = JSON.stringify(result);
    expect(serialized).not.toContain("Cliente Exemplo");
    expect(serialized).not.toContain("62999999999");
    expect(serialized).not.toContain("ranking_clientes");
  });
});
