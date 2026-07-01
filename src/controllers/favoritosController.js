const favoritosService = require("../services/favoritosService");

async function listarFavoritos(req, res, next) {
  try {
    const resultado = await favoritosService.listarFavoritos({
      usuarioId: req.user?.id,
      tipo: req.user?.tipo
    });

    return res.json(resultado);
  } catch (err) {
    next(err);
  }
}

async function adicionarFavorito(req, res, next) {
  try {
    const resultado = await favoritosService.adicionarFavorito({
      usuarioId: req.user?.id,
      tipo: req.user?.tipo,
      negocioId: req.params.negocioId
    });

    return res.json(resultado);
  } catch (err) {
    next(err);
  }
}

async function removerFavorito(req, res, next) {
  try {
    const resultado = await favoritosService.removerFavorito({
      usuarioId: req.user?.id,
      tipo: req.user?.tipo,
      negocioId: req.params.negocioId
    });

    return res.json(resultado);
  } catch (err) {
    next(err);
  }
}

async function verificarFavorito(req, res, next) {
  try {
    const resultado = await favoritosService.verificarFavorito({
      usuarioId: req.user?.id,
      tipo: req.user?.tipo,
      negocioId: req.params.negocioId
    });

    return res.json(resultado);
  } catch (err) {
    next(err);
  }
}

module.exports = {
  listarFavoritos,
  adicionarFavorito,
  removerFavorito,
  verificarFavorito
};