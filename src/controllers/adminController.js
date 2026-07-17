const adminService = require(
  "../services/adminService"
);

/*
 * GET /admin/dashboard
 */
async function buscarDashboardAdmin(
  req,
  res,
  next
) {
  try {
    const resultado =
      await adminService
        .buscarDashboardAdmin({
          periodo:
            req.query?.periodo,
        });

    return res
      .status(200)
      .json(resultado);
  } catch (erro) {
    return next(erro);
  }
}

/*
 * GET /admin/negocios
 */
async function listarNegociosAdmin(
  req,
  res,
  next
) {
  try {
    const resultado =
      await adminService
        .listarNegociosAdmin();

    return res
      .status(200)
      .json(resultado);
  } catch (erro) {
    return next(erro);
  }
}

/*
 * GET /admin/agendamentos
 */
async function listarAgendamentosAdmin(
  req,
  res,
  next
) {
  try {
    const resultado =
      await adminService
        .listarAgendamentosAdmin();

    return res
      .status(200)
      .json(resultado);
  } catch (erro) {
    return next(erro);
  }
}

/*
 * GET /admin/marketing
 */
async function buscarMarketingAdmin(
  req,
  res,
  next
) {
  try {
    const resultado =
      await adminService
        .buscarMarketingAdmin();

    return res
      .status(200)
      .json(resultado);
  } catch (erro) {
    return next(erro);
  }
}

module.exports = {
  buscarDashboardAdmin,
  listarNegociosAdmin,
  listarAgendamentosAdmin,
  buscarMarketingAdmin,
};