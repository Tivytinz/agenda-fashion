const authSessionRepository = require(
  "../repositories/authSessionRepository"
);
const {
  hashToken,
  verificarToken,
} = require(
  "../utils/sessionToken"
);

function tokenAnteriorATrocaDeSenha(
  decoded,
  senhaAlteradaEm
) {
  if (!senhaAlteradaEm) {
    return false;
  }

  const emitidoEmSegundos =
    Number(
      decoded?.iat
    );
  const senhaAlteradaEmSegundos =
    Math.floor(
      new Date(
        senhaAlteradaEm
      ).getTime() / 1000
    );

  if (
    !Number.isFinite(
      emitidoEmSegundos
    ) ||
    !Number.isFinite(
      senhaAlteradaEmSegundos
    )
  ) {
    return true;
  }

  return (
    emitidoEmSegundos <
    senhaAlteradaEmSegundos
  );
}

async function cookieSessaoEstaValido(
  token
) {
  let decoded;

  try {
    decoded =
      verificarToken(token);
  } catch (erro) {
    if (
      [
        "TokenExpiredError",
        "JsonWebTokenError",
        "NotBeforeError",
      ].includes(
        erro.name
      )
    ) {
      return false;
    }

    throw erro;
  }

  if (!decoded?.id) {
    return false;
  }

  const estadoDaSessao =
    await authSessionRepository
      .buscarEstadoDaSessao(
        decoded.id,
        hashToken(token)
      );

  return Boolean(
    estadoDaSessao
    && Number(
      estadoDaSessao.id
    ) === Number(
      decoded.id
    )
    && estadoDaSessao.ativo === true
    && estadoDaSessao
      .token_revogado !== true
    && !tokenAnteriorATrocaDeSenha(
      decoded,
      estadoDaSessao
        .senha_alterada_em
    )
  );
}

module.exports = {
  cookieSessaoEstaValido,
};
