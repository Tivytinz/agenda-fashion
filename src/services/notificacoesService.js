const notificacoesRepository = require("../repositories/notificacoesRepository");

async function listarNotificacoes({ usuarioId }) {
  if (!usuarioId) {
    throw new Error("Usuário não autenticado.");
  }

  const notificacoes =
    await notificacoesRepository.listarNotificacoes(usuarioId);

  return { notificacoes };
}

async function marcarComoLida({ usuarioId, notificacaoId }) {
  if (!usuarioId) {
    throw new Error("Usuário não autenticado.");
  }

  if (!notificacaoId) {
    throw new Error("Notificação não informada.");
  }

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