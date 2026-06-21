const express = require("express");
const router = express.Router();

const auth = require("../middlewares/auth");
const upload = require("../middlewares/upload");

const {
  criarServico,
  editarServico,
  removerServico,
  enviarFotoServico,
  listarFotosServico,
  adicionarFotoGaleriaServico,
  removerFotoGaleriaServico
} = require("../controllers/servicosController");



router.post("/", auth, criarServico);
router.put("/:id", auth, editarServico);
router.delete("/:id", auth, removerServico);
router.post("/:id/foto", auth, upload.single("foto"), enviarFotoServico);

router.get("/:id/fotos", listarFotosServico);

router.post(
  "/:id/fotos",
  auth,
  upload.single("foto"),
  adicionarFotoGaleriaServico
);

router.delete(
  "/fotos/:fotoId",
  auth,
  removerFotoGaleriaServico
);

module.exports = router;