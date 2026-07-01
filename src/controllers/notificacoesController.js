const notificacoesService = require("../services/notificacoesService");

async function listarNotificacoes(req, res, next) {
  try {
    const resultado =
      await notificacoesService.listarNotificacoes({
        usuarioId: req.user?.id
      });

    return res.json(resultado);
  } catch (err) {
    next(err);
  }
}

async function marcarComoLida(req, res, next) {
  try {
    const resultado =
      await notificacoesService.marcarComoLida({
        usuarioId: req.user?.id,
        notificacaoId: req.params.id
      });

    return res.json(resultado);
  } catch (err) {
    next(err);
  }
}

module.exports = {
  listarNotificacoes,
  marcarComoLida
};