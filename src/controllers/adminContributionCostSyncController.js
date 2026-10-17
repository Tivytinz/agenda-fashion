const service = require(
  "../services/contributionCostSyncService"
);

async function buscarStatus(
  req,
  res,
  next
) {
  try {
    const resultado =
      await service.status();

    return res
      .status(200)
      .json(resultado);
  } catch (erro) {
    return next(erro);
  }
}

async function criarIntegracao(
  req,
  res,
  next
) {
  try {
    const resultado =
      await service
        .criarIntegracao({
          payload:
            req.body || {},
          adminAutorizado:
            req.admin
              ?.papel ===
            "admin",
        });

    return res
      .status(201)
      .json(resultado);
  } catch (erro) {
    return next(erro);
  }
}

async function atualizarIntegracao(
  req,
  res,
  next
) {
  try {
    const resultado =
      await service
        .atualizarIntegracao({
          integracaoId:
            req.params?.id,
          payload:
            req.body || {},
          adminAutorizado:
            req.admin
              ?.papel ===
            "admin",
        });

    return res
      .status(200)
      .json(resultado);
  } catch (erro) {
    return next(erro);
  }
}

async function sincronizar(
  req,
  res,
  next
) {
  try {
    const resultado =
      await service
        .sincronizarManual({
          integracaoId:
            req.params?.id,
          adminAutorizado:
            req.admin
              ?.papel ===
            "admin",
        });

    return res
      .status(200)
      .json(resultado);
  } catch (erro) {
    return next(erro);
  }
}

module.exports = {
  buscarStatus,
  criarIntegracao,
  atualizarIntegracao,
  sincronizar,
};
