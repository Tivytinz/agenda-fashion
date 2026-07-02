const express = require("express");
const router = express.Router();

const auth = require("../middlewares/auth");
const notificacoesController = require("../controllers/notificacoesController");

router.get(
  "/notificacoes",
  auth,
  notificacoesController.listarNotificacoes
);

router.patch(
  "/notificacoes/:id/lida",
  auth,
  notificacoesController.marcarComoLida
);

module.exports = router;