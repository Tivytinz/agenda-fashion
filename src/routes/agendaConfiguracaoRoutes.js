const express = require("express");
const router = express.Router();

const auth = require("../middlewares/auth");
const agendaConfiguracaoController = require(
  "../controllers/agendaConfiguracaoController"
);

router.get(
  "/agenda-configuracao/status",
  auth,
  agendaConfiguracaoController.buscarStatusConfiguracao
);

router.get(
  "/agenda-configuracao",
  auth,
  agendaConfiguracaoController.buscarMinhaConfiguracao
);

router.put(
  "/agenda-configuracao",
  auth,
  agendaConfiguracaoController.salvarMinhaConfiguracao
);

module.exports = router;