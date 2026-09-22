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
        whatsapp AS whatsapp_negocio,
        COALESCE(
          NULLIF(fuso_horario, ''),
          'America/Sao_Paulo'
        ) AS fuso_horario

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
  negocioId,
  servicoId
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

      INNER JOIN profissional_servicos ps
        ON ps.profissional_id = un.usuario_id
        AND ps.negocio_id = un.negocio_id
        AND ps.servico_id = $3

      INNER JOIN servicos_negocio s
        ON s.id = ps.servico_id
        AND s.negocio_id = ps.negocio_id
        AND s.ativo = TRUE

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
      servicoId,
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
  dataFim,
  agendamentoIgnorarId = null,
  fusoHorario = "America/Sao_Paulo"
) {
  const result = await db.query(
    `
      SELECT
        a.id,

        TO_CHAR(
          a.inicio_previsto_em
            AT TIME ZONE $5,
          'YYYY-MM-DD'
        ) AS data,

        TO_CHAR(
          a.inicio_previsto_em
            AT TIME ZONE $5,
          'HH24:MI'
        ) AS horario,

        a.inicio_previsto_em,
        a.fuso_horario_snapshot,
        a.duracao_minutos::int
          AS duracao_minutos

      FROM agendamentos a

      WHERE a.profissional_id = $1
        AND a.status IN (
          'agendado',
          'confirmado'
        )
        AND a.inicio_previsto_em < (
          (
            $3::date +
            INTERVAL '1 day'
          )::timestamp
          AT TIME ZONE $5
        )
        AND (
          a.inicio_previsto_em +
          make_interval(
            mins =>
              a.duracao_minutos::int
          )
        ) > (
          $2::date::timestamp
          AT TIME ZONE $5
        )
        AND (
          $4::BIGINT IS NULL
          OR a.id <> $4
        )

      ORDER BY
        a.inicio_previsto_em
    `,
    [
      profissionalId,
      dataInicio,
      dataFim,
      agendamentoIgnorarId,
      fusoHorario,
    ]
  );

  return result.rows;
}

async function listarBloqueios(
  profissionalId,
  negocioId,
  dataInicio,
  dataFim
) {
  const result = await db.query(
    `
      SELECT
        negocio_id,

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
          BETWEEN $3 AND $4
        AND (
          negocio_id = $2
          OR negocio_id IS NULL
        )

      ORDER BY
        data_bloqueio,
        hora_bloqueio
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
   * da mesma profissional, inclusive quando
   * negócios distintos usam fusos diferentes.
   */
  await client.query(
    `
      SELECT pg_advisory_xact_lock(
        hashtext('agenda-profissional'),
        hashtext($1::text)
      )
    `,
    [
      Number(profissionalId),
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

async function resolverClienteInterno(
  {
    usuarioId = null,
    nome = null,
    whatsapp = null,
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

  const usuarioIdNormalizado =
    Number(usuarioId);

  if (
    Number.isInteger(usuarioIdNormalizado) &&
    usuarioIdNormalizado > 0
  ) {
    const result =
      await executor.query(
        `
          INSERT INTO clientes (
            usuario_id,
            nome,
            whatsapp_normalizado,
            origem
          )
          SELECT
            u.id,
            u.nome,
            u.whatsapp,
            'conta'
          FROM usuarios u
          WHERE u.id = $1
            AND u.ativo = TRUE
          ON CONFLICT (usuario_id)
          DO UPDATE SET
            nome = EXCLUDED.nome,
            whatsapp_normalizado =
              EXCLUDED.whatsapp_normalizado,
            origem = 'conta'
          RETURNING
            id,
            usuario_id,
            nome,
            whatsapp_normalizado AS whatsapp
        `,
        [usuarioIdNormalizado]
      );

    return result.rows[0] || null;
  }

  const nomeNormalizado =
    String(nome || "").trim();

  const whatsappNormalizado =
    String(whatsapp || "")
      .replace(/\D/g, "");

  if (
    nomeNormalizado.length < 2 ||
    !/^[0-9]{10,13}$/.test(
      whatsappNormalizado
    )
  ) {
    return null;
  }

  await executor.query(
    `
      SELECT pg_advisory_xact_lock(
        hashtext($1::text)::bigint
      )
    `,
    [`client:${whatsappNormalizado}`]
  );

  const existente =
    await executor.query(
      `
        SELECT
          id,
          usuario_id,
          nome,
          whatsapp_normalizado AS whatsapp
        FROM clientes
        WHERE usuario_id IS NULL
          AND whatsapp_normalizado = $1
          AND LOWER(BTRIM(nome)) =
            LOWER(BTRIM($2))
        ORDER BY created_at DESC
        LIMIT 1
      `,
      [
        whatsappNormalizado,
        nomeNormalizado,
      ]
    );

  if (existente.rows[0]) {
    return existente.rows[0];
  }

  const criado =
    await executor.query(
      `
        INSERT INTO clientes (
          usuario_id,
          nome,
          whatsapp_normalizado,
          origem
        )
        VALUES (
          NULL,
          $1,
          $2,
          'visitante'
        )
        RETURNING
          id,
          usuario_id,
          nome,
          whatsapp_normalizado AS whatsapp
      `,
      [
        nomeNormalizado,
        whatsappNormalizado,
      ]
    );

  return criado.rows[0] || null;
}

async function criarAgendamento(
  {
    data,
    horario,
    profissionalId,
    clienteId = null,
    clientId,
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
          client_id,
          cliente_nome,
          cliente_whatsapp,
          whatsapp_consentido_em,
          servico_id,
          valor_servico,
          negocio_id,
          confirmado_em,
          status
        )
        VALUES (
          $1,
          $2,
          $3,
          $4,
          $5,
          $6,
          $7,
          CASE
            WHEN $8::BOOLEAN
              THEN NOW()
            ELSE NULL
          END,
          $9,
          $10,
          $11,
          NOW(),
          'confirmado'
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
          duracao_minutos,
          negocio_id,
          inicio_previsto_em,
          fuso_horario_snapshot,
          confirmado_em,
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
        clientId,
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

async function buscarContextoNotificacaoAgendamento(
  agendamentoId
) {
  const result = await db.query(
    `
      SELECT
        a.id AS agendamento_id,
        a.negocio_id,
        a.profissional_id,
        dono.usuario_id AS dono_id,
        COALESCE(
          NULLIF(BTRIM(a.servico_nome), ''),
          NULLIF(BTRIM(s.nome), ''),
          'Serviço'
        ) AS servico_nome,
        TO_CHAR(a.data, 'YYYY-MM-DD') AS data,
        TO_CHAR(a.horario::time, 'HH24:MI') AS horario
      FROM agendamentos a
      INNER JOIN negocios n
        ON n.id = a.negocio_id
      LEFT JOIN servicos_negocio s
        ON s.id = a.servico_id
      LEFT JOIN LATERAL (
        SELECT un.usuario_id
        FROM usuarios_negocios un
        INNER JOIN usuarios u
          ON u.id = un.usuario_id
        WHERE un.negocio_id = a.negocio_id
          AND un.papel = 'dono'
          AND un.ativo = TRUE
          AND u.ativo = TRUE
        ORDER BY un.created_at ASC, un.id ASC
        LIMIT 1
      ) dono ON TRUE
      WHERE a.id = $1
      LIMIT 1
    `,
    [agendamentoId]
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
            COALESCE(
              NULLIF(n.fuso_horario, ''),
              'America/Sao_Paulo'
            )
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
      ? "FOR UPDATE OF a"
      : "";

  const result = await executor.query(
    `
      SELECT
        a.id,
        a.negocio_id,

        TO_CHAR(
          a.data,
          'YYYY-MM-DD'
        ) AS data,

        TO_CHAR(
          a.horario::time,
          'HH24:MI'
        ) AS horario,

        a.profissional_id,
        a.cliente_id,
        a.status,
        a.avaliacao,
        COALESCE(
          NULLIF(n.fuso_horario, ''),
          'America/Sao_Paulo'
        ) AS fuso_horario

      FROM agendamentos a

      LEFT JOIN negocios n
        ON n.id = a.negocio_id

      WHERE a.id = $1
        AND a.cliente_id = $2
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
  resolverClienteInterno,
  criarAgendamento,
  registrarConsentimentoWhatsappAgendamento,
  buscarContextoNotificacaoAgendamento,
  criarNotificacaoAgendamento,
  listarMeusAgendamentos,
  buscarAgendamentoCliente,
  cancelarAgendamento,
  avaliarAgendamento,
};
