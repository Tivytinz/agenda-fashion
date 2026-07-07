const db = require("../db/db");

const adminService = require("../services/adminService");

function filtroPeriodo(alias = "") {
  const prefixo = alias ? `${alias}.` : "";

  return {
    today: `AND ${prefixo}created_at >= CURRENT_DATE`,
    "7": `AND ${prefixo}created_at >= NOW() - INTERVAL '7 days'`,
    "30": `AND ${prefixo}created_at >= NOW() - INTERVAL '30 days'`,
    month: `AND date_trunc('month', ${prefixo}created_at) = date_trunc('month', NOW())`,
    all: ""
  };
}

async function buscarDashboardAdmin(req, res, next) {
  try {
    const resultado = await adminService.buscarDashboardAdmin({
      periodo: req.query.periodo || "all",
    });

    return res.json(resultado);
  } catch (err) {
    next(err);
  }
}

async function listarNegociosAdmin(req, res, next) {
  try {
    const resultado = await adminService.listarNegociosAdmin();

    return res.json(resultado);
  } catch (err) {
    next(err);
  }
}

async function listarAgendamentosAdmin(req, res, next) {
  try {
    const resultado = await adminService.listarAgendamentosAdmin();

    return res.json(resultado);
  } catch (err) {
    next(err);
  }
}

async function buscarMarketingAdmin(req, res, next) {
  try {
    const resultado = await adminService.buscarMarketingAdmin();

    return res.json(resultado);
  } catch (err) {
    next(err);
  }
}

module.exports = {
  buscarDashboardAdmin,
  listarNegociosAdmin,
  listarAgendamentosAdmin,
  buscarMarketingAdmin
};