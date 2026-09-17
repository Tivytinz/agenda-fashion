const planoService = require("../services/planoService");

async function listarPlanos(_req, res, next) {
  try {
    const planos = await planoService.listarPlanos();
    return res.json({ planos });
  } catch (erro) {
    return next(erro);
  }
}

async function buscarMeuPlano(req, res, next) {
  try {
    const plano = await planoService.buscarMeuPlano(
      req.user?.id
    );
    return res.json(plano);
  } catch (erro) {
    return next(erro);
  }
}

module.exports = {
  listarPlanos,
  buscarMeuPlano,
};
