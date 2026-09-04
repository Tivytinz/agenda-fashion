const dashboardService = require("../services/dashboardService");
const dashboardDonoService = require(
  "../services/dashboardDonoService"
);
const dashboardCustomerOriginService = require(
  "../services/dashboardCustomerOriginService"
);
const copilotShareService = require(
  "../services/copilotShareService"
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
    const resultado = await dashboardDonoService.buscarDashboardDono({
      usuarioId: req.user?.id,
      periodo: req.query.periodo
    });

    return res.json(resultado);
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

async function gerarDivulgacaoCopilot(req, res, next) {
  try {
    const resultado = await copilotShareService.gerarDivulgacao({
      usuarioId: req.user?.id,
      periodo: req.body?.periodo,
      canal: req.body?.canal,
    });

    return res.json(resultado);
  } catch (err) {
    next(err);
  }
}

module.exports = {
  buscarDashboardProfissional,
  buscarDashboardDono,
  buscarOrigemClientesDono,
  gerarDivulgacaoCopilot,
};
