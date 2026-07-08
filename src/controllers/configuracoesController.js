const configuracoesService = require("../services/configuracoesService");

async function buscarConfiguracoes(req, res, next) {
  try {
    const resultado =
      await configuracoesService.buscarConfiguracoes({
        usuarioId: req.user?.id
      });

    return res.json(resultado);
  } catch (err) {
    next(err);
  }
}

async function salvarConfiguracoes(req, res, next) {
  try {
    const resultado =
      await configuracoesService.salvarConfiguracoes({
        usuarioId: req.user?.id,
        dados: req.body
      });

    return res.json(resultado);
  } catch (err) {
    next(err);
  }
}

module.exports = {
  buscarConfiguracoes,
  salvarConfiguracoes
};