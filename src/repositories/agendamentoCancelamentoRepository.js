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
          2
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
        a.inicio_previsto_em,
        a.fuso_horario_snapshot,
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

async function buscarAgendamentoVisitanteParaConsultar({
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
        a.servico_nome,
        COALESCE(
          a.valor_servico,
          s.valor,
          0
        )::numeric AS valor,
        TO_CHAR(a.data, 'YYYY-MM-DD') AS data,
        TO_CHAR(a.horario::time, 'HH24:MI') AS horario,
        a.inicio_previsto_em,
        a.fuso_horario_snapshot,
        COALESCE(
          NULLIF(n.fuso_horario, ''),
          'America/Sao_Paulo'
        ) AS fuso_horario,
        n.nome AS negocio_nome,
        COALESCE(
          NULLIF(BTRIM(un.nome_exibicao), ''),
          profissional.nome
        ) AS profissional_nome
      FROM agendamentos a
      INNER JOIN negocios n
        ON n.id = a.negocio_id
      INNER JOIN usuarios profissional
        ON profissional.id = a.profissional_id
      LEFT JOIN usuarios_negocios un
        ON un.negocio_id = a.negocio_id
        AND un.usuario_id = a.profissional_id
      LEFT JOIN servicos_negocio s
        ON s.id = a.servico_id
      WHERE a.id = $1
        AND a.cliente_id IS NULL
      LIMIT 1
    `,
    [agendamentoId]
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
        a.inicio_previsto_em,
        a.fuso_horario_snapshot,
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

async function buscarAgendamentoOperacionalParaCancelar({
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
        a.inicio_previsto_em,
        a.fuso_horario_snapshot,
        COALESCE(
          NULLIF(n.fuso_horario, ''),
          'America/Sao_Paulo'
        ) AS fuso_horario,
        un.papel AS papel_executor,
        a.cancelado_em,
        a.cancelado_por,
        a.cancelamento_origem,
        a.motivo_cancelamento
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
      WHERE a.id = $1
        AND a.negocio_id = $2
      LIMIT 1
      FOR UPDATE OF a, un
    `,
    [agendamentoId, negocioId, usuarioId]
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
        cancelado_em = NOW(),
        cancelado_por = $2,
        cancelamento_origem = 'cliente',
        motivo_cancelamento = NULL
      WHERE id = $1
        AND cliente_id = $2
        AND status <> 'cancelado'
      RETURNING
        id,
        status,
        cancelado_em,
        cancelado_por,
        cancelamento_origem,
        motivo_cancelamento
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
        cancelado_em = NOW(),
        cancelado_por = NULL,
        cancelamento_origem = 'visitante',
        motivo_cancelamento = NULL
      WHERE id = $1
        AND cliente_id IS NULL
        AND status <> 'cancelado'
      RETURNING
        id,
        status,
        cancelado_em,
        cancelado_por,
        cancelamento_origem,
        motivo_cancelamento
    `,
    [agendamentoId]
  );

  return result.rows[0] || null;
}

async function cancelarAgendamentoOperacional({
  agendamentoId,
  usuarioId,
  motivo,
  executor = db,
}) {
  const result = await executor.query(
    `
      UPDATE agendamentos
      SET
        status = 'cancelado',
        cancelado_em = NOW(),
        cancelado_por = $2,
        cancelamento_origem = 'negocio',
        motivo_cancelamento = $3
      WHERE id = $1
        AND status IN ('agendado', 'confirmado')
      RETURNING
        id,
        status,
        cancelado_em,
        cancelado_por,
        cancelamento_origem,
        motivo_cancelamento
    `,
    [agendamentoId, usuarioId, motivo]
  );

  return result.rows[0] || null;
}

module.exports = {
  buscarPoliticaPublica,
  buscarAgendamentoClienteParaCancelar,
  buscarAgendamentoVisitanteParaConsultar,
  buscarAgendamentoVisitanteParaCancelar,
  buscarAgendamentoOperacionalParaCancelar,
  cancelarAgendamentoCliente,
  cancelarAgendamentoVisitante,
  cancelarAgendamentoOperacional,
};
