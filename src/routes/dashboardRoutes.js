const express = require("express");
const router = express.Router();

const auth = require("../middlewares/auth");
const {
  limitarCopilot,
} = require("../middlewares/rateLimits");
const dashboardController = require("../controllers/dashboardController");

router.get(
  "/dashboard-profissional",
  auth,
  dashboardController.buscarDashboardProfissional
);

router.get(
  "/dashboard-dono",
  auth,
  dashboardController.buscarDashboardDono
);

router.get(
  "/dashboard-dono/origem-clientes",
  auth,
  dashboardController.buscarOrigemClientesDono
);

router.post(
  "/dashboard-dono/copilot/divulgacao",
  auth,
  limitarCopilot,
  dashboardController.gerarDivulgacaoCopilot
);

module.exports = router;
