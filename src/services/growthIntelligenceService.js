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
    ativacao?.agenda_configurada === true &&
    ativacao?.negocio_publicado === true &&
    ativacao?.primeiro_agendamento_recebido === true
  );
}

function hasEnoughData(signals) {
  return (
    signals.amostra_conversao_suficiente === true ||
    signals.amostra_servicos_suficiente === true
  );
}

function unavailableGrowthIntelligence(periodo = null) {
  return {
    status: GROWTH_INTELLIGENCE_STATUS.INDISPONIVEL,
    periodo,
    oportunidade_principal: null,
    oportunidades: [],
  };
}

function analyzeGrowthIntelligence({
  dashboard = {},
  ativacao = {},
  proximaAcaoAtivacao = {},
} = {}) {
  const periodo = String(dashboard?.periodo || "7dias");

  if (!activationComplete({ ativacao, proximaAcaoAtivacao })) {
    return {
      status: GROWTH_INTELLIGENCE_STATUS.AGUARDANDO_ATIVACAO,
      periodo,
      oportunidade_principal: null,
      oportunidades: [],
    };
  }

  const sinais = buildGrowthSignals(dashboard);
  const oportunidades = rankGrowthOpportunities(
    findGrowthOpportunities(sinais)
  );
  const oportunidadePrincipal = oportunidades[0] || null;

  if (oportunidadePrincipal) {
    return {
      status: GROWTH_INTELLIGENCE_STATUS.OPORTUNIDADE_PRIORIZADA,
      periodo,
      oportunidade_principal: oportunidadePrincipal,
      oportunidades: oportunidades.slice(0, 3),
    };
  }

  return {
    status: hasEnoughData(sinais)
      ? GROWTH_INTELLIGENCE_STATUS.SEM_OPORTUNIDADE_PRIORITARIA
      : GROWTH_INTELLIGENCE_STATUS.DADOS_INSUFICIENTES,
    periodo,
    oportunidade_principal: null,
    oportunidades: [],
  };
}

module.exports = {
  GROWTH_INTELLIGENCE_STATUS,
  analyzeGrowthIntelligence,
  unavailableGrowthIntelligence,
};
