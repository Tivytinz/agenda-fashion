const adminAnalyticsV2Service = require(
  "../services/adminAnalyticsV2Service"
);

async function buscar(req, res, next) {
  try {
    const resultado = await adminAnalyticsV2Service.buscar({
      secao: req.params.secao,
      periodo: req.query.periodo,
    });

    return res.json(resultado);
  } catch (erro) {
    return next(erro);
  }
}

module.exports = {
  buscar,
};
