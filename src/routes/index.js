const express = require("express");

const router = express.Router();

/*
 * AUTENTICAÇÃO E SESSÃO
 */
const authRoutes = require(
  "./authRoutes"
);

const sessaoRoutes = require(
  "./sessaoRoutes"
);

/*
 * NEGÓCIOS E CONTA
 */
const negocioRoutes = require(
  "./negocioRoutes"
);

const contaRoutes = require(
  "./contaRoutes"
);

const configuracoesRoutes = require(
  "./configuracoesRoutes"
);

const profissionaisRoutes = require(
  "./profissionaisRoutes"
);

/*
 * SERVIÇOS
 */
const servicosRoutes = require(
  "./servicosRoutes"
);

/*
 * ASSINATURAS E PAGAMENTOS
 */
const checkoutRoutes = require(
  "./checkoutRoutes"
);

const assinaturaRoutes = require(
  "./assinaturaRoutes"
);

const planosRoutes = require(
  "./planosRoutes"
);

const webhookRoutes = require(
  "./webhookRoutes"
);

/*
 * EXPERIÊNCIA DO USUÁRIO E ANALYTICS
 */
const favoritosRoutes = require(
  "./favoritosRoutes"
);

const dashboardRoutes = require(
  "./dashboardRoutes"
);

const notificacoesRoutes = require(
  "./notificacoesRoutes"
);

const eventoProdutoRoutes = require(
  "./eventoProdutoRoutes"
);

const analyticsV2Routes = require(
  "./analyticsV2Routes"
);

const metaAdsRoutes = require(
  "./metaAdsRoutes"
);

const googleMeasurementRoutes = require(
  "./googleMeasurementRoutes"
);

/*
 * AGENDAS
 */
const agendaRoutes = require(
  "./agendaRoutes"
);

const agendaPublicaRoutes = require(
  "./agendaPublicaRoutes"
);

/*
 * PERFIL PÚBLICO
 */
const perfilNegocioRoutes = require(
  "./perfilNegocioRoutes"
);

/*
 * ADMINISTRAÇÃO
 */
const adminAnalyticsV2Routes = require(
  "./adminAnalyticsV2Routes"
);

const adminRoutes = require(
  "./adminRoutes"
);

/*
 * =========================================================
 * REGISTRO DAS ROTAS
 * =========================================================
 */

router.use(
  authRoutes
);

router.use(
  sessaoRoutes
);

router.use(
  negocioRoutes
);

router.use(
  contaRoutes
);

router.use(
  configuracoesRoutes
);

router.use(
  profissionaisRoutes
);

router.use(
  "/servicos",
  servicosRoutes
);

router.use(
  checkoutRoutes
);

router.use(
  assinaturaRoutes
);

router.use(
  planosRoutes
);

router.use(
  webhookRoutes
);

router.use(
  favoritosRoutes
);

router.use(
  dashboardRoutes
);

router.use(
  notificacoesRoutes
);

/*
 * Mantém o coletor legado enquanto a Administração 2.0 passa a utilizar
 * sessões e jornadas first-party. A remoção do legado só ocorrerá depois
 * de validação em produção.
 */
router.use(
  eventoProdutoRoutes
);

router.use(
  analyticsV2Routes
);

router.use(
  metaAdsRoutes
);

router.use(
  googleMeasurementRoutes
);

router.use(
  agendaRoutes
);

router.use(
  agendaPublicaRoutes
);

router.use(
  perfilNegocioRoutes
);

router.use(
  adminAnalyticsV2Routes
);

router.use(
  adminRoutes
);

module.exports = router;
