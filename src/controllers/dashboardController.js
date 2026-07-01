const dashboardService = require("../services/dashboardService");

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

    return res.json(resultado);
  } catch (err) {
    next(err);
  }
}

module.exports = {
  buscarDashboardProfissional,
  buscarDashboardDono
};