const express = require(
  "express"
);

const router =
  express.Router();

const auth = require(
  "../middlewares/auth"
);

const authAdmin = require(
  "../middlewares/authAdmin"
);

const adminController = require(
  "../controllers/adminController"
);

/*
 * Resumo geral da plataforma.
 */
router.get(
  "/admin/dashboard",
  auth,
  authAdmin,
  adminController.buscarDashboardAdmin
);

/*
 * Negócios cadastrados.
 */
router.get(
  "/admin/negocios",
  auth,
  authAdmin,
  adminController.listarNegociosAdmin
);

/*
 * Agendamentos da plataforma.
 */
router.get(
  "/admin/agendamentos",
  auth,
  authAdmin,
  adminController.listarAgendamentosAdmin
);

/*
 * Marketing e crescimento.
 */
router.get(
  "/admin/marketing",
  auth,
  authAdmin,
  adminController.buscarMarketingAdmin
);

module.exports = router;