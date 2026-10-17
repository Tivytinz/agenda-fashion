const dashboardActivationRepository = require(
  "../repositories/dashboardActivationRepository"
);

const MOTIVOS_INDISPONIBILIDADE = new Set([
  "SEM_PROFISSIONAL_HABILITADA",
  "SEM_HORARIOS",
  "DURACAO_INCOMPATIVEL",
]);

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
      possui_servico: false,
      possui_servico_ativo: false,
      negocio_publicado: false,
      publicacao_pausada_manualmente: false,
      agenda_configurada: false,
      possui_disponibilidade_agendavel: false,
      motivo_indisponibilidade: null,
      primeiro_agendamento_recebido: false,
    };
  }

  const estado =
    await dashboardActivationRepository
      .buscarEstadoAtivacao(
        id
      );

  return {
    possui_servico:
      estado?.possui_servico === true,
    possui_servico_ativo:
      estado?.possui_servico_ativo === true,
    negocio_publicado:
      estado?.negocio_publicado === true,
    publicacao_pausada_manualmente:
      estado?.publicacao_pausada_manualmente === true,
    agenda_configurada:
      estado?.agenda_configurada === true,
    possui_disponibilidade_agendavel:
      estado
        ?.possui_disponibilidade_agendavel ===
      true,
    motivo_indisponibilidade:
      estado?.possui_disponibilidade_agendavel !== true &&
      MOTIVOS_INDISPONIBILIDADE.has(estado?.motivo_indisponibilidade)
        ? estado.motivo_indisponibilidade
        : null,
    primeiro_agendamento_recebido:
      estado?.primeiro_agendamento_recebido === true,
  };
}

module.exports = {
  buscarAtivacaoNegocio,
};
