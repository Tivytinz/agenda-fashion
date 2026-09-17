const sessionRevocationRepository =
  require(
    "../repositories/sessionRevocationRepository"
  );

const {
  hashToken,
  verificarToken,
} = require(
  "../utils/sessionToken"
);

const ERROS_TOKEN_INVALIDO =
  new Set([
    "JsonWebTokenError",
    "NotBeforeError",
    "TokenExpiredError",
  ]);

function normalizarUsuarioId(
  valor
) {
  const id = Number(valor);

  return Number.isInteger(id) &&
    id > 0
    ? id
    : null;
}

function obterExpiracao(
  decoded
) {
  const expiraEmSegundos =
    Number(decoded?.exp);

  if (
    !Number.isFinite(
      expiraEmSegundos
    )
  ) {
    return null;
  }

  const expiraEm =
    new Date(
      expiraEmSegundos * 1000
    );

  return Number.isNaN(
    expiraEm.getTime()
  )
    ? null
    : expiraEm;
}

async function revogarTokenSessao(
  token
) {
  if (!token) {
    return {
      revogado: false,
      motivo: "sem_token",
    };
  }

  let decoded;

  try {
    decoded =
      verificarToken(token);
  } catch (erro) {
    if (
      ERROS_TOKEN_INVALIDO.has(
        erro?.name
      )
    ) {
      return {
        revogado: false,
        motivo: "token_invalido",
      };
    }

    throw erro;
  }

  const usuarioId =
    normalizarUsuarioId(
      decoded?.id
    );

  const expiraEm =
    obterExpiracao(decoded);

  const tokenHash =
    hashToken(token);

  if (
    !usuarioId ||
    !expiraEm ||
    !tokenHash
  ) {
    return {
      revogado: false,
      motivo: "token_invalido",
    };
  }

  await sessionRevocationRepository
    .revogarToken({
      usuarioId,
      tokenHash,
      expiraEm,
    });

  return {
    revogado: true,
  };
}

module.exports = {
  revogarTokenSessao,
};
