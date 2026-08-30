const dashboardService = require("../services/dashboardService");
const dashboardCustomerOriginService = require(
  "../services/dashboardCustomerOriginService"
);
const dashboardActivationService = require(
  "../services/dashboardActivationService"
);

async function buscarDashboardProfissional(req, res, next) {
  try {
    const resultado = await dashboardService.buscarDashboardProfissional({
      usuarioId: req.user?.id
    });

    return res.json(resultado);
  } catch (err) {
    next(err);
  }
}

async function buscarDashboardDono(req, res, next) {
  try {
    const resultado = await dashboardService.buscarDashboardDono({
      usuarioId: req.user?.id,
      periodo: req.query.periodo
    });

    const ativacao = await dashboardActivationService
      .buscarAtivacaoNegocio({
        negocioId: resultado.negocio?.negocio_id
      });

    return res.json({
      ...resultado,
      ativacao
    });
  } catch (err) {
    next(err);
  }
}

async function buscarOrigemClientesDono(req, res, next) {
  try {
    const resultado = await dashboardCustomerOriginService
      .buscarOrigemClientes({
        usuarioId: req.user?.id,
        periodo: req.query.periodo
      });

    return res.json(resultado);
  } catch (err) {
    next(err);
  }
}

module.exports = {
  buscarDashboardProfissional,
  buscarDashboardDono,
  buscarOrigemClientesDono
};
