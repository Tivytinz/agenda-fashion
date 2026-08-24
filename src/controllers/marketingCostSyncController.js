const service = require("../services/marketingCostSyncService");

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
      usuarioId: req.admin?.usuarioId
    }));
  } catch (erro) {
    return next(erro);
  }
}

module.exports = { status, listarCampanhas, testar, vincular, sincronizar };
