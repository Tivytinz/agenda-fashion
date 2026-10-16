const service = require(
  "../services/adminContributionOperationsService"
);

async function buscarPainel(
  req,
  res,
  next
) {
  try {
    const resultado =
      await service.buscarPainel({
        adminAutorizado:
          req.admin?.papel ===
          "admin",
      });

    return res
      .status(200)
      .json(resultado);
  } catch (erro) {
    return next(erro);
  }
}

async function criarFonte(
  req,
  res,
  next
) {
  try {
    const resultado =
      await service.criarFonte({
        payload:
          req.body || {},
        usuarioId:
          req.admin?.usuarioId,
        adminAutorizado:
          req.admin?.papel ===
          "admin",
      });

    return res
      .status(201)
      .json(resultado);
  } catch (erro) {
    return next(erro);
  }
}

async function registrarCusto(
  req,
  res,
  next
) {
  try {
    const resultado =
      await service.registrarCusto({
        payload:
          req.body || {},
        usuarioId:
          req.admin?.usuarioId,
        adminAutorizado:
          req.admin?.papel ===
          "admin",
      });

    return res
      .status(201)
      .json(resultado);
  } catch (erro) {
    return next(erro);
  }
}

async function registrarCobertura(
  req,
  res,
  next
) {
  try {
    const resultado =
      await service
        .registrarCobertura({
          payload:
            req.body || {},
          usuarioId:
            req.admin?.usuarioId,
          adminAutorizado:
            req.admin?.papel ===
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
  buscarPainel,
  criarFonte,
  registrarCusto,
  registrarCobertura,
};
