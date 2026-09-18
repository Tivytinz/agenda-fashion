const profissionalServicosService = require(
  "../services/profissionalServicosService"
);

async function listarServicosProfissional(req, res, next) {
  try {
    const resultado =
      await profissionalServicosService
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

async function atualizarServicosProfissional(req, res, next) {
  try {
    const resultado =
      await profissionalServicosService
        .atualizarServicosProfissional({
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
  listarServicosProfissional,
  atualizarServicosProfissional,
};
