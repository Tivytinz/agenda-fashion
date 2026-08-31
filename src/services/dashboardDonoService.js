const dashboardService = require(
  "./dashboardService"
);
const dashboardActivationService = require(
  "./dashboardActivationService"
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

  return {
    ...resultado,
    ativacao,
  };
}

module.exports = {
  buscarDashboardDono,
};
