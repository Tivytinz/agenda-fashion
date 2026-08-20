const express = require(
  "express"
);

const authController = require(
  "../controllers/authController"
);

const router =
  express.Router();

const {
  limitarLogin,
  limitarCadastro,
  limitarRecuperacaoSenha,
} = require(
  "../middlewares/rateLimits"
);

router.get(
  "/auth/configuracao-publica",
  authController
    .configuracaoPublica
);

router.post(
  "/cadastro",
  limitarCadastro,
  authController.cadastro
);

router.post(
  "/login",
  limitarLogin,
  authController.login
);

router.post(
  "/auth/google",
  limitarLogin,
  authController.loginGoogle
);

router.post(
  "/auth/esqueci-senha",
  limitarRecuperacaoSenha,
  authController.esqueciSenha
);

router.post(
  "/auth/redefinir-senha",
  limitarRecuperacaoSenha,
  authController.redefinirSenha
);

router.post(
  "/logout",
  authController.logout
);

module.exports = router;
