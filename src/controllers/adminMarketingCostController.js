const adminMarketingCostService =
  require(
    "../services/adminMarketingCostService"
  );

async function buscarCustos(
  req,
  res,
  next
) {
  try {
    const resultado =
      await adminMarketingCostService
        .buscarCustos({
          periodo:
            req.query?.periodo,
        });

    return res
      .status(200)
      .json(resultado);
  } catch (erro) {
    return next(erro);
  }
}

async function listarGastos(
  req,
  res,
  next
) {
  try {
    const resultado =
      await adminMarketingCostService
        .listarGastos({
          periodo:
            req.query?.periodo,
        });

    return res
      .status(200)
      .json(resultado);
  } catch (erro) {
    return next(erro);
  }
}

async function registrarGasto(
  req,
  res,
  next
) {
  try {
    const resultado =
      await adminMarketingCostService
        .registrarGasto({
          payload: req.body,
          usuarioId:
            req.admin?.usuarioId,
        });

    return res
      .status(200)
      .json(resultado);
  } catch (erro) {
    return next(erro);
  }
}

module.exports = {
  buscarCustos,
  listarGastos,
  registrarGasto,
};
