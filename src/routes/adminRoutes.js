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

const adminMarketingCostController =
  require(
    "../controllers/adminMarketingCostController"
  );

const marketingCostSyncController =
  require(
    "../controllers/marketingCostSyncController"
  );

const adminProfessionalFunnelController =
  require(
    "../controllers/adminProfessionalFunnelController"
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
 * Funil de aquisição dos profissionais.
 */
router.get(
  "/admin/marketing/funil-profissionais",
  auth,
  authAdmin,
  adminProfessionalFunnelController.buscar
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

/*
 * Investimento e eficiência de mídia.
 *
 * O gasto manual continua disponível como fallback.
 * Integrações automáticas usam vínculo explícito com a
 * campanha externa e nunca expõem credenciais ao frontend.
 */
router.get(
  "/admin/marketing/custos",
  auth,
  authAdmin,
  adminMarketingCostController.buscarCustos
);

router.get(
  "/admin/marketing/gastos",
  auth,
  authAdmin,
  adminMarketingCostController.listarGastos
);

router.post(
  "/admin/marketing/gastos",
  auth,
  authAdmin,
  adminMarketingCostController.registrarGasto
);

router.get(
  "/admin/marketing/custos-integracoes",
  auth,
  authAdmin,
  marketingCostSyncController.status
);

router.post(
  "/admin/marketing/custos-integracoes/vinculos",
  auth,
  authAdmin,
  marketingCostSyncController.vincular
);

router.post(
  "/admin/marketing/custos-integracoes/:provedor/sincronizar",
  auth,
  authAdmin,
  marketingCostSyncController.sincronizar
);

module.exports = router;
