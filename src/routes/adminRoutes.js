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

const adminMarketingController =
  require(
    "../controllers/adminMarketingController"
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
 * Marketing e crescimento existente.
 * Mantido por compatibilidade com o
 * painel administrativo atual.
 */
router.get(
  "/admin/marketing",
  auth,
  authAdmin,
  adminController.buscarMarketingAdmin
);

/*
 * Atribuição de tráfego e mídia paga.
 */
router.get(
  "/admin/marketing/resumo",
  auth,
  authAdmin,
  adminMarketingController.buscarResumo
);

router.get(
  "/admin/marketing/campanhas",
  auth,
  authAdmin,
  adminMarketingController.listarCampanhas
);

router.get(
  "/admin/marketing/conversoes",
  auth,
  authAdmin,
  adminMarketingController.listarConversoes
);

module.exports = router;
