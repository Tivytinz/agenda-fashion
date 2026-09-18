const express = require("express");
const router = express.Router();

const auth = require("../middlewares/auth");
const {
  limitarCheckout
} = require("../middlewares/rateLimits");
const assinaturaController = require("../controllers/assinaturaController");

router.get(
  "/minha-assinatura",
  auth,
  assinaturaController.buscarMinhaAssinatura
);

router.delete(
  "/minha-assinatura",
  auth,
  assinaturaController.cancelarMinhaAssinatura
);

router.post(
  "/minha-assinatura/reativar",
  auth,
  limitarCheckout,
  assinaturaController.reativarMinhaAssinatura
);

module.exports = router;
