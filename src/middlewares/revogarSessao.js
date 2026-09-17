const {
  limparCookieSessao,
  obterTokenDaRequisicao,
} = require(
  "../config/sessionCookie"
);

const sessionRevocationService =
  require(
    "../services/sessionRevocationService"
  );

module.exports =
  async function revogarSessao(
    req,
    res,
    next
  ) {
    const {
      token,
    } =
      obterTokenDaRequisicao(req);

    try {
      await sessionRevocationService
        .revogarTokenSessao(token);

      return next();
    } catch (erro) {
      limparCookieSessao(res);
      res.set(
        "Cache-Control",
        "no-store"
      );

      return next(erro);
    }
  };
