const oauthService = require(
  "../services/tiktokMarketingOAuthService"
);
const registrador = require("../utils/registrador");

async function iniciar(req, res, next) {
  try {
    const resultado = await oauthService.iniciarAutorizacao({
      usuarioId: req.user?.id
    });
    return res.json(resultado);
  } catch (erro) {
    return next(erro);
  }
}

async function callback(req, res) {
  let destino = oauthService.urlResultado("error");

  try {
    await oauthService.concluirAutorizacao({
      state: req.query?.state,
      authCode: req.query?.auth_code
    });
    destino = oauthService.urlResultado("success");
  } catch (erro) {
    registrador.aviso(
      "OAuth TikTok Ads não concluído.",
      erro?.statusCode || erro?.status || "oauth_error"
    );
  }

  return res.redirect(303, destino);
}

module.exports = {
  iniciar,
  callback
};
