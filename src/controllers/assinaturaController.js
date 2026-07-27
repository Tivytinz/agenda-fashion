const assinaturaService = require("../services/assinaturaService");

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
  console.error("ERRO AO CANCELAR ASSINATURA:", {
    mensagem: err.message,
    statusAsaas: err.response?.status,
    respostaAsaas: err.response?.data,
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
