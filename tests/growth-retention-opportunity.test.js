const {
  GROWTH_INTELLIGENCE_STATUS,
  analyzeGrowthIntelligence,
} = require(
  "../src/services/growthIntelligenceService"
);
const {
  MIN_UNIQUE_CUSTOMERS_FOR_RECURRENCE,
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

function analyze(dashboard) {
  return analyzeGrowthIntelligence({
    dashboard,
    ativacao: ATIVACAO_CONCLUIDA,
    proximaAcaoAtivacao: PROXIMA_ACAO_CONCLUIDA,
  });
}

describe("growth intelligence de retenção", () => {
  test("exige cinco clientes únicos antes de avaliar recorrência", () => {
    expect(
      MIN_UNIQUE_CUSTOMERS_FOR_RECURRENCE
    ).toBe(5);

    expect(buildGrowthSignals({
      resumo: {
        clientes_unicos: 4,
        clientes_recorrentes: 0,
      },
    }).amostra_recorrencia_suficiente).toBe(false);

    expect(buildGrowthSignals({
      resumo: {
        clientes_unicos: 5,
        clientes_recorrentes: 0,
      },
    }).amostra_recorrencia_suficiente).toBe(true);
  });

  test("sinaliza recorrência baixa sem afirmar causalidade", () => {
    const result = analyze({
      resumo: {
        servicos_vendidos: 8,
        clientes_unicos: 8,
        clientes_recorrentes: 1,
      },
      performance: {
        visitas_perfil: 10,
        agendamentos_concluidos: 8,
        taxa_conversao: 80,
        cliques_whatsapp: 0,
        cliques_maps: 0,
        favoritos_recebidos: 0,
      },
      ranking_servicos: [],
    });

    expect(result.status).toBe(
      GROWTH_INTELLIGENCE_STATUS.OPORTUNIDADE_PRIORIZADA
    );
    expect(result.oportunidade_principal.codigo).toBe(
      "RECORRENCIA_BAIXA_COM_AMOSTRA"
    );
    expect(result.oportunidade_principal.mensagem).toMatch(
      /não identifica uma causa/i
    );
    expect(result.oportunidade_principal.evidencias).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          chave: "clientes_recorrentes",
          valor: 1,
        }),
        expect.objectContaining({
          chave: "taxa_recorrencia",
          valor: 12.5,
        }),
      ])
    );
  });

  test("mantém conversão crítica acima da oportunidade de recorrência", () => {
    const result = analyze({
      resumo: {
        servicos_vendidos: 8,
        clientes_unicos: 8,
        clientes_recorrentes: 0,
      },
      performance: {
        visitas_perfil: 50,
        agendamentos_concluidos: 0,
        taxa_conversao: 0,
        cliques_whatsapp: 0,
        cliques_maps: 0,
        favoritos_recebidos: 0,
      },
      ranking_servicos: [],
    });

    expect(result.oportunidades).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          codigo: "RECORRENCIA_BAIXA_COM_AMOSTRA",
        }),
      ])
    );
    expect(result.oportunidade_principal.codigo).toBe(
      "CONVERSAO_SEM_AGENDAMENTO"
    );
  });
});
