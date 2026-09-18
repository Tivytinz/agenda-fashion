const db = require("../db/db");

async function buscarProfissionalPorSlug(slugNegocio, slugProfissional) {
  const result = await db.query(
    `
    SELECT
      u.id,
      u.nome,
      n.id AS negocio_id,
      n.nome AS negocio_nome
    FROM usuarios u
    INNER JOIN usuarios_negocios un
      ON un.usuario_id = u.id
    INNER JOIN negocios n
      ON n.id = un.negocio_id
    WHERE n.slug = $1
      AND u.slug = $2
      AND n.ativo = TRUE
      AND u.ativo = TRUE
      AND un.ativo = TRUE
    LIMIT 1
    `,
    [slugNegocio, slugProfissional]
  );

  return result.rows[0] || null;
}

async function buscarBloqueioHorario(profissionalId, data, hora) {
  const result = await db.query(
    `
    SELECT id
    FROM bloqueios_horario
    WHERE profissional_id = $1
      AND data = $2
      AND hora = $3
    LIMIT 1
    `,
    [profissionalId, data, hora]
  );

  return result.rows[0] || null;
}

async function buscarAgendamentoHorario(profissionalId, data, hora) {
  const result = await db.query(
    `
    SELECT id
    FROM agendamentos
    WHERE profissional_id = $1
      AND data = $2
      AND horario = $3
      AND status != 'cancelado'
    LIMIT 1
    `,
    [profissionalId, data, hora]
  );

  return result.rows[0] || null;
}


async function buscarBloqueioHorarioPainel(profissionalId, data, hora) {
  const result = await db.query(
    `
    SELECT id
    FROM bloqueios_horario
    WHERE profissional_id = $1
      AND data = $2
      AND hora = $3
    LIMIT 1
    `,
    [profissionalId, data, hora]
  );

  return result.rows[0] || null;
}

async function buscarAgendamentoHorarioPainel(profissionalId, data, hora) {
  const result = await db.query(
    `
    SELECT
      a.id,
      a.status,
      c.nome AS cliente,
      s.nome AS servico,
      COALESCE(
        a.valor_servico,
        s.valor,
        0
      )::numeric AS valor
    FROM agendamentos a
    LEFT JOIN usuarios c
      ON c.id = a.cliente_id
    LEFT JOIN servicos_negocio s
      ON s.id = a.servico_id
    WHERE a.profissional_id = $1
      AND a.data = $2
      AND a.horario = $3
      AND a.status != 'cancelado'
    LIMIT 1
    `,
    [profissionalId, data, hora]
  );

  return result.rows[0] || null;
}

async function buscarNegocioDono(usuarioId) {
  const result = await db.query(
    `
    SELECT un.negocio_id
    FROM usuarios_negocios un
    INNER JOIN usuarios u
      ON u.id = un.usuario_id
    INNER JOIN negocios n
      ON n.id = un.negocio_id
    WHERE un.usuario_id = $1
      AND un.papel = 'dono'
      AND un.ativo = TRUE
      AND u.ativo = TRUE
      AND n.ativo = TRUE
    LIMIT 1
    `,
    [usuarioId]
  );

  return result.rows[0] || null;
}

async function verificarProfissionalNoNegocio(profissionalId, negocioId) {
  const result = await db.query(
    `
    SELECT un.id
    FROM usuarios_negocios un
    INNER JOIN usuarios u
      ON u.id = un.usuario_id
    WHERE un.usuario_id = $1
      AND un.negocio_id = $2
      AND un.ativo = TRUE
      AND u.ativo = TRUE
    LIMIT 1
    `,
    [profissionalId, negocioId]
  );

  return result.rows[0] || null;
}

async function bloquearAlteracaoHorario(
  profissionalId,
  data,
  hora,
  executor = db
) {
  void hora;

  await executor.query(
    `
    SELECT pg_advisory_xact_lock(
      $1::integer,
      hashtext($2::text)
    )
    `,
    [
      Number(profissionalId),
      String(data),
    ]
  );
}

async function buscarAgendamentoAtivo(
  profissionalId,
  data,
  hora,
  executor = db
) {
  const result = await executor.query(
    `
    SELECT id
    FROM agendamentos
    WHERE profissional_id = $1
      AND data = $2
      AND status IN ('agendado', 'confirmado')
      AND $3::time >= horario::time
      AND $3::time < (
        horario::time +
        make_interval(mins => duracao_minutos)
      )
    LIMIT 1
    `,
    [profissionalId, data, hora]
  );

  return result.rows[0] || null;
}

async function buscarBloqueioHorarioNovo(
  profissionalId,
  data,
  hora,
  executor = db
) {
  const result = await executor.query(
    `
    SELECT id
    FROM bloqueios_horarios
    WHERE profissional_id = $1
      AND data_bloqueio = $2
      AND TO_CHAR(hora_bloqueio, 'HH24:MI') = $3
    LIMIT 1
    `,
    [profissionalId, data, hora]
  );

  return result.rows[0] || null;
}

async function removerBloqueioHorario(bloqueioId, executor = db) {
  await executor.query(
    `
    DELETE FROM bloqueios_horarios
    WHERE id = $1
    `,
    [bloqueioId]
  );
}

async function criarBloqueioHorario(
  profissionalId,
  data,
  hora,
  executor = db
) {
  await executor.query(
    `
    INSERT INTO bloqueios_horarios (
      profissional_id,
      data_bloqueio,
      hora_bloqueio
    )
    VALUES ($1, $2, $3)
    `,
    [profissionalId, data, hora]
  );
}

async function buscarNegocioDoUsuario(usuarioId) {
  const result = await db.query(
    `
    SELECT
      n.id
    FROM negocios n
    INNER JOIN usuarios_negocios un
      ON un.negocio_id = n.id
    INNER JOIN usuarios u
      ON u.id = un.usuario_id
    WHERE un.usuario_id = $1
      AND un.ativo = TRUE
      AND u.ativo = TRUE
      AND n.ativo = TRUE
    ORDER BY
      CASE
        WHEN un.papel = 'dono' THEN 0
        ELSE 1
      END,
      un.created_at ASC,
      n.id ASC
    LIMIT 1
    `,
    [usuarioId]
  );

  return result.rows[0] || null;
}

async function buscarProfissionaisDoNegocio(negocioId) {
  const result = await db.query(
    `
    SELECT
      u.id,
      COALESCE(un.nome_exibicao, u.nome) AS nome,
      u.foto_url,
      COALESCE(
        ARRAY_AGG(
          ps.servico_id
          ORDER BY ps.servico_id
        ) FILTER (
          WHERE s.id IS NOT NULL
        ),
        ARRAY[]::BIGINT[]
      ) AS servico_ids
    FROM usuarios u
    INNER JOIN usuarios_negocios un
      ON un.usuario_id = u.id
    LEFT JOIN profissional_servicos ps
      ON ps.negocio_id = un.negocio_id
      AND ps.profissional_id = un.usuario_id
    LEFT JOIN servicos_negocio s
      ON s.id = ps.servico_id
      AND s.negocio_id = ps.negocio_id
      AND s.ativo = TRUE
    WHERE un.negocio_id = $1
      AND un.ativo = TRUE
      AND u.ativo = TRUE
    GROUP BY
      u.id,
      un.nome_exibicao
    ORDER BY COALESCE(un.nome_exibicao, u.nome) ASC
    `,
    [negocioId]
  );

  return result.rows;
}

async function buscarBloqueioHorarioGeral(profissionalId, data, hora) {
  const result = await db.query(
    `
    SELECT id
    FROM bloqueios_horarios
    WHERE profissional_id = $1
      AND data_bloqueio = $2
      AND TO_CHAR(hora_bloqueio, 'HH24:MI') = $3
    LIMIT 1
    `,
    [profissionalId, data, hora]
  );

  return result.rows[0] || null;
}

async function buscarAgendamentoHorarioGeral(profissionalId, data, hora) {
  const result = await db.query(
    `
    SELECT
      a.id,
      c.nome AS cliente,
      s.nome AS servico
    FROM agendamentos a
    LEFT JOIN usuarios c
      ON c.id = a.cliente_id
    LEFT JOIN servicos_negocio s
      ON s.id = a.servico_id
    WHERE a.profissional_id = $1
      AND a.data = $2
      AND TO_CHAR(a.horario, 'HH24:MI') = $3
      AND a.status IN ('agendado', 'confirmado')
    LIMIT 1
    `,
    [profissionalId, data, hora]
  );

  return result.rows[0] || null;
}

async function buscarVinculoUsuarioNegocio(usuarioId) {
  const result = await db.query(
    `
    SELECT un.negocio_id, un.papel
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
      CASE
        WHEN un.papel = 'dono' THEN 0
        ELSE 1
      END,
      un.created_at ASC,
      un.negocio_id ASC
    LIMIT 1
    `,
    [usuarioId]
  );

  return result.rows[0] || null;
}

async function contarNotificacoesAgendaDono(negocioId) {
  const result = await db.query(
    `
    SELECT COUNT(*)::int AS total
    FROM agendamentos
    WHERE negocio_id = $1
      AND data >= CURRENT_DATE
      AND status IN ('agendado', 'confirmado')
    `,
    [negocioId]
  );

  return result.rows[0]?.total || 0;
}

async function contarNotificacoesAgendaProfissional(profissionalId) {
  const result = await db.query(
    `
    SELECT COUNT(*)::int AS total
    FROM agendamentos
    WHERE profissional_id = $1
      AND data >= CURRENT_DATE
      AND status IN ('agendado', 'confirmado')
    `,
    [profissionalId]
  );

  return result.rows[0]?.total || 0;
}

async function buscarBloqueiosPorPeriodo(profissionalId, dataInicio, dataFim) {
  const result = await db.query(
    `
    SELECT
      id,
      profissional_id,
      TO_CHAR(data_bloqueio, 'YYYY-MM-DD') AS data,
      TO_CHAR(hora_bloqueio, 'HH24:MI') AS hora
    FROM bloqueios_horarios
    WHERE profissional_id = $1
      AND data_bloqueio BETWEEN $2 AND $3
    `,
    [profissionalId, dataInicio, dataFim]
  );

  return result.rows;
}

async function buscarAgendamentosPorPeriodo(
  profissionalId,
  dataInicio,
  dataFim
) {
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
        CASE
          WHEN un.papel = 'dono' THEN 0
          ELSE 1
        END,
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

      TO_CHAR(
        a.data,
        'YYYY-MM-DD'
      ) AS data,

      TO_CHAR(
        a.horario::time,
        'HH24:MI'
      ) AS hora,

      a.status,

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
        WHEN a.negocio_id = contexto.negocio_id THEN s.nome
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
        WHEN a.negocio_id = contexto.negocio_id THEN a.duracao_minutos::int
        ELSE NULL
      END AS duracao_minutos

    FROM agendamentos a
    CROSS JOIN contexto

    LEFT JOIN usuarios c
      ON c.id = a.cliente_id
      AND a.negocio_id = contexto.negocio_id

    LEFT JOIN servicos_negocio s
      ON s.id = a.servico_id
      AND a.negocio_id = contexto.negocio_id

    WHERE a.profissional_id = $1
      AND a.data BETWEEN $2 AND $3
      AND a.status != 'cancelado'

    ORDER BY
      a.data ASC,
      a.horario ASC
    `,
    [
      profissionalId,
      dataInicio,
      dataFim,
    ]
  );

  return result.rows;
}

async function buscarBloqueiosProfissionaisPorPeriodo(profissionalIds, dataInicio, dataFim) {
  const result = await db.query(
    `
    SELECT
      id,
      profissional_id,
      TO_CHAR(data_bloqueio, 'YYYY-MM-DD') AS data,
      TO_CHAR(hora_bloqueio, 'HH24:MI') AS hora
    FROM bloqueios_horarios
    WHERE profissional_id = ANY($1::int[])
      AND data_bloqueio BETWEEN $2 AND $3
    `,
    [profissionalIds, dataInicio, dataFim]
  );

  return result.rows;
}

async function buscarAgendamentosProfissionaisPorPeriodo(
  negocioId,
  profissionalIds,
  dataInicio,
  dataFim
) {
  const result = await db.query(
    `
    SELECT
      a.profissional_id,

      TO_CHAR(
        a.data,
        'YYYY-MM-DD'
      ) AS data,

      TO_CHAR(
        a.horario::time,
        'HH24:MI'
      ) AS hora,

      CASE
        WHEN a.negocio_id = $1
          THEN COALESCE(
            NULLIF(BTRIM(c.nome), ''),
            NULLIF(BTRIM(a.cliente_nome), '')
          )
        ELSE NULL
      END AS cliente,

      CASE
        WHEN a.negocio_id = $1
          THEN s.nome
        ELSE NULL
      END AS servico

    FROM agendamentos a

    LEFT JOIN usuarios c
      ON c.id = a.cliente_id
      AND a.negocio_id = $1

    LEFT JOIN servicos_negocio s
      ON s.id = a.servico_id
      AND s.negocio_id = $1

    WHERE a.profissional_id =
      ANY($2::int[])

      AND a.data BETWEEN $3 AND $4

      AND a.status != 'cancelado'

    ORDER BY
      a.data ASC,
      a.horario ASC
    `,
    [
      negocioId,
      profissionalIds,
      dataInicio,
      dataFim,
    ]
  );

  return result.rows;
}

module.exports = {
  buscarProfissionalPorSlug,
  buscarBloqueioHorario,
  buscarAgendamentoHorario,
  buscarBloqueioHorarioPainel,
  buscarAgendamentoHorarioPainel,
  buscarNegocioDono,
  verificarProfissionalNoNegocio,
  bloquearAlteracaoHorario,
  buscarAgendamentoAtivo,
  buscarBloqueioHorarioNovo,
  removerBloqueioHorario,
  criarBloqueioHorario,
  buscarNegocioDoUsuario,
  buscarProfissionaisDoNegocio,
  buscarBloqueioHorarioGeral,
  buscarAgendamentoHorarioGeral,
  buscarVinculoUsuarioNegocio,
  contarNotificacoesAgendaDono,
  contarNotificacoesAgendaProfissional,
  buscarBloqueiosPorPeriodo,
  buscarAgendamentosPorPeriodo,
  buscarBloqueiosProfissionaisPorPeriodo,
  buscarAgendamentosProfissionaisPorPeriodo
};
