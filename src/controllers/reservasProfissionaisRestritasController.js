const service = require("../services/reservasProfissionaisRestritasService");

async function listar(req, res, next) {
  try {
    return res.json(await service.listar({ usuarioId: req.user?.id, pagina: req.query.pagina }));
  } catch (erro) {
    return next(erro);
  }
}

module.exports = { listar };
