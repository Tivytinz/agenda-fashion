const adminService = require(
  "../services/adminService"
);
const adminOperationService = require(
  "../services/adminOperationService"
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
      await adminOperationService
        .listarNegociosAdmin(
          req.query || {}
        );

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
      await adminOperationService
        .listarAgendamentosAdmin(
          req.query || {}
        );

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