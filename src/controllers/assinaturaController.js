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
    registrador.erro("Não foi possível cancelar a assinatura.", {
      mensagem: err.message,
      status_asaas: err.response?.status,
      resposta_asaas: err.response?.data,
      metodo: err.config?.method,
      url: err.config?.url
    });

    next(err);
  }
}

module.exports = {
  buscarMinhaAssinatura,
  cancelarMinhaAssinatura
};
