const contaService = require("../services/contaService");

async function buscarMinhaConta(req, res, next) {
  try {
    const resultado = await contaService.buscarMinhaConta({
      usuarioId: req.user?.id,
    });

    return res.json(resultado);
  } catch (err) {
    next(err);
  }
}

async function atualizarMinhaConta(req, res, next) {
  try {
    const resultado = await contaService.atualizarMinhaConta({
      usuarioId: req.user?.id,
      nome: req.body.nome,
      whatsapp: req.body.whatsapp,
    });

    return res.json(resultado);
  } catch (err) {
    next(err);
  }
}

async function alterarSenha(req, res, next) {
  try {
    const resultado = await contaService.alterarSenha({
      usuarioId: req.user?.id,
      senhaAtual: req.body.senhaAtual,
      novaSenha: req.body.novaSenha,
    });

    return res.json(resultado);
  } catch (err) {
    next(err);
  }
}

async function enviarFotoUsuario(req, res, next) {
  try {
    const resultado = await contaService.enviarFotoUsuario({
      usuarioId: req.user?.id,
      file: req.file,
    });

    return res.json(resultado);
  } catch (err) {
    next(err);
  }
}

module.exports = {
  buscarMinhaConta,
  atualizarMinhaConta,
  alterarSenha,
  enviarFotoUsuario,
};