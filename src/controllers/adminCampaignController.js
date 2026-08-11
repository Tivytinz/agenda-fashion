const adminCampaignService =
  require(
    "../services/adminCampaignService"
  );

async function listar(
  req,
  res,
  next
) {
  try {
    const resultado =
      await adminCampaignService
        .listarCampanhas();

    return res
      .status(200)
      .json(resultado);
  } catch (erro) {
    return next(erro);
  }
}

async function criar(
  req,
  res,
  next
) {
  try {
    const resultado =
      await adminCampaignService
        .criarCampanha({
          payload:
            req.body || {},
          usuarioId:
            req.admin?.usuarioId,
        });

    return res
      .status(201)
      .json(resultado);
  } catch (erro) {
    return next(erro);
  }
}

async function atualizar(
  req,
  res,
  next
) {
  try {
    const resultado =
      await adminCampaignService
        .atualizarCampanha({
          id:
            req.params?.id,
          payload:
            req.body || {},
        });

    return res
      .status(200)
      .json(resultado);
  } catch (erro) {
    return next(erro);
  }
}

module.exports = {
  listar,
  criar,
  atualizar,
};
