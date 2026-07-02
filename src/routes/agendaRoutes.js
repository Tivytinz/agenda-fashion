const express = require("express");
const router = express.Router();

const auth = require("../middlewares/auth");
const agendaController = require("../controllers/agendaController");

router.get(
  "/agenda-geral",
  auth,
  agendaController.buscarAgendaGeral
);

router.get(
  "/agenda-profissional",
  auth,
  agendaController.listarAgendamentosFuncionario
);

router.get(
  "/agendamentos-profissional",
  auth,
  agendaController.listarAgendamentosFuncionario
);

router.post(
  "/bloqueios-horario",
  auth,
  agendaController.alternarBloqueioHorario
);

router.get(
  "/notificacoes-agenda",
  auth,
  agendaController.buscarNotificacoesAgenda
);

module.exports = router;