const db = require("../db/db");

async function buscarEstadoAtivacao(
  negocioId
) {
  const result = await db.query(
    `
      SELECT
        EXISTS (
          SELECT 1
          FROM servicos_negocio s
          WHERE s.negocio_id = n.id
        ) AS possui_servico,

        EXISTS (
          SELECT 1
          FROM servicos_negocio s
          WHERE s.negocio_id = n.id
            AND s.ativo = TRUE
        ) AS possui_servico_ativo,

        n.publicado = TRUE
          AS negocio_publicado,

        EXISTS (
          SELECT 1
          FROM usuarios_negocios un
          INNER JOIN usuarios u
            ON u.id = un.usuario_id
          INNER JOIN agenda_configuracoes ac
            ON ac.profissional_id =
              un.usuario_id
            AND ac.negocio_id =
              n.id
          WHERE un.negocio_id = n.id
            AND un.ativo = TRUE
            AND u.ativo = TRUE
            AND un.papel IN (
              'dono',
              'profissional'
            )
            AND ac.origem_horarios =
              'personalizado'
        ) AS agenda_configurada,

        EXISTS (
          SELECT 1
          FROM usuarios_negocios un
          INNER JOIN usuarios u
            ON u.id = un.usuario_id
          INNER JOIN agenda_horarios ah
            ON ah.profissional_id =
              un.usuario_id
            AND ah.negocio_id =
              n.id
          INNER JOIN profissional_servicos ps
            ON ps.profissional_id =
              un.usuario_id
            AND ps.negocio_id =
              n.id
          INNER JOIN servicos_negocio s
            ON s.id = ps.servico_id
            AND s.negocio_id =
              n.id
            AND s.ativo = TRUE
          WHERE un.negocio_id = n.id
            AND un.ativo = TRUE
            AND u.ativo = TRUE
            AND un.papel IN (
              'dono',
              'profissional'
            )
            AND ah.trabalha = TRUE
            AND ah.hora_inicio IS NOT NULL
            AND ah.hora_fim IS NOT NULL
            AND ah.hora_inicio < ah.hora_fim
        ) AS possui_disponibilidade_agendavel,

        EXISTS (
          SELECT 1
          FROM agendamentos a
          WHERE a.negocio_id = n.id
            AND a.status NOT IN (
              'cancelado',
              'cancelamento_solicitado'
            )
        ) AS primeiro_agendamento_recebido

      FROM negocios n
      WHERE n.id = $1
        AND n.ativo = TRUE
      LIMIT 1
    `,
    [negocioId]
  );

  return result.rows[0] || null;
}

module.exports = {
  buscarEstadoAtivacao,
};
