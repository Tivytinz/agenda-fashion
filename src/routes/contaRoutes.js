const express = require("express");

const router = express.Router();

const auth = require(
  "../middlewares/auth"
);

const upload = require(
  "../middlewares/upload"
);

const {
  limitarUpload,
} = require(
  "../middlewares/rateLimits"
);

const contaController = require(
  "../controllers/contaController"
);

function tratarErroUpload(
  erro,
  req,
  res,
  next
) {
  if (!erro) {
    return next();
  }

  if (
    erro.code ===
    "LIMIT_FILE_SIZE"
  ) {
    erro.status = 413;
    erro.statusCode = 413;
    erro.message =
      "A imagem deve ter no máximo 5 MB.";

    return next(erro);
  }

  if (
    erro.name ===
    "MulterError"
  ) {
    erro.status = 400;
    erro.statusCode = 400;
    erro.message =
      "Não foi possível processar a imagem enviada.";

    return next(erro);
  }

  return next(erro);
}

router.get(
  "/conta",
  auth,
  contaController.buscarMinhaConta
);

router.put(
  "/conta",
  auth,
  contaController.atualizarMinhaConta
);

router.put(
  "/conta/preferencias-whatsapp",
  auth,
  contaController.atualizarPreferenciaWhatsapp
);

router.put(
  "/conta/senha",
  auth,
  contaController.alterarSenha
);

router.post(
  "/conta/foto",
  limitarUpload,
  auth,
  upload.single("foto"),
  tratarErroUpload,
  contaController.enviarFotoUsuario
);

/*
 * É necessário exportar diretamente
 * o Router. Não use { router }.
 */
module.exports = router;
