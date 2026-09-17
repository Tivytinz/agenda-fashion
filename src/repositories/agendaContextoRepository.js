const db = require("../db/db");

/*
 * Lista os compromissos de uma profissional preservando duas garantias:
 *
 * 1. dados do cliente/serviço aparecem somente para o negócio contextual
 *    validado pelo backend;
 * 2. compromissos ativos da mesma pessoa em outro negócio continuam ocupando
 *    o horário, sem revelar dados daquele outro contexto.
 */
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
  listarAgendamentosProfissionalPorPeriodo,
};
