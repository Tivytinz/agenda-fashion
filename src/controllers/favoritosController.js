const favoritosService = require(
  "../services/favoritosService"
);

async function listarFavoritos(
  req,
  res,
  next
) {
  try {
    const resultado =
      await favoritosService
        .listarFavoritos({
          usuarioId:
            req.user?.id,
        });

    return res.json(
      resultado
    );
  } catch (erro) {
    return next(erro);
  }
}

async function adicionarFavorito(
  req,
  res,
  next
) {
  try {
    const resultado =
      await favoritosService
        .adicionarFavorito({
          usuarioId:
            req.user?.id,

          negocioId:
            req.params.negocioId,
        });

    return res.json(
      resultado
    );
  } catch (erro) {
    return next(erro);
  }
}

async function removerFavorito(
  req,
  res,
  next
) {
  try {
    const resultado =
      await favoritosService
        .removerFavorito({
          usuarioId:
            req.user?.id,

          negocioId:
            req.params.negocioId,
        });

    return res.json(
      resultado
    );
  } catch (erro) {
    return next(erro);
  }
}

async function verificarFavorito(
  req,
  res,
  next
) {
  try {
    const resultado =
      await favoritosService
        .verificarFavorito({
          usuarioId:
            req.user?.id,

          negocioId:
            req.params.negocioId,
        });

    return res.json(
      resultado
    );
  } catch (erro) {
    return next(erro);
  }
}

module.exports = {
  listarFavoritos,
  adicionarFavorito,
  removerFavorito,
  verificarFavorito,
};