const db = require("../db/db");

async function listarAgendamentosCliente(clienteId) {
  const result = await db.query(
    `
      SELECT
        a.id,
        a.negocio_id,
        a.servico_id,
        a.profissional_id,
        TO_CHAR(a.data, 'YYYY-MM-DD') AS data,
        TO_CHAR(a.horario::time, 'HH24:MI') AS horario,
        a.status,
        a.avaliacao,
        a.status_atendimento_em,
        n.nome AS negocio,
        n.slug,
        u.nome AS profissional,
        COALESCE(
          NULLIF(BTRIM(a.servico_nome), ''),
          NULLIF(BTRIM(s.nome), ''),
          'Serviço'
        ) AS servico,
        COALESCE(a.valor_servico, s.valor, 0)::numeric AS valor
      FROM agendamentos a
      LEFT JOIN servicos_negocio s
        ON s.id = a.servico_id
      LEFT JOIN negocios n
        ON n.id = a.negocio_id
      LEFT JOIN usuarios u
        ON u.id = a.profissional_id
      INNER JOIN usuarios cliente_conta
        ON cliente_conta.id = a.cliente_id
        AND cliente_conta.ativo = TRUE
      WHERE a.cliente_id = $1
      ORDER BY
        a.data DESC,
        a.horario DESC
    `,
    [clienteId]
  );

  return result.rows;
}

async function buscarAgendamentoClienteParaAvaliacao(
  agendamentoId,
  clienteId,
  executor = db
) {
  const result = await executor.query(
    `
      SELECT
        a.id,
        a.status,
        a.avaliacao
      FROM agendamentos a
      INNER JOIN usuarios cliente
        ON cliente.id = a.cliente_id
        AND cliente.ativo = TRUE
      WHERE a.id = $1
        AND a.cliente_id = $2
      LIMIT 1
    `,
    [agendamentoId, clienteId]
  );

  return result.rows[0] || null;
}

async function avaliarAgendamentoRealizado(
  agendamentoId,
  clienteId,
  avaliacao
) {
  const result = await db.query(
    `
      UPDATE agendamentos
      SET avaliacao = $1
      WHERE id = $2
        AND cliente_id = $3
        AND status = 'realizado'
        AND avaliacao IS NULL
        AND EXISTS (
          SELECT 1
          FROM usuarios u
          WHERE u.id = $3
            AND u.ativo = TRUE
        )
      RETURNING id, avaliacao
    `,
    [avaliacao, agendamentoId, clienteId]
  );

  return result.rows[0] || null;
}

async function buscarAgendamentoOperacionalParaAtualizar({
  agendamentoId,
  negocioId,
  usuarioId,
  executor = db,
}) {
  const result = await executor.query(
    `
      SELECT
        a.id,
        a.negocio_id,
        a.profissional_id,
        a.status,
        TO_CHAR(a.data, 'YYYY-MM-DD') AS data,
        TO_CHAR(a.horario::time, 'HH24:MI') AS horario,
        COALESCE(a.duracao_minutos, s.duracao_minutos, 0)::int AS duracao_minutos,
        COALESCE(NULLIF(n.fuso_horario, ''), 'America/Sao_Paulo') AS fuso_horario,
        un.papel AS papel_executor,
        a.atendimento_iniciado_em,
        a.atendimento_iniciado_por,
        a.status_atendimento_em,
        a.status_atendimento_por
      FROM agendamentos a
      INNER JOIN negocios n
        ON n.id = a.negocio_id
        AND n.ativo = TRUE
      INNER JOIN usuarios_negocios un
        ON un.negocio_id = a.negocio_id
        AND un.usuario_id = $3
        AND un.ativo = TRUE
      INNER JOIN usuarios executor_usuario
        ON executor_usuario.id = un.usuario_id
        AND executor_usuario.ativo = TRUE
      LEFT JOIN servicos_negocio s
        ON s.id = a.servico_id
      WHERE a.id = $1
        AND a.negocio_id = $2
      LIMIT 1
      FOR UPDATE OF a, un
    `,
    [agendamentoId, negocioId, usuarioId]
  );

  return result.rows[0] || null;
}

async function marcarAtendimentoIniciado({
  agendamentoId,
  usuarioId,
  executor = db,
}) {
  const result = await executor.query(
    `
      UPDATE agendamentos
      SET
        atendimento_iniciado_em = COALESCE(
          atendimento_iniciado_em,
          NOW()
        ),
        atendimento_iniciado_por = COALESCE(
          atendimento_iniciado_por,
          $2
        )
      WHERE id = $1
        AND status IN ('agendado', 'confirmado')
      RETURNING
        id,
        status,
        atendimento_iniciado_em,
        atendimento_iniciado_por
    `,
    [agendamentoId, usuarioId]
  );

  return result.rows[0] || null;
}

async function atualizarStatusAtendimento({
  agendamentoId,
  status,
  usuarioId,
  executor = db,
}) {
  const result = await executor.query(
    `
      UPDATE agendamentos
      SET
        status = $2,
        status_atendimento_em = NOW(),
        status_atendimento_por = $3
      WHERE id = $1
        AND status IN ('agendado', 'confirmado')
      RETURNING
        id,
        status,
        status_atendimento_em,
        status_atendimento_por
    `,
    [agendamentoId, status, usuarioId]
  );

  return result.rows[0] || null;
}

async function listarAgendamentosProfissionalPorPeriodo({
  profissionalId,
  dataInicio,
  dataFim,
}) {
  const result = await db.query(
    `
      WITH contexto AS (
        SELECT un.negocio_id
        FROM usuarios_negocios un
        INNER JOIN usuarios u
          ON u.id = un.usuario_id
        INNER JOIN negocios n
          ON n.id = un.negocio_id
        WHERE un.usuario_id = $1
          AND un.ativo = TRUE
          AND u.ativo = TRUE
          AND n.ativo = TRUE
        ORDER BY
          CASE WHEN un.papel = 'dono' THEN 0 ELSE 1 END,
          un.created_at ASC,
          un.negocio_id ASC
        LIMIT 1
      )
      SELECT
        CASE
          WHEN a.negocio_id = contexto.negocio_id THEN a.id
          ELSE NULL
        END AS agendamento_id,
        a.profissional_id,
        CASE
          WHEN a.negocio_id = contexto.negocio_id THEN a.negocio_id
          ELSE NULL
        END AS negocio_id,
        TO_CHAR(a.data, 'YYYY-MM-DD') AS data,
        TO_CHAR(a.horario::time, 'HH24:MI') AS hora,
        CASE
          WHEN a.negocio_id = contexto.negocio_id THEN a.status
          ELSE 'agendado'
        END AS status,
        CASE
          WHEN a.negocio_id = contexto.negocio_id THEN c.id
          ELSE NULL
        END AS cliente_id,
        CASE
          WHEN a.negocio_id = contexto.negocio_id THEN COALESCE(
            NULLIF(BTRIM(c.nome), ''),
            NULLIF(BTRIM(a.cliente_nome), '')
          )
          ELSE NULL
        END AS cliente,
        CASE
          WHEN a.negocio_id = contexto.negocio_id THEN COALESCE(
            NULLIF(BTRIM(c.whatsapp), ''),
            NULLIF(BTRIM(a.cliente_whatsapp), '')
          )
          ELSE NULL
        END AS cliente_whatsapp,
        CASE
          WHEN a.negocio_id = contexto.negocio_id THEN s.id
          ELSE NULL
        END AS servico_id,
        CASE
          WHEN a.negocio_id = contexto.negocio_id THEN COALESCE(
            NULLIF(BTRIM(a.servico_nome), ''),
            NULLIF(BTRIM(s.nome), ''),
            'Serviço'
          )
          ELSE NULL
        END AS servico,
        CASE
          WHEN a.negocio_id = contexto.negocio_id THEN COALESCE(
            a.valor_servico,
            s.valor,
            0
          )::numeric
          ELSE NULL
        END AS valor,
        CASE
          WHEN a.negocio_id = contexto.negocio_id THEN COALESCE(
            a.duracao_minutos,
            s.duracao_minutos,
            0
          )::int
          ELSE NULL
        END AS duracao_minutos,
        CASE
          WHEN a.negocio_id = contexto.negocio_id
            AND a.status IN ('agendado', 'confirmado')
            AND (
              a.data::timestamp +
              a.horario::time +
              INTERVAL '15 minutes'
            ) <= (
              NOW() AT TIME ZONE COALESCE(
                NULLIF(n_agendamento.fuso_horario, ''),
                'America/Sao_Paulo'
              )
            )
          THEN TRUE
          ELSE FALSE
        END AS pode_marcar_falta,
        CASE
          WHEN a.negocio_id = contexto.negocio_id
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
      CROSS JOIN contexto
      INNER JOIN negocios n_agendamento
        ON n_agendamento.id = a.negocio_id
      LEFT JOIN usuarios c
        ON c.id = a.cliente_id
        AND a.negocio_id = contexto.negocio_id
      LEFT JOIN servicos_negocio s
        ON s.id = a.servico_id
        AND a.negocio_id = contexto.negocio_id
      WHERE a.profissional_id = $1
        AND a.data BETWEEN $2 AND $3
        AND (
          (
            a.negocio_id = contexto.negocio_id
            AND a.status <> 'cancelado'
          )
          OR (
            a.negocio_id <> contexto.negocio_id
            AND a.status IN ('agendado', 'confirmado')
          )
        )
      ORDER BY
        a.data ASC,
        a.horario ASC
    `,
    [profissionalId, dataInicio, dataFim]
  );

  return result.rows;
}

async function listarAgendamentosProfissionaisDoNegocioPorPeriodo({
  negocioId,
  profissionalIds,
  dataInicio,
  dataFim,
}) {
  const result = await db.query(
    `
      SELECT
        CASE
          WHEN a.negocio_id = $1 THEN a.id
          ELSE NULL
        END AS agendamento_id,
        a.profissional_id,
        TO_CHAR(a.data, 'YYYY-MM-DD') AS data,
        TO_CHAR(a.horario::time, 'HH24:MI') AS hora,
        CASE
          WHEN a.negocio_id = $1 THEN a.status
          ELSE 'agendado'
        END AS status,
        CASE
          WHEN a.negocio_id = $1 THEN COALESCE(
            NULLIF(BTRIM(c.nome), ''),
            NULLIF(BTRIM(a.cliente_nome), '')
          )
          ELSE NULL
        END AS cliente,
        CASE
          WHEN a.negocio_id = $1 THEN COALESCE(
            NULLIF(BTRIM(a.servico_nome), ''),
            NULLIF(BTRIM(s.nome), ''),
            'Serviço'
          )
          ELSE NULL
        END AS servico,
        CASE
          WHEN a.negocio_id = $1
            AND a.status IN ('agendado', 'confirmado')
            AND (
              a.data::timestamp +
              a.horario::time +
              INTERVAL '15 minutes'
            ) <= (
              NOW() AT TIME ZONE COALESCE(
                NULLIF(n_agendamento.fuso_horario, ''),
                'America/Sao_Paulo'
              )
            )
          THEN TRUE
          ELSE FALSE
        END AS pode_marcar_falta,
        CASE
          WHEN a.negocio_id = $1
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
        AND a.negocio_id = $1
      LEFT JOIN servicos_negocio s
        ON s.id = a.servico_id
        AND s.negocio_id = $1
      WHERE a.profissional_id = ANY($2::int[])
        AND a.data BETWEEN $3 AND $4
        AND (
          (
            a.negocio_id = $1
            AND a.status <> 'cancelado'
          )
          OR (
            a.negocio_id <> $1
            AND a.status IN ('agendado', 'confirmado')
          )
        )
      ORDER BY
        a.data ASC,
        a.horario ASC
    `,
    [negocioId, profissionalIds, dataInicio, dataFim]
  );

  return result.rows;
}

module.exports = {
  listarAgendamentosCliente,
  buscarAgendamentoClienteParaAvaliacao,
  avaliarAgendamentoRealizado,
  buscarAgendamentoOperacionalParaAtualizar,
  marcarAtendimentoIniciado,
  atualizarStatusAtendimento,
  listarAgendamentosProfissionalPorPeriodo,
  listarAgendamentosProfissionaisDoNegocioPorPeriodo,
};