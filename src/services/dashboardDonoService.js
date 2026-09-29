const dashboardService = require(
  "./dashboardService"
);
const dashboardRepository = require(
  "../repositories/dashboardRepository"
);
const AppError = require(
  "../errors/AppError"
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

async function buscarAtivacaoDono({
  usuarioId,
}) {
  if (!usuarioId) {
    throw new AppError(
      "Usuário não autenticado.",
      401
    );
  }

  const negocio =
    await dashboardRepository
      .buscarNegocioDoUsuario(
        usuarioId
      );

  if (!negocio) {
    throw new AppError(
      "Usuário não está vinculado a nenhum negócio.",
      404
    );
  }

  if (
    negocio.papel !== "dono"
  ) {
    throw new AppError(
      "Apenas o dono pode acessar este dashboard.",
      403
    );
  }

  const negocioId =
    Number(
      negocio.negocio_id
    );

  const ativacao =
    await dashboardActivationService
      .buscarAtivacaoNegocio({
        negocioId,
      });

  const proximaAcaoAtivacao =
    activationNextActionService
      .resolverProximaAcaoAtivacao(
        ativacao
      );

  return {
    negocio: {
      negocio_id:
        negocioId,
      papel:
        negocio.papel,
      nome:
        negocio.nome,
      slug:
        negocio.slug,
    },
    ativacao,
    proxima_acao_ativacao:
      proximaAcaoAtivacao,
  };
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
  buscarAtivacaoDono,
  buscarDashboardDono,
};
