const db = require("../db/db");

async function buscarVinculoProfissionalAtivo(
  usuarioId,
  executor = db
) {
  const result = await executor.query(
    `
      SELECT
        un.negocio_id,
        un.papel
      FROM usuarios_negocios un
      INNER JOIN usuarios u
        ON u.id = un.usuario_id
      INNER JOIN negocios n
        ON n.id = un.negocio_id
      WHERE un.usuario_id = $1
        AND un.papel = 'profissional'
        AND un.ativo = TRUE
        AND u.ativo = TRUE
        AND n.ativo = TRUE
      ORDER BY
        un.created_at ASC,
        un.negocio_id ASC
      LIMIT 1
    `,
    [usuarioId]
  );

  return result.rows[0] || null;
}

async function buscarVinculoOperacionalDoAgendamento({
  agendamentoId,
  usuarioId,
  executor = db,
}) {
  const result = await executor.query(
    `
      SELECT
        a.negocio_id,
        un.papel
      FROM agendamentos a
      INNER JOIN negocios n
        ON n.id = a.negocio_id
        AND n.ativo = TRUE
      INNER JOIN usuarios_negocios un
        ON un.negocio_id = a.negocio_id
        AND un.usuario_id = $2
        AND un.ativo = TRUE
      INNER JOIN usuarios u
        ON u.id = un.usuario_id
        AND u.ativo = TRUE
      WHERE a.id = $1
      LIMIT 1
    `,
    [agendamentoId, usuarioId]
  );

  return result.rows[0] || null;
}

async function listarAgendamentosProfissionalPorPeriodo({
  profissionalId,
  negocioId,
  dataInicio,
  dataFim,
}) {
  const result = await db.query(
    `
      SELECT
        CASE
          WHEN a.negocio_id = $2 THEN a.id
          ELSE NULL
        END AS agendamento_id,
        a.profissional_id,
        CASE
          WHEN a.negocio_id = $2 THEN a.negocio_id
          ELSE NULL
        END AS negocio_id,
        TO_CHAR(a.data, 'YYYY-MM-DD') AS data,
        TO_CHAR(a.horario::time, 'HH24:MI') AS hora,
        CASE
          WHEN a.negocio_id = $2 THEN a.status
          ELSE 'agendado'
        END AS status,
        CASE
          WHEN a.negocio_id = $2 THEN c.id
          ELSE NULL
        END AS cliente_id,
        CASE
          WHEN a.negocio_id = $2 THEN COALESCE(
            NULLIF(BTRIM(c.nome), ''),
            NULLIF(BTRIM(a.cliente_nome), '')
          )
          ELSE NULL
        END AS cliente,
        CASE
          WHEN a.negocio_id = $2 THEN COALESCE(
            NULLIF(BTRIM(c.whatsapp), ''),
            NULLIF(BTRIM(a.cliente_whatsapp), '')
          )
          ELSE NULL
        END AS cliente_whatsapp,
        CASE
          WHEN a.negocio_id = $2 THEN s.id
          ELSE NULL
        END AS servico_id,
        CASE
          WHEN a.negocio_id = $2 THEN COALESCE(
            NULLIF(BTRIM(a.servico_nome), ''),
            NULLIF(BTRIM(s.nome), ''),
            'Serviço'
          )
          ELSE NULL
        END AS servico,
        CASE
          WHEN a.negocio_id = $2 THEN COALESCE(
            a.valor_servico,
            s.valor,
            0
          )::numeric
          ELSE NULL
        END AS valor,
        CASE
          WHEN a.negocio_id = $2 THEN COALESCE(
            a.duracao_minutos,
            s.duracao_minutos,
            0
          )::int
          ELSE NULL
        END AS duracao_minutos,
        CASE
          WHEN a.negocio_id = $2
            AND a.status IN ('agendado', 'confirmado')
            AND (a.data::timestamp + a.horario::time) <= (
              NOW() AT TIME ZONE COALESCE(
                NULLIF(n_agendamento.fuso_horario, ''),
                'America/Sao_Paulo'
              )
            )
          THEN TRUE
          ELSE FALSE
        END AS pode_marcar_falta,
        CASE
          WHEN a.negocio_id = $2
            AND a.status IN ('agendado', 'confirmado')
            AND (
              a.data::timestamp +
              a.horario::time +
              make_interval(
                mins => COALESCE(
                  a.duracao_minutos,
                  s.duracao_minutos,
                  0
                )
              )
            ) <= (
              NOW() AT TIME ZONE COALESCE(
                NULLIF(n_agendamento.fuso_horario, ''),
                'America/Sao_Paulo'
              )
            )
          THEN TRUE
          ELSE FALSE
        END AS pode_marcar_realizado
      FROM agendamentos a
      INNER JOIN negocios n_agendamento
        ON n_agendamento.id = a.negocio_id
      LEFT JOIN usuarios c
        ON c.id = a.cliente_id
        AND a.negocio_id = $2
      LEFT JOIN servicos_negocio s
        ON s.id = a.servico_id
        AND a.negocio_id = $2
      WHERE a.profissional_id = $1
        AND a.data BETWEEN $3 AND $4
        AND (
          (
            a.negocio_id = $2
            AND a.status <> 'cancelado'
          )
          OR (
            a.negocio_id <> $2
            AND a.status IN ('agendado', 'confirmado')
          )
        )
      ORDER BY
        a.data ASC,
        a.horario ASC
    `,
    [
      profissionalId,
      negocioId,
      dataInicio,
      dataFim,
    ]
  );

  return result.rows;
}

module.exports = {
  buscarVinculoProfissionalAtivo,
  buscarVinculoOperacionalDoAgendamento,
  listarAgendamentosProfissionalPorPeriodo,
};
