const express = require("express");
const router = express.Router();

const auth = require("../middlewares/auth");
const favoritosController = require("../controllers/favoritosController");

router.get(
  "/favoritos",
  auth,
  favoritosController.listarFavoritos
);

router.post(
  "/favoritos/:negocioId",
  auth,
  favoritosController.adicionarFavorito
);

router.delete(
  "/favoritos/:negocioId",
  auth,
  favoritosController.removerFavorito
);

router.get(
  "/favoritos/:negocioId/status",
  auth,
  favoritosController.verificarFavorito
);

module.exports = router;