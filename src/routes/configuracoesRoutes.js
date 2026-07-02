const express = require("express");
const router = express.Router();

const auth = require("../middlewares/auth");
const configuracoesController = require("../controllers/configuracoesController");

router.get(
  "/configuracoes",
  auth,
  configuracoesController.buscarConfiguracoes
);

router.put(
  "/configuracoes",
  auth,
  configuracoesController.salvarConfiguracoes
);

module.exports = router;