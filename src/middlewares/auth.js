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
 * Middleware obrigatório.
 *
 * Rotas que usam este middleware
 * só continuam quando existe um
 * token JWT válido.
 */
function tokenAnteriorATrocaDeSenha(
  decoded,
  senhaAlteradaEm
) {
  if (!senhaAlteradaEm) {
    return false;
  }

  const emitidoEmSegundos =
    Number(decoded?.iat);

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

module.exports = async function auth(
  req,
  res,
  next
) {
  const {
    token,
    origem,
  } = obterTokenDaRequisicao(req);

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
        obterJwtSecret(),
        {
          algorithms: [
            "HS256",
          ],
        }
      );

    if (!decoded?.id) {
      if (origem === "cookie") {
        limparCookieSessao(res);
      }

      return res
        .status(401)
        .json({
          erro:
            "Token inválido.",
        });
    }

    const estadoDaSessao =
      await authSessionRepository
        .buscarEstadoDaSessao(
          decoded.id
        );

    if (
      !estadoDaSessao ||
      estadoDaSessao.ativo !== true ||
      tokenAnteriorATrocaDeSenha(
        decoded,
        estadoDaSessao
          .senha_alterada_em
      )
    ) {
      if (origem === "cookie") {
        limparCookieSessao(res);
      }

      return res
        .status(401)
        .json({
          erro:
            "Sessão inválida ou encerrada.",
        });
    }

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
      registrador.erro(
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
      if (origem === "cookie") {
        limparCookieSessao(res);
      }

      return res
        .status(401)
        .json({
          erro:
            "Token expirado.",
        });
    }

    if (
      ![
        "JsonWebTokenError",
        "NotBeforeError",
      ].includes(
        erro.name
      )
    ) {
      return next(erro);
    }

    if (origem === "cookie") {
      limparCookieSessao(res);
    }

    return res
      .status(401)
      .json({
        erro:
          "Token inválido.",
      });
  }
};

module.exports.tokenAnteriorATrocaDeSenha =
  tokenAnteriorATrocaDeSenha;
