const express = require(
  "express"
);

const router =
  express.Router();

const {
  disableDocumentCache,
} = require(
  "../utils/httpCache"
);

/*
 * Respostas administrativas podem conter
 * dados operacionais e de contato.
 *
 * Elas não devem permanecer no cache do
 * navegador, de proxies ou de CDNs.
 */
router.use(
  (
    _req,
    res,
    next
  ) => {
    disableDocumentCache(res);
    return next();
  }
);

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

const adminGoogleAnalyticsController =
  require(
    "../controllers/adminGoogleAnalyticsController"
  );

const adminProfessionalFunnelController =
  require(
    "../controllers/adminProfessionalFunnelController"
  );

const adminProfessionalRecurrenceController =
  require(
    "../controllers/adminProfessionalRecurrenceController"
  );

const adminSaasHealthController =
  require(
    "../controllers/adminSaasHealthController"
  );

const adminWhatsAppController =
  require(
    "../controllers/adminWhatsAppController"
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
 * Comportamento no Google Analytics 4.
 * A leitura usa a Analytics Data API no backend e não altera
 * os marcos comerciais canônicos do Agenda Fashion.
 */
router.get(
  "/admin/marketing/ga4",
  auth,
  authAdmin,
  adminGoogleAnalyticsController.buscar
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
 * Recorrência observada após o primeiro agendamento.
 * A leitura mede repetição de uso e não altera a régua
 * financeira de CAC, ROAS ou monetização.
 */
router.get(
  "/admin/marketing/recorrencia-profissionais",
  auth,
  authAdmin,
  adminProfessionalRecurrenceController.buscar
);

/*
 * Saúde da ativação profissional.
 * Lista somente cadastros de profissionais
 * e mantém os dados de contato protegidos
 * pela permissão administrativa.
 */
router.get(
  "/admin/saude/perfis-incompletos",
  auth,
  authAdmin,
  adminSaasHealthController
    .listarPerfisIncompletos
);

/*
 * Saúde dos templates e das entregas do WhatsApp.
 * A consulta à Meta é somente leitura e as credenciais
 * nunca são devolvidas para o navegador.
 */
router.get(
  "/admin/whatsapp/templates",
  auth,
  authAdmin,
  adminWhatsAppController.buscarPainel
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

router.get(
  "/admin/marketing/custos-integracoes/:provedor/campanhas",
  auth,
  authAdmin,
  marketingCostSyncController.listarCampanhas
);

router.post(
  "/admin/marketing/custos-integracoes/:provedor/testar",
  auth,
  authAdmin,
  marketingCostSyncController.testar
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
