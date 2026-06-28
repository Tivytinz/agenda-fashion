const express = require("express");
const router = express.Router();

const auth = require("../middlewares/auth");
const assinaturaController = require("../controllers/assinaturaController");

router.get(
  "/minha-assinatura",
  auth,
  assinaturaController.buscarMinhaAssinatura
);

module.exports = router;