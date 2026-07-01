const negocioService = require("../services/negocioService");

async function criarNegocio(req, res, next) {
  try {
    const resultado = await negocioService.criar({
      usuarioId: req.user?.id,
      nome: req.body.nome
    });

    return res.status(201).json(resultado);

  } catch (err) {
    next(err);
  }
}

async function buscarMeuNegocio(req, res, next) {
  try {
    const resultado = await negocioService.buscarMeuNegocio(
      req.user?.id
    );

    return res.json(resultado);

  } catch (err) {
    next(err);
  }
}

async function buscarNegocios(req, res, next) {
  try {
    const resultado =
      await negocioService.buscarPorTermo(
        req.query.termo
      );

    return res.json(resultado);
  } catch (err) {
    next(err);
  }
}

module.exports = {
  criarNegocio,
  buscarMeuNegocio,
  buscarNegocios
};