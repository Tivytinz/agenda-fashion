const express = require("express");
const router = express.Router();

const auth = require("../middlewares/auth");
const upload = require("../middlewares/upload");
const {
  limitarUpload,
} = require("../middlewares/rateLimits");
const configuracoesController = require("../controllers/configuracoesController");

function tratarErroUpload(
  erro,
  req,
  res,
  next
) {
  if (!erro) return next();

  if (erro.code === "LIMIT_FILE_SIZE") {
    erro.status = 413;
    erro.statusCode = 413;
    erro.message = "A imagem deve ter no máximo 5 MB.";
    return next(erro);
  }

  if (erro.name === "MulterError") {
    erro.status = 400;
    erro.statusCode = 400;
    erro.message = "Não foi possível processar a imagem enviada.";
    return next(erro);
  }

  return next(erro);
}

router.get(
  "/configuracoes",
  auth,
  configuracoesController.buscarConfiguracoes
);

router.put(
  "/configuracoes",
  auth,
  configuracoesController.salvarConfiguracoes
);

router.post(
  "/configuracoes/foto",
  limitarUpload,
  auth,
  upload.single("foto"),
  tratarErroUpload,
  configuracoesController.enviarFotoNegocio
);

router.patch(
  "/configuracoes/publicacao",
  auth,
  configuracoesController.alterarPublicacao
);

module.exports = router;
