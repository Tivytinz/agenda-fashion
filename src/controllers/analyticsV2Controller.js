const analyticsV2Service = require(
  "../services/analyticsV2Service"
);

async function coletar(req, res, next) {
  try {
    const resultado = await analyticsV2Service.coletar({
      usuarioId: req.user?.id || null,
      body: req.body,
    });

    return res.status(202).json(resultado);
  } catch (erro) {
    return next(erro);
  }
}

module.exports = {
  coletar,
};
