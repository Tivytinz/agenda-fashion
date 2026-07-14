const express = require("express");
const router = express.Router();
const agendaConfiguracaoRoutes = require("./agendaConfiguracaoRoutes");


router.use("/", require("./authRoutes"));

router.use("/", require("./negocioRoutes"));
router.use("/", require("./checkoutRoutes"));
router.use("/", require("./assinaturaRoutes"));
router.use("/conta", require("./contaRoutes"));
router.use("/", require("./configuracoesRoutes"));
router.use("/", require("./profissionaisRoutes"));

// ===== SERVIÇOS =====
router.use("/servicos", require("./servicosRoutes"));

router.use("/", require("./planosRoutes"));
router.use("/", require("./webhookRoutes"));
router.use("/", require("./favoritosRoutes"));
router.use("/", require("./dashboardRoutes"));
router.use("/", require("./notificacoesRoutes"));
router.use("/", require("./agendaRoutes"));
router.use("/", require("./perfilNegocioRoutes"));
router.use("/", require("./agendaPublicaRoutes"));
router.use("/", require("./adminRoutes"));

module.exports = router;