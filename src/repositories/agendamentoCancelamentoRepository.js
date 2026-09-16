const db = require("../db/db");

async function buscarPoliticaPublica({
  slug,
  profissionalId,
  executor = db,
}) {
  const result = await executor.query(
    `
      SELECT
        n.id AS negocio_id,
        un.usuario_id AS profissional_id,
        COALESCE(
          ac.antecedencia_cancelamento,
          24
        )::int AS antecedencia_cancelamento_horas
      FROM negocios n
      INNER JOIN usuarios_negocios un
        ON un.negocio_id = n.id
        AND un.usuario_id = $2
        AND un.ativo = TRUE
        AND un.papel IN ('dono', 'profissional')
      INNER JOIN usuarios u
        ON u.id = un.usuario_id
        AND u.ativo = TRUE
      LEFT JOIN agenda_configuracoes ac
        ON ac.profissional_id = un.usuario_id
      WHERE n.slug = $1
        AND n.ativo = TRUE
        AND n.publicado = TRUE
      LIMIT 1
    `,
    [slug, profissionalId]
  );

  return result.rows[0] || null;
}

async function buscarAgendamentoClienteParaCancelar({
  agendamentoId,
  clienteId,
  executor = db,
}) {
  const result = await executor.query(
    `
      SELECT
        a.id,
        a.negocio_id,
        a.profissional_id,
        a.cliente_id,
        a.status,
        a.antecedencia_cancelamento_horas,
        TO_CHAR(a.data, 'YYYY-MM-DD') AS data,
        TO_CHAR(a.horario::time, 'HH24:MI') AS horario,
        COALESCE(
          NULLIF(n.fuso_horario, ''),
          'America/Sao_Paulo'
        ) AS fuso_horario
      FROM agendamentos a
      INNER JOIN negocios n
        ON n.id = a.negocio_id
      INNER JOIN usuarios cliente
        ON cliente.id = a.cliente_id
        AND cliente.ativo = TRUE
      WHERE a.id = $1
        AND a.cliente_id = $2
      LIMIT 1
      FOR UPDATE OF a
    `,
    [agendamentoId, clienteId]
  );

  return result.rows[0] || null;
}

async function buscarAgendamentoVisitanteParaCancelar({
  agendamentoId,
  executor = db,
}) {
  const result = await executor.query(
    `
      SELECT
        a.id,
        a.negocio_id,
        a.profissional_id,
        a.cliente_id,
        a.status,
        a.antecedencia_cancelamento_horas,
        TO_CHAR(a.data, 'YYYY-MM-DD') AS data,
        TO_CHAR(a.horario::time, 'HH24:MI') AS horario,
        COALESCE(
          NULLIF(n.fuso_horario, ''),
          'America/Sao_Paulo'
        ) AS fuso_horario
      FROM agendamentos a
      INNER JOIN negocios n
        ON n.id = a.negocio_id
      WHERE a.id = $1
        AND a.cliente_id IS NULL
      LIMIT 1
      FOR UPDATE OF a
    `,
    [agendamentoId]
  );

  return result.rows[0] || null;
}

async function cancelarAgendamentoCliente({
  agendamentoId,
  clienteId,
  executor = db,
}) {
  const result = await executor.query(
    `
      UPDATE agendamentos
      SET
        status = 'cancelado',
        cancelado_em = NOW()
      WHERE id = $1
        AND cliente_id = $2
        AND status <> 'cancelado'
      RETURNING
        id,
        status,
        cancelado_em
    `,
    [agendamentoId, clienteId]
  );

  return result.rows[0] || null;
}

async function cancelarAgendamentoVisitante({
  agendamentoId,
  executor = db,
}) {
  const result = await executor.query(
    `
      UPDATE agendamentos
      SET
        status = 'cancelado',
        cancelado_em = NOW()
      WHERE id = $1
        AND cliente_id IS NULL
        AND status <> 'cancelado'
      RETURNING
        id,
        status,
        cancelado_em
    `,
    [agendamentoId]
  );

  return result.rows[0] || null;
}

module.exports = {
  buscarPoliticaPublica,
  buscarAgendamentoClienteParaCancelar,
  buscarAgendamentoVisitanteParaCancelar,
  cancelarAgendamentoCliente,
  cancelarAgendamentoVisitante,
};
