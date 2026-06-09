const express = require("express");
const router = express.Router();

const auth = require("../middlewares/auth");
const upload = require("../middlewares/upload");

const contaController = require("../controllers/contaController");

router.get("/", auth, contaController.buscarMinhaConta);

router.put("/", auth, contaController.atualizarMinhaConta);

router.put("/senha", auth, contaController.alterarSenha);

router.post(
  "/foto",
  auth,
  upload.single("foto"),
  contaController.enviarFotoUsuario
);

module.exports = router;