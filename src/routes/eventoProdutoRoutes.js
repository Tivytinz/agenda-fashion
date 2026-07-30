const express = require(
  "express"
);

const optionalAuth = require(
  "../middlewares/optionalAuth"
);

const {
  limitarEventos,
} = require(
  "../middlewares/rateLimits"
);

const eventoProdutoController =
  require(
    "../controllers/eventoProdutoController"
  );

const router =
  express.Router();

router.post(
  "/eventos-produto",
  limitarEventos,
  optionalAuth,
  eventoProdutoController
    .registrar
);

module.exports = router;
