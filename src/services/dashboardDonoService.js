const dashboardService = require(
  "./dashboardService"
);
const dashboardActivationService = require(
  "./dashboardActivationService"
);
const activationNextActionService = require(
  "./activationNextActionService"
);
const growthIntelligenceService = require(
  "./growthIntelligenceService"
);

function analisarInteligenciaCrescimentoSegura({
  dashboard,
  ativacao,
  proximaAcaoAtivacao,
}) {
  try {
    return growthIntelligenceService
      .analyzeGrowthIntelligence({
        dashboard,
        ativacao,
        proximaAcaoAtivacao,
      });
  } catch {
    return growthIntelligenceService
      .unavailableGrowthIntelligence();
  }
}

async function buscarDashboardDono({
  usuarioId,
  periodo,
}) {
  const resultado =
    await dashboardService
      .buscarDashboardDono({
        usuarioId,
        periodo,
      });

  const ativacao =
    await dashboardActivationService
      .buscarAtivacaoNegocio({
        negocioId:
          resultado.negocio?.negocio_id,
      });

  const proximaAcaoAtivacao =
    activationNextActionService
      .resolverProximaAcaoAtivacao(
        ativacao
      );

  const inteligenciaCrescimento =
    analisarInteligenciaCrescimentoSegura({
      dashboard: resultado,
      ativacao,
      proximaAcaoAtivacao,
    });

  return {
    ...resultado,
    ativacao,
    proxima_acao_ativacao:
      proximaAcaoAtivacao,
    inteligencia_crescimento:
      inteligenciaCrescimento,
  };
}

module.exports = {
  buscarDashboardDono,
};
