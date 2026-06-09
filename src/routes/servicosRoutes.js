const express = require("express");
const router = express.Router();

const auth = require("../middlewares/auth");
const upload = require("../middlewares/upload");

const {
  criarServico,
  editarServico,
  removerServico,
  enviarFotoServico,
} = require("../controllers/servicosController");

router.post("/", auth, criarServico);
router.put("/:id", auth, editarServico);
router.delete("/:id", auth, removerServico);
router.post("/:id/foto", auth, upload.single("foto"), enviarFotoServico);

module.exports = router;