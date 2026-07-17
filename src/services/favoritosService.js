const favoritosRepository = require(
  "../repositories/favoritosRepository"
);

const {
  exigirUsuario,
  exigirRecurso,
} = require(
  "../validators/commonValidator"
);

const ValidationError = require(
  "../errors/ValidationError"
);

/*
 * A coluna ainda se chama cliente_id
 * no banco, mas agora representa qualquer
 * usuário que esteja utilizando o sistema
 * como cliente.
 */

function normalizarNegocioId(
  valor
) {
  const negocioId =
    Number(valor);

  if (
    !Number.isInteger(
      negocioId
    ) ||
    negocioId <= 0
  ) {
    throw new ValidationError(
      "Negócio inválido."
    );
  }

  return negocioId;
}

async function listarFavoritos({
  usuarioId,
}) {
  exigirUsuario(
    usuarioId
  );

  const favoritos =
    await favoritosRepository
      .listarFavoritos(
        usuarioId
      );

  return {
    favoritos:
      Array.isArray(favoritos)
        ? favoritos
        : [],
  };
}

async function adicionarFavorito({
  usuarioId,
  negocioId,
}) {
  exigirUsuario(
    usuarioId
  );

  const negocioIdNormalizado =
    normalizarNegocioId(
      negocioId
    );

  const negocio =
    await favoritosRepository
      .buscarNegocio(
        negocioIdNormalizado
      );

  exigirRecurso(
    negocio,
    "Negócio não encontrado."
  );

  await favoritosRepository
    .adicionarFavorito(
      usuarioId,
      negocioIdNormalizado
    );

  return {
    mensagem:
      "Adicionado aos favoritos.",

    favoritado:
      true,
  };
}

async function removerFavorito({
  usuarioId,
  negocioId,
}) {
  exigirUsuario(
    usuarioId
  );

  const negocioIdNormalizado =
    normalizarNegocioId(
      negocioId
    );

  await favoritosRepository
    .removerFavorito(
      usuarioId,
      negocioIdNormalizado
    );

  return {
    mensagem:
      "Removido dos favoritos.",

    favoritado:
      false,
  };
}

async function verificarFavorito({
  usuarioId,
  negocioId,
}) {
  exigirUsuario(
    usuarioId
  );

  const negocioIdNormalizado =
    normalizarNegocioId(
      negocioId
    );

  const favoritado =
    await favoritosRepository
      .verificarFavorito(
        usuarioId,
        negocioIdNormalizado
      );

  return {
    favoritado:
      Boolean(favoritado),
  };
}

module.exports = {
  listarFavoritos,
  adicionarFavorito,
  removerFavorito,
  verificarFavorito,
};