const service = require("../services/marketingCostSyncService");
const tiktokOAuthService = require("../services/tiktokOAuthService");

const TIKTOK_CALLBACK_PATH = "/admin/trafego-pago/custos";

async function status(req, res, next) {
  try {
    return res.status(200).json(await service.statusIntegracoes());
  } catch (erro) {
    return next(erro);
  }
}

async function listarCampanhas(req, res, next) {
  try {
    return res.status(200).json(await service.listarCampanhasExternas({
      provedor: req.params?.provedor
    }));
  } catch (erro) {
    return next(erro);
  }
}

async function testar(req, res, next) {
  try {
    return res.status(200).json(await service.testarIntegracao({
      provedor: req.params?.provedor
    }));
  } catch (erro) {
    return next(erro);
  }
}

async function vincular(req, res, next) {
  try {
    return res.status(200).json(await service.vincularCampanha({ payload: req.body }));
  } catch (erro) {
    return next(erro);
  }
}

async function sincronizar(req, res, next) {
  try {
    return res.status(200).json(await service.sincronizar({
      provedor: req.params?.provedor,
      payload: req.body,
      usuarioId: req.user?.id
    }));
  } catch (erro) {
    return next(erro);
  }
}

async function iniciarAutorizacaoTikTok(req, res, next) {
  try {
    const resultado = await tiktokOAuthService.iniciarAutorizacao({
      usuarioId: req.user?.id
    });
    return res.status(200).json(resultado);
  } catch (erro) {
    return next(erro);
  }
}

function callbackEhTikTok(req) {
  return Boolean(
    req.query?.auth_code ||
    req.query?.state ||
    req.query?.error ||
    req.query?.error_description
  );
}

async function callbackTikTok(req, res, next) {
  if (!callbackEhTikTok(req)) {
    return next();
  }

  if (req.query?.error) {
    return res.redirect(303, `${TIKTOK_CALLBACK_PATH}?tiktok_oauth=error`);
  }

  try {
    await tiktokOAuthService.finalizarAutorizacao({
      authCode: req.query?.auth_code,
      state: req.query?.state
    });

    return res.redirect(303, `${TIKTOK_CALLBACK_PATH}?tiktok_oauth=success`);
  } catch (erro) {
    req.tiktokOAuthError = erro;
    return res.redirect(303, `${TIKTOK_CALLBACK_PATH}?tiktok_oauth=error`);
  }
}

module.exports = {
  status,
  listarCampanhas,
  testar,
  vincular,
  sincronizar,
  iniciarAutorizacaoTikTok,
  callbackTikTok,
  callbackEhTikTok
};
