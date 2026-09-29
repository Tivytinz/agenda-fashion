function sqlPossuiDisponibilidadeAgendavel(
  negocioIdSql
) {
  return `
    EXISTS (
      SELECT 1
      FROM usuarios_negocios disponibilidade_un
      INNER JOIN usuarios disponibilidade_u
        ON disponibilidade_u.id =
          disponibilidade_un.usuario_id
        AND disponibilidade_u.ativo = TRUE
      INNER JOIN agenda_horarios disponibilidade_ah
        ON disponibilidade_ah.profissional_id =
          disponibilidade_un.usuario_id
        AND disponibilidade_ah.negocio_id =
          disponibilidade_un.negocio_id
      INNER JOIN profissional_servicos disponibilidade_ps
        ON disponibilidade_ps.profissional_id =
          disponibilidade_un.usuario_id
        AND disponibilidade_ps.negocio_id =
          disponibilidade_un.negocio_id
      INNER JOIN servicos_negocio disponibilidade_s
        ON disponibilidade_s.id =
          disponibilidade_ps.servico_id
        AND disponibilidade_s.negocio_id =
          disponibilidade_un.negocio_id
        AND disponibilidade_s.ativo = TRUE
      WHERE disponibilidade_un.negocio_id =
          ${negocioIdSql}
        AND disponibilidade_un.ativo = TRUE
        AND disponibilidade_un.papel IN (
          'dono',
          'profissional'
        )
        AND disponibilidade_ah.trabalha = TRUE
        AND disponibilidade_ah.hora_inicio
          IS NOT NULL
        AND disponibilidade_ah.hora_fim
          IS NOT NULL
        AND disponibilidade_ah.hora_inicio <
          disponibilidade_ah.hora_fim
        AND (
          CASE
            WHEN
              disponibilidade_ah.intervalo_inicio
                IS NOT NULL
              AND disponibilidade_ah.intervalo_fim
                IS NOT NULL
              AND disponibilidade_ah.intervalo_inicio <
                disponibilidade_ah.intervalo_fim
              AND disponibilidade_ah.intervalo_inicio >
                disponibilidade_ah.hora_inicio
              AND disponibilidade_ah.intervalo_fim <
                disponibilidade_ah.hora_fim
            THEN GREATEST(
              EXTRACT(
                EPOCH FROM (
                  disponibilidade_ah.intervalo_inicio -
                  disponibilidade_ah.hora_inicio
                )
              ) / 60,
              EXTRACT(
                EPOCH FROM (
                  disponibilidade_ah.hora_fim -
                  disponibilidade_ah.intervalo_fim
                )
              ) / 60
            )
            ELSE EXTRACT(
              EPOCH FROM (
                disponibilidade_ah.hora_fim -
                disponibilidade_ah.hora_inicio
              )
            ) / 60
          END
        ) >= disponibilidade_s.duracao_minutos
    )
  `;
}

function sqlPossuiPrimeiroAgendamentoValido(
  negocioIdSql
) {
  return `
    EXISTS (
      SELECT 1
      FROM agendamentos ativacao_agendamento
      WHERE ativacao_agendamento.negocio_id =
          ${negocioIdSql}
        AND ativacao_agendamento.status NOT IN (
          'cancelado',
          'cancelamento_solicitado'
        )
    )
  `;
}

module.exports = {
  sqlPossuiDisponibilidadeAgendavel,
  sqlPossuiPrimeiroAgendamentoValido,
};
