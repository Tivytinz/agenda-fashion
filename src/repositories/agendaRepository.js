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
      s.valor
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

async function buscarAgendamentoAtivo(profissionalId, data, hora) {
  const result = await db.query(
    `
    SELECT id
    FROM agendamentos
    WHERE profissional_id = $1
      AND data = $2
      AND TO_CHAR(horario, 'HH24:MI') = $3
      AND status IN ('agendado', 'confirmado')
    LIMIT 1
    `,
    [profissionalId, data, hora]
  );

  return result.rows[0] || null;
}

async function buscarBloqueioHorarioNovo(profissionalId, data, hora) {
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

async function removerBloqueioHorario(bloqueioId) {
  await db.query(
    `
    DELETE FROM bloqueios_horarios
    WHERE id = $1
    `,
    [bloqueioId]
  );
}

async function criarBloqueioHorario(profissionalId, data, hora) {
  await db.query(
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
      u.nome,
      u.foto_url
    FROM usuarios u
    INNER JOIN usuarios_negocios un
      ON un.usuario_id = u.id
    WHERE un.negocio_id = $1
      AND un.ativo = TRUE
      AND u.ativo = TRUE
    ORDER BY u.nome ASC
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
    SELECT
      a.id AS agendamento_id,
      a.profissional_id,
      a.negocio_id,

      TO_CHAR(
        a.data,
        'YYYY-MM-DD'
      ) AS data,

      TO_CHAR(
        a.horario::time,
        'HH24:MI'
      ) AS hora,

      a.status,

      c.id AS cliente_id,
      COALESCE(
        NULLIF(BTRIM(c.nome), ''),
        NULLIF(BTRIM(a.cliente_nome), '')
      ) AS cliente,
      COALESCE(
        NULLIF(BTRIM(c.whatsapp), ''),
        NULLIF(BTRIM(a.cliente_whatsapp), '')
      ) AS cliente_whatsapp,

      s.id AS servico_id,
      s.nome AS servico,

      COALESCE(
        s.valor,
        0
      )::numeric AS valor,

      COALESCE(
        s.duracao_minutos,
        60
      )::int AS duracao_minutos

    FROM agendamentos a

    LEFT JOIN usuarios c
      ON c.id = a.cliente_id

    LEFT JOIN servicos_negocio s
      ON s.id = a.servico_id

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
  profissionalIds,
  dataInicio,
  dataFim
) {
  const result = await db.query(
    `
    SELECT
      a.id AS agendamento_id,
      a.profissional_id,
      a.negocio_id,

      TO_CHAR(
        a.data,
        'YYYY-MM-DD'
      ) AS data,

      TO_CHAR(
        a.horario::time,
        'HH24:MI'
      ) AS hora,

      a.status,

      c.id AS cliente_id,
      COALESCE(
        NULLIF(BTRIM(c.nome), ''),
        NULLIF(BTRIM(a.cliente_nome), '')
      ) AS cliente,
      COALESCE(
        NULLIF(BTRIM(c.whatsapp), ''),
        NULLIF(BTRIM(a.cliente_whatsapp), '')
      ) AS cliente_whatsapp,

      s.id AS servico_id,
      s.nome AS servico,

      COALESCE(
        s.valor,
        0
      )::numeric AS valor,

      COALESCE(
        s.duracao_minutos,
        60
      )::int AS duracao_minutos

    FROM agendamentos a

    LEFT JOIN usuarios c
      ON c.id = a.cliente_id

    LEFT JOIN servicos_negocio s
      ON s.id = a.servico_id

    WHERE a.profissional_id =
      ANY($1::int[])

      AND a.data BETWEEN $2 AND $3

      AND a.status != 'cancelado'

    ORDER BY
      a.data ASC,
      a.horario ASC
    `,
    [
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
