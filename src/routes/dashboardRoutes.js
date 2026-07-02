const express = require("express");
const router = express.Router();

const auth = require("../middlewares/auth");
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

module.exports = router;