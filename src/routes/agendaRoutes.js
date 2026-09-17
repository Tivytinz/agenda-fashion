const express = require("express");
const router = express.Router();

const auth = require("../middlewares/auth");
const agendaProfissionalAtiva = require("../middlewares/agendaProfissionalAtiva");
const agendaVinculoAtivo = require("../middlewares/agendaVinculoAtivo");
const agendamentoOperacionalAtivo = require(
  "../middlewares/agendamentoOperacionalAtivo"
);
const agendaController = require("../controllers/agendaController");
const agendamentoLifecycleController = require(
  "../controllers/agendamentoLifecycleController"
);
const agendamentoCancelamentoController = require(
  "../controllers/agendamentoCancelamentoController"
);

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

router.patch(
  "/agendamentos/:id/atendimento",
  auth,
  agendamentoOperacionalAtivo,
  agendamentoLifecycleController.atualizarStatusAtendimento
);

router.patch(
  "/agendamentos/:id/cancelar-operacional",
  auth,
  agendamentoOperacionalAtivo,
  agendamentoCancelamentoController.cancelarOperacional
);

router.post(
  "/bloqueios-horario",
  auth,
  agendaVinculoAtivo,
  agendaController.alternarBloqueioHorario
);

router.get(
  "/notificacoes-agenda",
  auth,
  agendaController.buscarNotificacoesAgenda
);

module.exports = router;
