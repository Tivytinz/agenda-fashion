const jwt = require(
  "jsonwebtoken"
);

/*
 * Obtém o segredo usado para
 * validar os tokens JWT.
 */
function obterJwtSecret() {
  const segredo =
    String(
      process.env.JWT_SECRET ||
        ""
    ).trim();

  if (!segredo) {
    throw new Error(
      "JWT_SECRET não configurado nas variáveis de ambiente."
    );
  }

  return segredo;
}

/*
 * Extrai o token do cabeçalho:
 *
 * Authorization: Bearer TOKEN
 */
function obterTokenDoCabecalho(
  authHeader
) {
  if (!authHeader) {
    return null;
  }

  const partes =
    String(authHeader)
      .trim()
      .split(/\s+/);

  if (
    partes.length !== 2 ||
    partes[0].toLowerCase() !==
      "bearer" ||
    !partes[1]
  ) {
    return null;
  }

  return partes[1];
}

/*
 * Middleware obrigatório.
 *
 * Rotas que usam este middleware
 * só continuam quando existe um
 * token JWT válido.
 */
module.exports = function auth(
  req,
  res,
  next
) {
  const token =
    obterTokenDoCabecalho(
      req.headers.authorization
    );

  if (!token) {
    return res
      .status(401)
      .json({
        erro:
          "Token não enviado ou formato inválido.",
      });
  }

  try {
    const decoded =
      jwt.verify(
        token,
        obterJwtSecret()
      );

    if (!decoded?.id) {
      return res
        .status(401)
        .json({
          erro:
            "Token inválido.",
        });
    }

    /*
     * O token identifica somente
     * a conta autenticada.
     *
     * Papel de dono ou profissional
     * será consultado no banco.
     */
    req.user = {
      id:
        decoded.id,
    };

    return next();
  } catch (erro) {
    if (
      erro.message ===
      "JWT_SECRET não configurado nas variáveis de ambiente."
    ) {
      console.error(
        "Erro de configuração JWT:",
        erro.message
      );

      return res
        .status(500)
        .json({
          erro:
            "Configuração de autenticação inválida.",
        });
    }

    if (
      erro.name ===
      "TokenExpiredError"
    ) {
      return res
        .status(401)
        .json({
          erro:
            "Token expirado.",
        });
    }

    return res
      .status(401)
      .json({
        erro:
          "Token inválido.",
      });
  }
};