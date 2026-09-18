const assinaturaService = require("../services/assinaturaService");
const registrador = require("../utils/registrador");

async function buscarMinhaAssinatura(req, res, next) {
  try {
    const resultado =
      await assinaturaService.buscarMinhaAssinatura({
        usuarioId: req.user?.id
      });

    return res.json(resultado);
  } catch (err) {
    next(err);
  }
}

async function cancelarMinhaAssinatura(req, res, next) {
  try {
    const resultado =
      await assinaturaService
        .cancelarMinhaAssinatura({
          usuarioId: req.user?.id
        });

    return res.json(resultado);
  } catch (err) {
    registrador.erro(
      "Não foi possível cancelar a assinatura.",
      {
        mensagem: err.message,
        status_asaas:
          err.response?.status || null,
        codigo:
          err.code || null
      }
    );

    next(err);
  }
}

async function reativarMinhaAssinatura(req, res, next) {
  try {
    const resultado =
      await assinaturaService
        .reativarMinhaAssinatura({
          usuarioId: req.user?.id
        });

    return res.json(resultado);
  } catch (err) {
    registrador.erro(
      "Não foi possível reativar a renovação da assinatura.",
      {
        mensagem: err.message,
        status_asaas:
          err.response?.status || null,
        codigo:
          err.code || null
      }
    );

    next(err);
  }
}

module.exports = {
  buscarMinhaAssinatura,
  cancelarMinhaAssinatura,
  reativarMinhaAssinatura
};
