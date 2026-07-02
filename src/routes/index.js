const express = require("express");
const router = express.Router();

router.use("/", require("./authRoutes"));

router.use("/", require("./negocioRoutes"));
router.use("/", require("./checkoutRoutes"));
router.use("/", require("./assinaturaRoutes"));
router.use("/", require("./contaRoutes"));
router.use("/", require("./configuracoesRoutes"));
router.use("/", require("./profissionaisRoutes"));
router.use("/", require("./servicosRoutes"));
router.use("/", require("./planosRoutes"));
router.use("/", require("./webhookRoutes"));
router.use("/", require("./favoritosRoutes"));


// Os próximos módulos serão adicionados aqui conforme forem sendo separados:
// router.use("/", require("./agendaRoutes"));
// router.use("/", require("./agendaPublicaRoutes"));
// router.use("/", require("./dashboardRoutes"));
// router.use("/", require("./favoritosRoutes"));
// router.use("/", require("./configuracoesRoutes"));
// router.use("/", require("./adminRoutes"));

module.exports = router;