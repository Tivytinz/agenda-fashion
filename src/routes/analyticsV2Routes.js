const express = require("express");
const optionalAuth = require("../middlewares/optionalAuth");
const { limitarEventos } = require("../middlewares/rateLimits");
const analyticsV2Controller = require(
  "../controllers/analyticsV2Controller"
);

const router = express.Router();

router.post(
  "/analytics/collect",
  limitarEventos,
  optionalAuth,
  analyticsV2Controller.coletar
);

module.exports = router;
