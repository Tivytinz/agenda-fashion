const express = require("express");
const router = express.Router();

const auth = require("../middlewares/auth");
const agendaVinculoAtivo = require(
  "../middlewares/agendaVinculoAtivo"
);
const agendaConfiguracaoController = require(
  "../controllers/agendaConfiguracaoController"
);

router.get(
  "/agenda-configuracao/status",
  auth,
  agendaVinculoAtivo,
  agendaConfiguracaoController.buscarStatusConfiguracao
);

router.get(
  "/agenda-configuracao",
  auth,
  agendaVinculoAtivo,
  agendaConfiguracaoController.buscarMinhaConfiguracao
);

router.put(
  "/agenda-configuracao",
  auth,
  agendaVinculoAtivo,
  agendaConfiguracaoController.salvarMinhaConfiguracao
);

module.exports = router;