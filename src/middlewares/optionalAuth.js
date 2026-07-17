const jwt = require(
  "jsonwebtoken"
);

/*
 * Retorna o segredo utilizado
 * para validar os tokens JWT.
 *
 * Como esta autenticação é opcional,
 * a ausência do segredo não bloqueia
 * o visitante, mas registra o erro.
 */
function obterJwtSecret() {
  return String(
    process.env.JWT_SECRET ||
      ""
  ).trim();
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
 * Middleware de autenticação opcional.
 *
 * Com token válido:
 * req.user recebe o ID da conta.
 *
 * Sem token ou com token inválido:
 * a requisição continua como visitante.
 */
module.exports =
  function optionalAuth(
    req,
    res,
    next
  ) {
    const token =
      obterTokenDoCabecalho(
        req.headers.authorization
      );

    /*
     * Nenhum token foi enviado.
     * A requisição continua normalmente
     * como visitante.
     */
    if (!token) {
      return next();
    }

    const jwtSecret =
      obterJwtSecret();

    /*
     * Uma rota pública não deve ficar
     * indisponível por causa da
     * autenticação opcional.
     */
    if (!jwtSecret) {
      console.error(
        "JWT_SECRET não configurado no optionalAuth."
      );

      return next();
    }

    try {
      const decoded =
        jwt.verify(
          token,
          jwtSecret
        );

      if (decoded?.id) {
        /*
         * O token identifica somente
         * a conta autenticada.
         *
         * Papéis e vínculos serão
         * consultados no banco.
         */
        req.user = {
          id:
            decoded.id,
        };
      }
    } catch (erro) {
      /*
       * Token inválido ou expirado.
       *
       * Como a autenticação é opcional,
       * a requisição continua como
       * visitante.
       */
      req.user =
        undefined;
    }

    return next();
  };