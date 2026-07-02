const express = require("express");
const router = express.Router();

const perfilNegocioController = require("../controllers/perfilNegocioController");

router.get(
  "/negocios-publicos",
  perfilNegocioController.listarNegociosPublicos
);

router.get(
  "/perfil-negocio/:slug",
  perfilNegocioController.buscarPerfilPublico
);

module.exports = router;