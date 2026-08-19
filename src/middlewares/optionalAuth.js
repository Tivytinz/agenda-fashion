const jwt = require(
  "jsonwebtoken"
);

const authSessionRepository = require(
  "../repositories/authSessionRepository"
);
const registrador = require("../utils/registrador");
const {
  limparCookieSessao,
  obterTokenDaRequisicao,
} = require(
  "../config/sessionCookie"
);

const {
  tokenAnteriorATrocaDeSenha,
} = require("./auth");

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
 * Middleware de autenticação opcional.
 *
 * Com token válido:
 * req.user recebe o ID da conta.
 *
 * Sem token ou com token inválido:
 * a requisição continua como visitante.
 */
module.exports =
  async function optionalAuth(
    req,
    res,
    next
  ) {
    const {
      token,
      origem,
    } = obterTokenDaRequisicao(req);

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
      registrador.erro(
        "JWT_SECRET não configurado no optionalAuth."
      );

      return next();
    }

    try {
      const decoded =
        jwt.verify(
          token,
          jwtSecret,
          {
            algorithms: [
              "HS256",
            ],
          }
        );

      if (decoded?.id) {
        const estadoDaSessao =
          await authSessionRepository
            .buscarEstadoDaSessao(
              decoded.id
            );

        if (
          estadoDaSessao?.ativo ===
            true &&
          !tokenAnteriorATrocaDeSenha(
            decoded,
            estadoDaSessao
              .senha_alterada_em
          )
        ) {
          req.user = {
            id:
              decoded.id,
          };
        } else if (
          origem === "cookie"
        ) {
          limparCookieSessao(res);
        }
      } else if (
        origem === "cookie"
      ) {
        limparCookieSessao(res);
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

      if (origem === "cookie") {
        limparCookieSessao(res);
      }

      if (
        ![
          "JsonWebTokenError",
          "TokenExpiredError",
          "NotBeforeError",
        ].includes(
          erro.name
        )
      ) {
        return next(erro);
      }
    }

    return next();
  };
