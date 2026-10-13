const {
  buildGrowthSignals,
} = require("./growthIntelligence/signalService");
const {
  findGrowthOpportunities,
} = require("./growthIntelligence/opportunityService");
const {
  rankGrowthOpportunities,
} = require("./growthIntelligence/recommendationService");

const GROWTH_INTELLIGENCE_STATUS = Object.freeze({
  AGUARDANDO_ATIVACAO: "AGUARDANDO_ATIVACAO",
  DADOS_INSUFICIENTES: "DADOS_INSUFICIENTES",
  SEM_OPORTUNIDADE_PRIORITARIA: "SEM_OPORTUNIDADE_PRIORITARIA",
  OPORTUNIDADE_PRIORIZADA: "OPORTUNIDADE_PRIORIZADA",
  INDISPONIVEL: "INDISPONIVEL",
});

function activationComplete({ ativacao, proximaAcaoAtivacao }) {
  return (
    proximaAcaoAtivacao?.concluido === true &&
    ativacao?.possui_servico_ativo === true &&
    ativacao?.negocio_publicado === true &&
    ativacao?.primeiro_agendamento_recebido === true
  );
}

function hasEnoughData(signals) {
  return (
    signals.amostra_conversao_suficiente === true ||
    signals.amostra_servicos_suficiente === true ||
    signals.amostra_recorrencia_suficiente === true
  );
}

function periodoProperty(dashboard) {
  const periodo = String(dashboard?.periodo || "").trim();
  return periodo ? { periodo } : {};
}

function unavailableGrowthIntelligence(periodo = null) {
  return {
    status: GROWTH_INTELLIGENCE_STATUS.INDISPONIVEL,
    ...(periodo ? { periodo: String(periodo) } : {}),
    oportunidade_principal: null,
    oportunidades: [],
  };
}

function analyzeGrowthIntelligence({
  dashboard = {},
  ativacao = {},
  proximaAcaoAtivacao = {},
} = {}) {
  const period = periodoProperty(dashboard);

  if (!activationComplete({ ativacao, proximaAcaoAtivacao })) {
    return {
      status: GROWTH_INTELLIGENCE_STATUS.AGUARDANDO_ATIVACAO,
      ...period,
      oportunidade_principal: null,
      oportunidades: [],
    };
  }

  // This operational fact does not depend on marketing telemetry.
  if (ativacao.possui_disponibilidade_agendavel === false) {
    const oportunidade = {
      codigo: "REVISAR_DISPONIBILIDADE",
      categoria: "operacao",
      titulo: "Revise os horários antes de divulgar",
      mensagem:
        "Seu perfil está publicado, mas a disponibilidade atual não permite " +
        "novas reservas. Se quiser voltar a receber agendamentos, revise os " +
        "horários. Se a pausa for intencional, mantenha sua configuração.",
      impacto: 1,
      confianca: 1,
      urgencia: 1,
      score: 1,
      evidencias: [],
      acao: {
        tipo: "NAVEGAR",
        rotulo: "Revisar horários",
        destino: "/painel/horarios",
      },
    };

    return {
      status: GROWTH_INTELLIGENCE_STATUS.OPORTUNIDADE_PRIORIZADA,
      ...period,
      oportunidade_principal: oportunidade,
      oportunidades: [oportunidade],
    };
  }

  // A recommendation derived from missing telemetry would treat a failed read as zero.
  if (dashboard?.qualidade_dados?.desempenho_perfil === "indisponivel" ||
      dashboard?.qualidade_dados?.favoritos === "indisponivel") {
    return unavailableGrowthIntelligence(dashboard?.periodo);
  }

  const sinais = buildGrowthSignals(dashboard);
  const oportunidades = rankGrowthOpportunities(
    findGrowthOpportunities(sinais)
  );
  const oportunidadePrincipal = oportunidades[0] || null;

  if (oportunidadePrincipal) {
    return {
      status: GROWTH_INTELLIGENCE_STATUS.OPORTUNIDADE_PRIORIZADA,
      ...period,
      oportunidade_principal: oportunidadePrincipal,
      oportunidades: oportunidades.slice(0, 3),
    };
  }

  return {
    status: hasEnoughData(sinais)
      ? GROWTH_INTELLIGENCE_STATUS.SEM_OPORTUNIDADE_PRIORITARIA
      : GROWTH_INTELLIGENCE_STATUS.DADOS_INSUFICIENTES,
    ...period,
    oportunidade_principal: null,
    oportunidades: [],
  };
}

module.exports = {
  GROWTH_INTELLIGENCE_STATUS,
  analyzeGrowthIntelligence,
  unavailableGrowthIntelligence,
};
