const servicoProfissionalService = require(
  "../services/servicoProfissionalService"
);

async function listarServicos(req, res, next) {
  try {
    const resultado =
      await servicoProfissionalService
        .listarServicosProfissional({
          usuarioId:
            req.user?.id,
          profissionalId:
            req.params.id,
        });

    return res.json(resultado);
  } catch (erro) {
    return next(erro);
  }
}

async function listarProfissionaisElegiveis(
  req,
  res,
  next
) {
  try {
    const resultado =
      await servicoProfissionalService
        .listarProfissionaisElegiveisServico({
          usuarioId:
            req.user?.id,
          servicoId:
            req.params.id,
        });

    return res.json(resultado);
  } catch (erro) {
    return next(erro);
  }
}

async function configurarServicos(
  req,
  res,
  next
) {
  try {
    const resultado =
      await servicoProfissionalService
        .configurarServicosProfissional({
          usuarioId:
            req.user?.id,
          profissionalId:
            req.params.id,
          servicoIds:
            req.body?.servico_ids,
        });

    return res.json(resultado);
  } catch (erro) {
    return next(erro);
  }
}

module.exports = {
  listarServicos,
  listarProfissionaisElegiveis,
  configurarServicos,
};
