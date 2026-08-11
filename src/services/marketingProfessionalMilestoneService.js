const agendaConfiguracaoRepository = require(
  "../repositories/agendaConfiguracaoRepository"
);

const registrador = require(
  "../utils/registrador"
);

async function marcarAgendaConfigurada(
  usuarioId
) {
  try {
    return await agendaConfiguracaoRepository
      .marcarConfigurada(
        usuarioId
      );
  } catch (erro) {
    registrador.aviso(
      "[Marketing] Não foi possível marcar a agenda como configurada.",
      {
        usuario_id:
          usuarioId,
        erro:
          erro?.message,
      }
    );

    return null;
  }
}

module.exports = {
  marcarAgendaConfigurada,
};
