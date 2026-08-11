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

const adminCampaignController =
  require(
    "../controllers/adminCampaignController"
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

/*
 * Gestão das campanhas criadas pelo AF.
 *
 * A identidade UTM é preservada após
 * a criação; edições ficam restritas a
 * nome, destino, conteúdo, termo e status.
 */
router.get(
  "/admin/marketing/gestao-campanhas",
  auth,
  authAdmin,
  adminCampaignController.listar
);

router.post(
  "/admin/marketing/gestao-campanhas",
  auth,
  authAdmin,
  adminCampaignController.criar
);

router.patch(
  "/admin/marketing/gestao-campanhas/:id",
  auth,
  authAdmin,
  adminCampaignController.atualizar
);

module.exports = router;
