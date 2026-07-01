const configuracoesService = require("../services/configuracoesService");

async function buscarConfiguracoes(req, res, next) {
  try {
    const resultado =
      await configuracoesService.buscarConfiguracoes({
        usuarioId: req.user?.id
      });

    return res.json(resultado);
  } catch (err) {
    console.error("ERRO AO BUSCAR CONFIGURAÇÕES:");
    console.error(err);
    console.error(err.stack);

    next(err);
  }
}

async function salvarConfiguracoes(req, res, next) {
  try {
    console.log("REQ.USER CONFIGURAÇÕES:", req.user);
    console.log("BODY CONFIGURAÇÕES:", req.body);

    const resultado =
      await configuracoesService.salvarConfiguracoes({
        usuarioId: req.user?.id,
        dados: req.body
      });

    return res.json(resultado);
  } catch (err) {
    console.error("ERRO COMPLETO CONFIGURAÇÕES:");
    console.error(err);
    console.error(err.stack);

    next(err);
  }
}

module.exports = {
  buscarConfiguracoes,
  salvarConfiguracoes
};