const dashboardService = require(
  "./dashboardService"
);
const dashboardActivationService = require(
  "./dashboardActivationService"
);
const activationNextActionService = require(
  "./activationNextActionService"
);

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

  return {
    ...resultado,
    ativacao,
    proxima_acao_ativacao:
      proximaAcaoAtivacao,
  };
}

module.exports = {
  buscarDashboardDono,
};
