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
    WHERE un.usuario_id = $1
      AND un.papel = 'dono'
    LIMIT 1
    `,
    [usuarioId]
  );

  return result.rows[0] || null;
}

async function verificarProfissionalNoNegocio(profissionalId, negocioId) {
  const result = await db.query(
    `
    SELECT id
    FROM usuarios_negocios
    WHERE usuario_id = $1
      AND negocio_id = $2
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
    WHERE un.usuario_id = $1
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
    SELECT negocio_id, papel
    FROM usuarios_negocios
    WHERE usuario_id = $1
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
  contarNotificacoesAgendaProfissional
};