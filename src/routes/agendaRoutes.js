const express = require("express");
const router = express.Router();

const auth = require("../middlewares/auth");
const agendaProfissionalAtiva = require("../middlewares/agendaProfissionalAtiva");
const agendaController = require("../controllers/agendaController");

router.get(
  "/agenda-geral",
  auth,
  agendaController.buscarAgendaGeral
);

router.get(
  "/agenda-profissional",
  auth,
  agendaProfissionalAtiva,
  agendaController.listarAgendamentosFuncionario
);

router.get(
  "/agendamentos-profissional",
  auth,
  agendaProfissionalAtiva,
  agendaController.listarAgendamentosFuncionario
);

router.post(
  "/bloqueios-horario",
  auth,
  agendaProfissionalAtiva,
  agendaController.alternarBloqueioHorario
);

router.get(
  "/notificacoes-agenda",
  auth,
  agendaController.buscarNotificacoesAgenda
);

module.exports = router;
