const db = require("../db/db");

async function buscarNegocioPorSlug(slug) {
  const result = await db.query(
    `
    SELECT
      id,
      nome,
      slug,
      whatsapp_negocio
    FROM negocios
    WHERE slug = $1
    LIMIT 1
    `,
    [slug]
  );

  return result.rows[0] || null;
}

async function buscarServicoDoNegocio(
  servicoId,
  negocioId
) {
  const result = await db.query(
    `
    SELECT
      id,
      nome,
      valor,
      duracao_minutos
    FROM servicos_negocio
    WHERE id = $1
      AND negocio_id = $2
    LIMIT 1
    `,
    [servicoId, negocioId]
  );

  return result.rows[0] || null;
}

async function buscarProfissionalDoNegocio(
  profissionalId,
  negocioId
) {
  const result = await db.query(
    `
    SELECT
      u.id,
      u.nome,
      u.whatsapp,
      un.papel
    FROM usuarios_negocios un
    INNER JOIN usuarios u
      ON u.id = un.usuario_id
    WHERE un.usuario_id = $1
      AND un.negocio_id = $2
    LIMIT 1
    `,
    [profissionalId, negocioId]
  );

  return result.rows[0] || null;
}

async function listarAgendamentosOcupados(
  profissionalId,
  dataInicio,
  dataFim
) {
  const result = await db.query(
    `
    SELECT
      TO_CHAR(
        a.data,
        'YYYY-MM-DD'
      ) AS data,

      TO_CHAR(
        a.horario::time,
        'HH24:MI'
      ) AS horario,

      COALESCE(
        s.duracao_minutos,
        60
      )::int AS duracao_minutos

    FROM agendamentos a

    LEFT JOIN servicos_negocio s
      ON s.id = a.servico_id

    WHERE a.profissional_id = $1
      AND a.data BETWEEN $2 AND $3
      AND a.status IN (
        'agendado',
        'confirmado'
      )

    ORDER BY
      a.data,
      a.horario
    `,
    [
      profissionalId,
      dataInicio,
      dataFim,
    ]
  );

  return result.rows;
}

async function listarBloqueios(
  profissionalId,
  dataInicio,
  dataFim
) {
  const result = await db.query(
    `
    SELECT
      TO_CHAR(
        data_bloqueio,
        'YYYY-MM-DD'
      ) AS data,

      TO_CHAR(
        hora_bloqueio,
        'HH24:MI'
      ) AS horario

    FROM bloqueios_horarios

    WHERE profissional_id = $1
      AND data_bloqueio BETWEEN $2 AND $3

    ORDER BY
      data_bloqueio,
      hora_bloqueio
    `,
    [
      profissionalId,
      dataInicio,
      dataFim,
    ]
  );

  return result.rows;
}

async function bloquearAgendaProfissional(
  client,
  profissionalId,
  data
) {
  if (
    !client ||
    typeof client.query !== "function"
  ) {
    throw new Error(
      "Conexão transacional inválida."
    );
  }

  if (!profissionalId || !data) {
    throw new Error(
      "Profissional e data são obrigatórios para bloquear a agenda."
    );
  }

  await client.query(
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

async function buscarClientePorWhatsapp(
  whatsapp
) {
  const result = await db.query(
    `
    SELECT id
    FROM usuarios
    WHERE tipo = 'cliente'
      AND whatsapp = $1
    LIMIT 1
    `,
    [whatsapp]
  );

  return result.rows[0] || null;
}

async function criarCliente(
  nome,
  whatsapp
) {
  const result = await db.query(
    `
    INSERT INTO usuarios (
      nome,
      email,
      whatsapp,
      senha,
      tipo
    )
    VALUES (
      $1,
      $2,
      $3,
      $4,
      'cliente'
    )
    RETURNING id
    `,
    [
      nome.trim(),
      `cliente_${Date.now()}@agenda.local`,
      whatsapp.trim(),
      "",
    ]
  );

  return result.rows[0];
}

async function buscarBloqueioHorario(
  profissionalId,
  data,
  horario
) {
  const result = await db.query(
    `
    SELECT id
    FROM bloqueios_horarios
    WHERE profissional_id = $1
      AND data_bloqueio = $2
      AND TO_CHAR(
        hora_bloqueio,
        'HH24:MI'
      ) = $3
    LIMIT 1
    `,
    [
      profissionalId,
      data,
      horario,
    ]
  );

  return result.rows[0] || null;
}

async function buscarAgendamentoNoHorario(
  profissionalId,
  data,
  horario
) {
  const result = await db.query(
    `
    SELECT id
    FROM agendamentos
    WHERE profissional_id = $1
      AND data = $2
      AND TO_CHAR(
        horario::time,
        'HH24:MI'
      ) = $3
      AND status IN (
        'agendado',
        'confirmado'
      )
    LIMIT 1
    `,
    [
      profissionalId,
      data,
      horario,
    ]
  );

  return result.rows[0] || null;
}

async function criarAgendamento(
  {
    data,
    horario,
    profissionalId,
    clienteId,
    servicoId,
    negocioId,
  },
  executor = db
) {
  if (
    !executor ||
    typeof executor.query !== "function"
  ) {
    throw new Error(
      "Executor de banco de dados inválido."
    );
  }

  const result = await executor.query(
    `
    INSERT INTO agendamentos (
      data,
      horario,
      profissional_id,
      cliente_id,
      servico_id,
      negocio_id,
      status
    )
    VALUES (
      $1,
      $2,
      $3,
      $4,
      $5,
      $6,
      'agendado'
    )
    RETURNING *
    `,
    [
      data,
      horario,
      profissionalId,
      clienteId,
      servicoId,
      negocioId,
    ]
  );

  return result.rows[0];
}

async function criarNotificacaoAgendamento({
  usuarioId,
  negocioId,
  agendamentoId,
  titulo,
  mensagem,
}) {
  await db.query(
    `
    INSERT INTO notificacoes (
      usuario_id,
      negocio_id,
      agendamento_id,
      titulo,
      mensagem
    )
    VALUES (
      $1,
      $2,
      $3,
      $4,
      $5
    )
    `,
    [
      usuarioId,
      negocioId,
      agendamentoId,
      titulo,
      mensagem,
    ]
  );
}

async function listarMeusAgendamentos(
  clienteId
) {
  const result = await db.query(
    `
    SELECT
      a.id,

      TO_CHAR(
        a.data,
        'YYYY-MM-DD'
      ) AS data,

      TO_CHAR(
        a.horario::time,
        'HH24:MI'
      ) AS horario,

      CASE
        WHEN a.status = 'cancelado'
          THEN 'cancelado'

        WHEN (
          a.data::timestamp +
          a.horario::time
        ) < (
          NOW() AT TIME ZONE
          'America/Sao_Paulo'
        )
          THEN 'realizado'

        ELSE 'agendado'
      END AS status,

      a.avaliacao,

      n.nome AS negocio,
      n.slug,

      u.nome AS profissional,

      s.nome AS servico,
      s.valor

    FROM agendamentos a

    LEFT JOIN servicos_negocio s
      ON s.id = a.servico_id

    LEFT JOIN negocios n
      ON n.id = a.negocio_id

    LEFT JOIN usuarios u
      ON u.id = a.profissional_id

    WHERE a.cliente_id = $1

    ORDER BY
      a.data DESC,
      a.horario DESC
    `,
    [clienteId]
  );

  return result.rows;
}

async function buscarAgendamentoCliente(
  agendamentoId,
  clienteId
) {
  const result = await db.query(
    `
    SELECT
      id,

      TO_CHAR(
        data,
        'YYYY-MM-DD'
      ) AS data,

      TO_CHAR(
        horario::time,
        'HH24:MI'
      ) AS horario,

      profissional_id,
      status,
      avaliacao

    FROM agendamentos

    WHERE id = $1
      AND cliente_id = $2

    LIMIT 1
    `,
    [
      agendamentoId,
      clienteId,
    ]
  );

  return result.rows[0] || null;
}

async function cancelarAgendamento(
  agendamentoId,
  clienteId
) {
  await db.query(
    `
    UPDATE agendamentos
    SET status = 'cancelado'
    WHERE id = $1
      AND cliente_id = $2
    `,
    [
      agendamentoId,
      clienteId,
    ]
  );
}

async function avaliarAgendamento(
  agendamentoId,
  clienteId,
  avaliacao
) {
  await db.query(
    `
    UPDATE agendamentos
    SET avaliacao = $1
    WHERE id = $2
      AND cliente_id = $3
    `,
    [
      avaliacao,
      agendamentoId,
      clienteId,
    ]
  );
}

module.exports = {
  buscarNegocioPorSlug,
  buscarServicoDoNegocio,
  buscarProfissionalDoNegocio,
  listarAgendamentosOcupados,
  listarBloqueios,
  bloquearAgendaProfissional,
  buscarClientePorWhatsapp,
  criarCliente,
  buscarBloqueioHorario,
  buscarAgendamentoNoHorario,
  criarAgendamento,
  criarNotificacaoAgendamento,
  listarMeusAgendamentos,
  buscarAgendamentoCliente,
  cancelarAgendamento,
  avaliarAgendamento,
};