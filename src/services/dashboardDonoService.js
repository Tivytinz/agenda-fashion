const dashboardService = require(
  "./dashboardService"
);
const dashboardActivationService = require(
  "./dashboardActivationService"
);
const copilotActivationService = require(
  "./copilotActivationService"
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

  const copilotAtivacao =
    copilotActivationService
      .resolverCopilotAtivacao(
        ativacao
      );

  return {
    ...resultado,
    ativacao,
    copilot_ativacao:
      copilotAtivacao,
  };
}

module.exports = {
  buscarDashboardDono,
};
