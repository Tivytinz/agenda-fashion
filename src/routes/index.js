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
 * EXPERIÊNCIA DO USUÁRIO
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
const adminRoutes = require(
  "./adminRoutes"
);

/*
 * =========================================================
 * REGISTRO DAS ROTAS
 * =========================================================
 *
 * Os módulos que já possuem seus caminhos completos são
 * registrados diretamente no router principal.
 */

/*
 * AUTENTICAÇÃO E SESSÃO
 */
router.use(
  authRoutes
);

router.use(
  sessaoRoutes
);

/*
 * NEGÓCIOS E CONTA
 */
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

/*
 * SERVIÇOS
 *
 * Este módulo é montado em /servicos porque suas rotas
 * internas utilizam caminhos relativos a esse prefixo.
 */
router.use(
  "/servicos",
  servicosRoutes
);

/*
 * ASSINATURAS E PAGAMENTOS
 */
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

/*
 * EXPERIÊNCIA DO USUÁRIO
 */
router.use(
  favoritosRoutes
);

router.use(
  dashboardRoutes
);

router.use(
  notificacoesRoutes
);

router.use(
  eventoProdutoRoutes
);

router.use(
  metaAdsRoutes
);

router.use(
  googleMeasurementRoutes
);

/*
 * AGENDAS
 */
router.use(
  agendaRoutes
);

router.use(
  agendaPublicaRoutes
);

/*
 * PERFIL PÚBLICO
 */
router.use(
  perfilNegocioRoutes
);

/*
 * ADMINISTRAÇÃO
 *
 * O adminRoutes já contém caminhos completos:
 *
 * /admin/dashboard
 * /admin/negocios
 * /admin/agendamentos
 * /admin/marketing
 */
router.use(
  adminRoutes
);

module.exports = router;
