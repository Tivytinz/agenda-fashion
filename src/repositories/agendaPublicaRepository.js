const db = require("../db/db");

async function buscarNegocioPorSlug(
  slug
) {
  const result = await db.query(
    `
      SELECT
        id,
        nome,
        slug,
        whatsapp AS whatsapp_negocio

      FROM negocios

      WHERE slug = $1
        AND ativo = TRUE
        AND publicado = TRUE

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
        AND ativo = TRUE

      LIMIT 1
    `,
    [
      servicoId,
      negocioId,
    ]
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
        COALESCE(un.nome_exibicao, u.nome) AS nome,
        COALESCE(un.whatsapp_exibicao, u.whatsapp) AS whatsapp,
        un.papel

      FROM usuarios_negocios un

      INNER JOIN usuarios u
        ON u.id = un.usuario_id

      WHERE un.usuario_id = $1
        AND un.negocio_id = $2
        AND un.ativo = TRUE
        AND u.ativo = TRUE
        AND un.papel IN (
          'dono',
          'profissional'
        )

      LIMIT 1
    `,
    [
      profissionalId,
      negocioId,
    ]
  );

  return result.rows[0] || null;
}

async function buscarPreferenciaNotificacoesWhatsapp(
  usuarioId
) {
  const result = await db.query(
    `
      SELECT
        whatsapp,
        (
          whatsapp_notificacoes_consentido_em IS NOT NULL
          AND whatsapp_notificacoes_cancelado_em IS NULL
        ) AS aceita_notificacoes_whatsapp

      FROM usuarios

      WHERE id = $1
        AND ativo = TRUE

      LIMIT 1
    `,
    [usuarioId]
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
        AND data_bloqueio
          BETWEEN $2 AND $3

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

  if (
    !profissionalId ||
    !data
  ) {
    throw new Error(
      "Profissional e data são obrigatórios para bloquear a agenda."
    );
  }

  /*
   * Impede duas transações de validarem
   * e gravarem simultaneamente na agenda
   * do mesmo profissional e data.
   */
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
    clienteId = null,
    clienteNome = null,
    clienteWhatsapp = null,
    whatsappConsentido = false,
    servicoId,
    valorServico,
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

  const result =
    await executor.query(
      `
        INSERT INTO agendamentos (
          data,
          horario,
          profissional_id,
          cliente_id,
          cliente_nome,
          cliente_whatsapp,
          whatsapp_consentido_em,
          servico_id,
          valor_servico,
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
          CASE
            WHEN $7::BOOLEAN
              THEN NOW()
            ELSE NULL
          END,
          $8,
          $9,
          $10,
          'agendado'
        )
        RETURNING
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
          cliente_id,
          cliente_nome,
          cliente_whatsapp,
          whatsapp_consentido_em,
          servico_id,
          valor_servico,
          negocio_id,
          status,
          avaliacao,
          created_at,
          updated_at
      `,
      [
        data,
        horario,
        profissionalId,
        clienteId,
        clienteNome,
        clienteWhatsapp,
        whatsappConsentido,
        servicoId,
        valorServico,
        negocioId,
      ]
    );

  return result.rows[0] || null;
}

async function registrarConsentimentoWhatsappAgendamento(
  {
    agendamentoId,
    clienteId = null,
    telefone,
  },
  executor = db
) {
  const result = await executor.query(
    `
      INSERT INTO whatsapp_consentimentos (
        usuario_id,
        agendamento_id,
        telefone,
        escopo,
        acao,
        origem,
        texto_versao
      )
      VALUES (
        $1,
        $2,
        $3,
        'OPERACIONAL_CLIENTE',
        'CONSENTIDO',
        'AGENDAMENTO',
        'agendamento-cliente-v1'
      )
      RETURNING id
    `,
    [
      clienteId,
      agendamentoId,
      telefone,
    ]
  );

  return result.rows[0] || null;
}

async function criarNotificacaoAgendamento({
  usuarioId,
  negocioId,
  agendamentoId,
  titulo,
  mensagem,
}) {
  const result = await db.query(
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
      RETURNING
        id,
        usuario_id,
        negocio_id,
        agendamento_id,
        titulo,
        mensagem,
        lida,
        created_at
    `,
    [
      usuarioId,
      negocioId,
      agendamentoId,
      titulo,
      mensagem,
    ]
  );

  return result.rows[0] || null;
}

async function listarMeusAgendamentos(
  clienteId
) {
  const result = await db.query(
    `
      SELECT
        a.id,
        a.negocio_id,
        a.servico_id,
        a.profissional_id,

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
        COALESCE(
          a.valor_servico,
          s.valor,
          0
        )::numeric AS valor

      FROM agendamentos a

      LEFT JOIN servicos_negocio s
        ON s.id = a.servico_id

      LEFT JOIN negocios n
        ON n.id = a.negocio_id

      LEFT JOIN usuarios u
        ON u.id = a.profissional_id
      INNER JOIN usuarios cliente_conta
        ON cliente_conta.id =
          a.cliente_id
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

async function buscarAgendamentoCliente(
  agendamentoId,
  clienteId,
  executor = db,
  {
    bloquear = false,
  } = {}
) {
  const bloqueio =
    bloquear
      ? "FOR UPDATE"
      : "";

  const result = await executor.query(
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
        cliente_id,
        status,
        avaliacao

      FROM agendamentos

      WHERE id = $1
        AND cliente_id = $2
        AND EXISTS (
          SELECT 1
          FROM usuarios u
          WHERE u.id = $2
            AND u.ativo = TRUE
        )

      LIMIT 1

      ${bloqueio}
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
  clienteId,
  executor = db
) {
  const result = await executor.query(
    `
      UPDATE agendamentos

      SET
        status = 'cancelado',
        cancelado_em = NOW()

      WHERE id = $1
        AND cliente_id = $2
        AND status <> 'cancelado'
        AND EXISTS (
          SELECT 1
          FROM usuarios u
          WHERE u.id = $2
            AND u.ativo = TRUE
        )

      RETURNING
        id,
        status,
        cancelado_em
    `,
    [
      agendamentoId,
      clienteId,
    ]
  );

  return result.rows[0] || null;
}

async function avaliarAgendamento(
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
        AND EXISTS (
          SELECT 1
          FROM usuarios u
          WHERE u.id = $3
            AND u.ativo = TRUE
        )

      RETURNING
        id,
        avaliacao
    `,
    [
      avaliacao,
      agendamentoId,
      clienteId,
    ]
  );

  return result.rows[0] || null;
}

module.exports = {
  buscarNegocioPorSlug,
  buscarServicoDoNegocio,
  buscarProfissionalDoNegocio,
  buscarPreferenciaNotificacoesWhatsapp,
  listarAgendamentosOcupados,
  listarBloqueios,
  bloquearAgendaProfissional,
  buscarBloqueioHorario,
  buscarAgendamentoNoHorario,
  criarAgendamento,
  registrarConsentimentoWhatsappAgendamento,
  criarNotificacaoAgendamento,
  listarMeusAgendamentos,
  buscarAgendamentoCliente,
  cancelarAgendamento,
  avaliarAgendamento,
};
