const express = require(
  "express"
);

const authController = require(
  "../controllers/authController"
);

const router =
  express.Router();

router.get(
  "/auth/configuracao-publica",
  authController
    .configuracaoPublica
);

router.post(
  "/cadastro",
  authController.cadastro
);

router.post(
  "/login",
  authController.login
);

router.post(
  "/auth/google",
  authController.loginGoogle
);

module.exports = router;
