const express = require("express");
const router = express.Router();

const auth = require("../middlewares/auth");
const favoritosController = require("../controllers/favoritosController");

router.get(
  "/api/favoritos",
  auth,
  favoritosController.listarFavoritos
);

router.post(
  "/api/favoritos/:negocioId",
  auth,
  favoritosController.adicionarFavorito
);

router.delete(
  "/api/favoritos/:negocioId",
  auth,
  favoritosController.removerFavorito
);

router.get(
  "/api/favoritos/:negocioId/status",
  auth,
  favoritosController.verificarFavorito
);

module.exports = router;