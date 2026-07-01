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

module.exports = {
  buscarMinhaAssinatura
};