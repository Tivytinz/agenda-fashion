const dashboardActivationRepository = require(
  "../repositories/dashboardActivationRepository"
);

async function buscarAtivacaoNegocio({
  negocioId,
}) {
  const id = Number(
    negocioId
  );

  if (
    !Number.isInteger(id) ||
    id <= 0
  ) {
    return {
      possui_servico_ativo: false,
      negocio_publicado: false,
      agenda_configurada: false,
      primeiro_agendamento_recebido: false,
    };
  }

  const estado =
    await dashboardActivationRepository
      .buscarEstadoAtivacao(
        id
      );

  return {
    possui_servico_ativo:
      estado?.possui_servico_ativo === true,
    negocio_publicado:
      estado?.negocio_publicado === true,
    agenda_configurada:
      estado?.agenda_configurada === true,
    primeiro_agendamento_recebido:
      estado?.primeiro_agendamento_recebido === true,
  };
}

module.exports = {
  buscarAtivacaoNegocio,
};
