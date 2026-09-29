const express = require("express");
const router = express.Router();

const auth = require("../middlewares/auth");
const agendaVinculoAtivo = require(
  "../middlewares/agendaVinculoAtivo"
);
const agendaConfiguracaoController = require(
  "../controllers/agendaConfiguracaoController"
);

const agendaConfiguracaoVinculoAtivo =
  agendaVinculoAtivo.comContextoPadrao(
    "dono"
  );

router.get(
  "/agenda-configuracao/status",
  auth,
  agendaConfiguracaoVinculoAtivo,
  agendaConfiguracaoController.buscarStatusConfiguracao
);

router.get(
  "/agenda-configuracao",
  auth,
  agendaConfiguracaoVinculoAtivo,
  agendaConfiguracaoController.buscarMinhaConfiguracao
);

router.put(
  "/agenda-configuracao",
  auth,
  agendaConfiguracaoVinculoAtivo,
  agendaConfiguracaoController.salvarMinhaConfiguracao
);

module.exports = router;