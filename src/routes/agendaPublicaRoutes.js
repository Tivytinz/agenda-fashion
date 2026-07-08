const express = require("express");
const router = express.Router();

const optionalAuth = require("../middlewares/optionalAuth");  
const auth = require("../middlewares/auth");
const agendaPublicaController = require("../controllers/agendaPublicaController");


router.get(
  "/agenda-publica",
  agendaPublicaController.buscarAgendaPublica
);

router.post(
  "/agendamentos",
  optionalAuth,
  agendaPublicaController.criarAgendamentoPublico
);

router.get(
  "/meus-agendamentos",
  auth,
  agendaPublicaController.listarMeusAgendamentos
);

router.patch(
  "/agendamentos/:id/cancelar",
  auth,
  agendaPublicaController.cancelarMeuAgendamento
);

router.patch(
  "/agendamentos/:id/avaliar",
  auth,
  agendaPublicaController.avaliarAgendamento
);

module.exports = router;