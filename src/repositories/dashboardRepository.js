const db = require("../db/db");

async function buscarNegocioDoUsuario(
  usuarioId
) {
  const result = await db.query(
    `
    SELECT
      un.negocio_id,
      un.papel,
      n.nome,
      n.slug

    FROM usuarios_negocios un

    INNER JOIN negocios n
      ON n.id = un.negocio_id
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

async function buscarResumoProfissional(
  negocioId,
  usuarioId
) {
  const result = await db.query(
    `
    SELECT
      COUNT(*) FILTER (
        WHERE a.status != 'cancelado'
      )::int AS total_agendados,

      COUNT(*) FILTER (
        WHERE a.status != 'cancelado'
          AND a.data = (
            NOW() AT TIME ZONE
            'America/Sao_Paulo'
          )::date
      )::int AS agendados_hoje,

      COUNT(*) FILTER (
        WHERE a.status != 'cancelado'
          AND a.data = (
            NOW() AT TIME ZONE
            'America/Sao_Paulo'
          )::date
      )::int AS agendamentos_hoje,

      COUNT(*) FILTER (
        WHERE a.status = 'cancelado'
          AND a.data = (
            NOW() AT TIME ZONE
            'America/Sao_Paulo'
          )::date
      )::int AS cancelamentos_hoje,

      COUNT(*) FILTER (
        WHERE a.status != 'cancelado'
          AND a.data = (
            NOW() AT TIME ZONE
            'America/Sao_Paulo'
          )::date
          AND (
            a.data::timestamp +
            a.horario::time
          ) < (
            NOW() AT TIME ZONE
            'America/Sao_Paulo'
          )
      )::int AS realizados_hoje,

      COUNT(*) FILTER (
        WHERE a.status != 'cancelado'
          AND a.data = (
            NOW() AT TIME ZONE
            'America/Sao_Paulo'
          )::date
          AND (
            a.data::timestamp +
            a.horario::time
          ) >= (
            NOW() AT TIME ZONE
            'America/Sao_Paulo'
          )
      )::int AS pendentes_hoje,

      COUNT(
        DISTINCT a.cliente_id
      ) FILTER (
        WHERE a.status != 'cancelado'
      )::int AS clientes_unicos,

      COALESCE(
        SUM(
          COALESCE(
            a.valor_servico,
            s.valor,
            0
          )
        ) FILTER (
          WHERE a.status != 'cancelado'
        ),
        0
      )::numeric AS faturamento_estimado,

      COALESCE(
        SUM(
          COALESCE(
            a.valor_servico,
            s.valor,
            0
          )
        ) FILTER (
          WHERE a.status != 'cancelado'
            AND a.data = (
              NOW() AT TIME ZONE
              'America/Sao_Paulo'
            )::date
        ),
        0
      )::numeric AS faturamento_previsto_hoje

    FROM agendamentos a

    LEFT JOIN servicos_negocio s
      ON s.id = a.servico_id

    WHERE a.negocio_id = $1
      AND a.profissional_id = $2
    `,
    [
      negocioId,
      usuarioId,
    ]
  );

  return result.rows[0] || {};
}

async function buscarProximoAtendimentoProfissional(
  negocioId,
  usuarioId
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

      a.status,

      cliente.id AS cliente_id,

      COALESCE(
        cliente.nome,
        'Cliente não informado'
      ) AS cliente_nome,

      cliente.whatsapp
        AS cliente_whatsapp,

      servico.id AS servico_id,

      COALESCE(
        servico.nome,
        'Serviço não informado'
      ) AS servico_nome,

      COALESCE(
        a.valor_servico,
        servico.valor,
        0
      )::numeric AS valor,

      COALESCE(
        servico.duracao_minutos,
        60
      )::int AS duracao_minutos

    FROM agendamentos a

    LEFT JOIN usuarios cliente
      ON cliente.id = a.cliente_id

    LEFT JOIN servicos_negocio servico
      ON servico.id = a.servico_id

    WHERE a.negocio_id = $1
      AND a.profissional_id = $2

      AND a.status IN (
        'agendado',
        'confirmado'
      )

      AND (
        a.data::timestamp +
        a.horario::time
      ) >= (
        NOW() AT TIME ZONE
        'America/Sao_Paulo'
      )

    ORDER BY
      a.data ASC,
      a.horario ASC

    LIMIT 1
    `,
    [
      negocioId,
      usuarioId,
    ]
  );

  return result.rows[0] || null;
}

async function listarProximosAtendimentosProfissional(
  negocioId,
  usuarioId,
  limite = 5
) {
  const limiteNormalizado =
    Number.isInteger(Number(limite))
      ? Math.min(
          Math.max(
            Number(limite),
            1
          ),
          20
        )
      : 5;

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

      a.status,

      CASE
        WHEN a.data = (
          NOW() AT TIME ZONE
          'America/Sao_Paulo'
        )::date
          THEN true

        ELSE false
      END AS hoje,

      cliente.id AS cliente_id,

      COALESCE(
        cliente.nome,
        'Cliente não informado'
      ) AS cliente_nome,

      cliente.whatsapp
        AS cliente_whatsapp,

      servico.id AS servico_id,

      COALESCE(
        servico.nome,
        'Serviço não informado'
      ) AS servico_nome,

      COALESCE(
        a.valor_servico,
        servico.valor,
        0
      )::numeric AS valor,

      COALESCE(
        servico.duracao_minutos,
        60
      )::int AS duracao_minutos

    FROM agendamentos a

    LEFT JOIN usuarios cliente
      ON cliente.id = a.cliente_id

    LEFT JOIN servicos_negocio servico
      ON servico.id = a.servico_id

    WHERE a.negocio_id = $1
      AND a.profissional_id = $2

      AND a.status IN (
        'agendado',
        'confirmado'
      )

      AND (
        a.data::timestamp +
        a.horario::time
      ) >= (
        NOW() AT TIME ZONE
        'America/Sao_Paulo'
      )

    ORDER BY
      a.data ASC,
      a.horario ASC

    LIMIT $3
    `,
    [
      negocioId,
      usuarioId,
      limiteNormalizado,
    ]
  );

  return result.rows;
}

async function buscarServicosMaisVendidosProfissional(
  negocioId,
  usuarioId
) {
  const result = await db.query(
    `
    SELECT
      s.id,
      s.nome,

      COUNT(
        a.id
      )::int AS total,

      COALESCE(
        SUM(
          COALESCE(
            a.valor_servico,
            s.valor,
            0
          )
        ),
        0
      )::numeric AS faturamento

    FROM agendamentos a

    LEFT JOIN servicos_negocio s
      ON s.id = a.servico_id

    WHERE a.negocio_id = $1
      AND a.profissional_id = $2
      AND a.status != 'cancelado'

    GROUP BY
      s.id,
      s.nome

    ORDER BY
      total DESC

    LIMIT 5
    `,
    [
      negocioId,
      usuarioId,
    ]
  );

  return result.rows;
}

async function buscarResumoDono(
  negocioId,
  filtro
) {
  const result = await db.query(
    `
    WITH agendamentos_base AS (
      SELECT
        a.*,
        COALESCE(
          'usuario:' || a.cliente_id::text,
          'whatsapp:' || NULLIF(
            regexp_replace(
              COALESCE(a.cliente_whatsapp, ''),
              '[^0-9]',
              '',
              'g'
            ),
            ''
          )
        ) AS cliente_chave

      FROM agendamentos a

      WHERE a.negocio_id = $1
        AND a.status != 'cancelado'
    ),
    agendamentos_validos AS (
      SELECT
        base.*,
        MIN(base.data) OVER (
          PARTITION BY base.cliente_chave
        ) AS primeira_data_cliente

      FROM agendamentos_base base
    )

    SELECT
      COUNT(*) FILTER (
        WHERE a.data = (
            NOW() AT TIME ZONE
            'America/Sao_Paulo'
          )::date
      )::int AS agendamentos_hoje,

      COUNT(*) FILTER (
        WHERE TRUE
        ${filtro}
      )::int AS agendamentos_periodo,

      COALESCE(
        SUM(
          COALESCE(
            a.valor_servico,
            s.valor,
            0
          )
        ) FILTER (
          WHERE a.data = (
              NOW() AT TIME ZONE
              'America/Sao_Paulo'
            )::date
        ),
        0
      )::numeric AS faturamento_hoje,

      COALESCE(
        SUM(
          COALESCE(
            a.valor_servico,
            s.valor,
            0
          )
        ) FILTER (
          WHERE TRUE
          ${filtro}
        ),
        0
      )::numeric AS faturamento_periodo,

      COUNT(
        DISTINCT a.cliente_chave
      ) FILTER (
        WHERE a.cliente_chave IS NOT NULL
          AND a.data = a.primeira_data_cliente
        ${filtro}
      )::int AS clientes_novos,

      COUNT(a.id) FILTER (
        WHERE TRUE
        ${filtro}
      )::int AS servicos_vendidos

    FROM agendamentos_validos a

    LEFT JOIN servicos_negocio s
      ON s.id = a.servico_id

    `,
    [negocioId]
  );

  return result.rows[0] || {};
}

async function buscarClientesRecorrentes(
  negocioId
) {
  const result = await db.query(
    `
    SELECT
      COUNT(*)::int AS total

    FROM (
      SELECT
        COALESCE(
          'usuario:' || cliente_id::text,
          'whatsapp:' || NULLIF(
            regexp_replace(
              COALESCE(cliente_whatsapp, ''),
              '[^0-9]',
              '',
              'g'
            ),
            ''
          )
        ) AS cliente_chave

      FROM agendamentos

      WHERE negocio_id = $1
        AND status != 'cancelado'
        AND COALESCE(
          cliente_id::text,
          NULLIF(
            regexp_replace(
              COALESCE(cliente_whatsapp, ''),
              '[^0-9]',
              '',
              'g'
            ),
            ''
          )
        ) IS NOT NULL

      GROUP BY
        cliente_chave

      HAVING COUNT(*) > 1
    ) recorrentes
    `,
    [negocioId]
  );

  return (
    result.rows[0]?.total ||
    0
  );
}

async function buscarPerformanceNegocio(
  negocioId,
  filtro = ""
) {
  try {
    const result =
      await db.query(
        `
        SELECT
          COUNT(*) FILTER (
            WHERE nome =
              'perfil_visualizado'
          )::INT
            AS visitas_perfil,

          COUNT(*) FILTER (
            WHERE nome =
              'contato_selecionado'
              AND propriedades
                ->> 'acao' =
                  'whatsapp'
          )::INT
            AS cliques_whatsapp,

          COUNT(*) FILTER (
            WHERE nome =
              'contato_selecionado'
              AND propriedades
                ->> 'acao' =
                  'maps'
          )::INT
            AS cliques_maps,

          COUNT(*) FILTER (
            WHERE nome =
              'agendamento_concluido'
          )::INT
            AS agendamentos_concluidos

        FROM eventos_produto e

        WHERE negocio_id = $1
          ${filtro}
        `,
        [negocioId]
      );

    return (
      result.rows[0] || {
        visitas_perfil: 0,
        cliques_whatsapp: 0,
        cliques_maps: 0,
        agendamentos_concluidos: 0,
      }
    );
  } catch {
    return {
      visitas_perfil: 0,
      cliques_whatsapp: 0,
      cliques_maps: 0,
      agendamentos_concluidos: 0,
    };
  }
}

async function buscarFavoritosRecebidos(
  negocioId,
  filtro = ""
) {
  try {
    const result =
      await db.query(
        `
        SELECT
          COUNT(*)::int AS total

        FROM favoritos f

        WHERE negocio_id = $1
          ${filtro}
        `,
        [negocioId]
      );

    return (
      result.rows[0]?.total ||
      0
    );
  } catch {
    return 0;
  }
}

async function buscarResumoDias(
  negocioId,
  filtro
) {
  const result = await db.query(
    `
    SELECT
      TO_CHAR(
        a.data,
        'DD/MM'
      ) AS data,

      COUNT(
        a.id
      )::int AS agendamentos,

      COALESCE(
        SUM(
          COALESCE(
            a.valor_servico,
            s.valor,
            0
          )
        ),
        0
      )::numeric AS faturamento

    FROM agendamentos a

    LEFT JOIN servicos_negocio s
      ON s.id = a.servico_id

    WHERE a.negocio_id = $1
      AND a.status != 'cancelado'
      ${filtro}

    GROUP BY
      a.data

    ORDER BY
      a.data ASC
    `,
    [negocioId]
  );

  return result.rows;
}

async function buscarRankingProfissionais(
  negocioId,
  filtro
) {
  const result = await db.query(
    `
    SELECT
      u.id,
      u.nome,

      COUNT(
        a.id
      )::int AS total,

      COALESCE(
        SUM(
          COALESCE(
            a.valor_servico,
            s.valor,
            0
          )
        ),
        0
      )::numeric AS faturamento

    FROM agendamentos a

    LEFT JOIN usuarios u
      ON u.id = a.profissional_id

    LEFT JOIN servicos_negocio s
      ON s.id = a.servico_id

    WHERE a.negocio_id = $1
      AND a.status != 'cancelado'
      ${filtro}

    GROUP BY
      u.id,
      u.nome

    ORDER BY
      total DESC

    LIMIT 5
    `,
    [negocioId]
  );

  return result.rows;
}

async function buscarRankingServicos(
  negocioId,
  filtro
) {
  const result = await db.query(
    `
    SELECT
      s.id,
      s.nome,

      COUNT(
        a.id
      )::int AS total,

      COALESCE(
        SUM(
          COALESCE(
            a.valor_servico,
            s.valor,
            0
          )
        ),
        0
      )::numeric AS faturamento

    FROM agendamentos a

    LEFT JOIN servicos_negocio s
      ON s.id = a.servico_id

    WHERE a.negocio_id = $1
      AND a.status != 'cancelado'
      ${filtro}

    GROUP BY
      s.id,
      s.nome

    ORDER BY
      total DESC

    LIMIT 5
    `,
    [negocioId]
  );

  return result.rows;
}

async function buscarRankingClientes(
  negocioId,
  filtro
) {
  const result = await db.query(
    `
    SELECT
      u.id,
      u.nome,

      COUNT(
        a.id
      )::int AS total,

      COALESCE(
        SUM(
          COALESCE(
            a.valor_servico,
            s.valor,
            0
          )
        ),
        0
      )::numeric AS faturamento

    FROM agendamentos a

    LEFT JOIN usuarios u
      ON u.id = a.cliente_id

    LEFT JOIN servicos_negocio s
      ON s.id = a.servico_id

    WHERE a.negocio_id = $1
      AND a.status != 'cancelado'
      ${filtro}

    GROUP BY
      u.id,
      u.nome

    ORDER BY
      total DESC

    LIMIT 6
    `,
    [negocioId]
  );

  return result.rows;
}

module.exports = {
  buscarNegocioDoUsuario,
  buscarResumoProfissional,
  buscarProximoAtendimentoProfissional,
  listarProximosAtendimentosProfissional,
  buscarServicosMaisVendidosProfissional,
  buscarResumoDono,
  buscarClientesRecorrentes,
  buscarPerformanceNegocio,
  buscarFavoritosRecebidos,
  buscarResumoDias,
  buscarRankingProfissionais,
  buscarRankingServicos,
  buscarRankingClientes,
};
