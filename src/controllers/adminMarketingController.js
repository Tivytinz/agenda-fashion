const adminMarketingService =
  require(
    "../services/adminMarketingService"
  );

async function buscarResumo(
  req,
  res,
  next
) {
  try {
    const resultado =
      await adminMarketingService
        .buscarResumo({
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

async function listarCampanhas(
  req,
  res,
  next
) {
  try {
    const resultado =
      await adminMarketingService
        .listarCampanhas({
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

async function listarConversoes(
  req,
  res,
  next
) {
  try {
    const resultado =
      await adminMarketingService
        .listarConversoes({
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

module.exports = {
  buscarResumo,
  listarCampanhas,
  listarConversoes,
};
