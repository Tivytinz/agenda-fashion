const notificacoesRepository = require("../repositories/notificacoesRepository");

const {
  exigirUsuario,
  exigirCampo
} = require("../validators/commonValidator");

async function listarNotificacoes({ usuarioId }) {
  exigirUsuario(usuarioId);

  const notificacoes =
    await notificacoesRepository.listarNotificacoes(usuarioId);

  return { notificacoes };
}

async function marcarComoLida({ usuarioId, notificacaoId }) {
  exigirUsuario(usuarioId);
  exigirCampo(notificacaoId, "Notificação não informada.");

  await notificacoesRepository.marcarComoLida(
    notificacaoId,
    usuarioId
  );

  return {
    sucesso: true
  };
}

module.exports = {
  listarNotificacoes,
  marcarComoLida
};