const express = require(
  "express"
);

const optionalAuth = require(
  "../middlewares/optionalAuth"
);

const eventoProdutoController =
  require(
    "../controllers/eventoProdutoController"
  );

const router =
  express.Router();

router.post(
  "/eventos-produto",
  optionalAuth,
  eventoProdutoController
    .registrar
);

module.exports = router;
