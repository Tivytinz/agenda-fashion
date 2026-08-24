const db = require(
  "../db/db"
);

const PERIODOS_PERMITIDOS =
  new Set([
    "all",
    "today",
    "7",
    "30",
    "month",
  ]);

const REPORT_TIME_ZONE =
  "America/Sao_Paulo";

function normalizarPeriodo(
  valor
) {
  const periodo =
    String(
      valor || "all"
    ).trim();

  return PERIODOS_PERMITIDOS.has(
    periodo
  )
    ? periodo
    : "all";
}

function inicioPeriodoSql(
  periodo
) {
  const bases = {
    today:
      `date_trunc('day', NOW() AT TIME ZONE '${REPORT_TIME_ZONE}')`,
    "7":
      `(date_trunc('day', NOW() AT TIME ZONE '${REPORT_TIME_ZONE}') - INTERVAL '6 days')`,
    "30":
      `(date_trunc('day', NOW() AT TIME ZONE '${REPORT_TIME_ZONE}') - INTERVAL '29 days')`,
    month:
      `date_trunc('month', NOW() AT TIME ZONE '${REPORT_TIME_ZONE}')`,
  };

  const base =
    bases[normalizarPeriodo(periodo)];

  return base
    ? `(${base} AT TIME ZONE '${REPORT_TIME_ZONE}')`
    : null;
}

function filtroPeriodo(
  periodo,
  alias = "e"
) {
  const inicio =
    inicioPeriodoSql(periodo);

  if (!inicio) {
    return "";
  }

  const prefixo =
    alias
      ? `${alias}.`
      : "";

  return `AND ${prefixo}created_at >= ${inicio}`;
}

const GCLID_SQL = `
  NULLIF(
    BTRIM(
      e.propriedades ->> 'gclid'
    ),
    ''
  )
`;

const FBCLID_SQL = `
  NULLIF(
    BTRIM(
      e.propriedades ->> 'fbclid'
    ),
    ''
  )
`;

const UTM_SOURCE_SQL = `
  NULLIF(
    BTRIM(
      e.propriedades ->> 'utm_source'
    ),
    ''
  )
`;

const UTM_MEDIUM_SQL = `
  NULLIF(
    BTRIM(
      e.propriedades ->> 'utm_medium'
    ),
    ''
  )
`;

const UTM_CAMPAIGN_SQL = `
  NULLIF(
    BTRIM(
      e.propriedades ->> 'utm_campaign'
    ),
    ''
  )
`;

const ATRIBUICAO_SQL = `
  (
    ${UTM_SOURCE_SQL} IS NOT NULL
    OR ${UTM_CAMPAIGN_SQL} IS NOT NULL
    OR ${GCLID_SQL} IS NOT NULL
    OR ${FBCLID_SQL} IS NOT NULL
  )
`;

const ORIGEM_SQL = `
  CASE
    WHEN ${GCLID_SQL} IS NOT NULL
      THEN 'google'
    ELSE COALESCE(
      ${UTM_SOURCE_SQL},
      CASE
        WHEN ${FBCLID_SQL} IS NOT NULL
          THEN 'facebook'
        ELSE 'desconhecida'
      END
    )
  END
`;

const MIDIA_SQL = `
  CASE
    WHEN ${GCLID_SQL} IS NOT NULL
      THEN 'cpc'
    ELSE COALESCE(
      ${UTM_MEDIUM_SQL},
      CASE
        WHEN ${FBCLID_SQL} IS NOT NULL
          THEN 'cpc'
        ELSE 'desconhecida'
      END
    )
  END
`;

const CAMPANHA_RESOLVIDA_SQL = `
  COALESCE(
    ${UTM_CAMPAIGN_SQL},
    CASE
      WHEN ${GCLID_SQL} IS NOT NULL
        THEN google_oficial.campanha
      ELSE NULL
    END,
    '(sem campanha)'
  )
`;

const GCLID_RESOLVIDO_SQL = `
  (
    ${GCLID_SQL} IS NOT NULL
    AND ${UTM_CAMPAIGN_SQL} IS NULL
    AND google_oficial.campanha IS NOT NULL
  )
`;

const GOOGLE_OFICIAL_CTE = `
  google_oficial AS (
    SELECT
      CASE
        WHEN COUNT(*) = 1
          THEN MIN(utm_campaign)
        ELSE NULL
      END AS campanha
    FROM marketing_campanhas
    WHERE ativo = TRUE
      AND LOWER(COALESCE(canal, '')) = 'google'
      AND LOWER(COALESCE(utm_source, '')) = 'google'
      AND LOWER(COALESCE(utm_medium, '')) = 'cpc'
  )
`;

const AGENDAMENTO_CONCLUIDO_ID_SQL = `
  COALESCE(
    NULLIF(
      BTRIM(
        propriedades ->> 'agendamento_id'
      ),
      ''
    ),
    id::TEXT
  )
`;

async function consultarEventos(
  sql,
  fallbackRows
) {
  try {
    return await db.query(sql);
  } catch (erro) {
    if (
      erro?.code === "42P01" ||
      erro?.code === "42703"
    ) {
      return {
        rows:
          fallbackRows,
      };
    }

    throw erro;
  }
}

async function buscarResumo(
  periodo = "all"
) {
  const filtro =
    filtroPeriodo(
      periodo,
      "e"
    );

  const resultado =
    await consultarEventos(
      `
        WITH
        ${GOOGLE_OFICIAL_CTE},
        eventos_resolvidos AS (
          SELECT
            e.*,
            ${ATRIBUICAO_SQL}
              AS atribuido,
            ${ORIGEM_SQL}
              AS origem_resolvida,
            ${MIDIA_SQL}
              AS midia_resolvida,
            ${CAMPANHA_RESOLVIDA_SQL}
              AS campanha_resolvida
          FROM eventos_produto e
          CROSS JOIN google_oficial
          WHERE 1 = 1
            ${filtro}
        )

        SELECT
          COUNT(
            DISTINCT sessao_id
          )::INT
            AS total_sessoes,

          COUNT(
            DISTINCT sessao_id
          ) FILTER (
            WHERE atribuido
          )::INT
            AS sessoes,

          COUNT(
            DISTINCT (
              origem_resolvida,
              midia_resolvida,
              campanha_resolvida
            )
          ) FILTER (
            WHERE atribuido
          )::INT
            AS campanhas,

          COUNT(
            DISTINCT sessao_id
          ) FILTER (
            WHERE atribuido
              AND nome =
                'perfil_visualizado'
          )::INT
            AS perfis_visualizados,

          COUNT(
            DISTINCT sessao_id
          ) FILTER (
            WHERE atribuido
              AND nome =
                'agendamento_iniciado'
          )::INT
            AS agendamentos_iniciados,

          COUNT(
            DISTINCT ${AGENDAMENTO_CONCLUIDO_ID_SQL}
          ) FILTER (
            WHERE atribuido
              AND nome =
                'agendamento_concluido'
          )::INT
            AS agendamentos_concluidos

        FROM eventos_resolvidos
      `,
      [
        {
          total_sessoes: 0,
          sessoes: 0,
          campanhas: 0,
          perfis_visualizados: 0,
          agendamentos_iniciados: 0,
          agendamentos_concluidos: 0,
        },
      ]
    );

  return resultado.rows[0] || {};
}

async function listarCampanhas(
  periodo = "all"
) {
  const filtro =
    filtroPeriodo(
      periodo,
      "e"
    );

  const resultado =
    await consultarEventos(
      `
        WITH
        ${GOOGLE_OFICIAL_CTE},
        eventos_resolvidos AS (
          SELECT
            e.*,
            ${ORIGEM_SQL}
              AS origem_resolvida,
            ${MIDIA_SQL}
              AS midia_resolvida,
            ${CAMPANHA_RESOLVIDA_SQL}
              AS campanha_resolvida,
            ${GCLID_RESOLVIDO_SQL}
              AS gclid_resolvido
          FROM eventos_produto e
          CROSS JOIN google_oficial
          WHERE ${ATRIBUICAO_SQL}
            ${filtro}
        )

        SELECT
          origem_resolvida
            AS origem,
          midia_resolvida
            AS midia,
          campanha_resolvida
            AS campanha,

          COUNT(
            DISTINCT sessao_id
          )::INT
            AS sessoes,

          COUNT(
            DISTINCT sessao_id
          ) FILTER (
            WHERE gclid_resolvido
          )::INT
            AS sessoes_resolvidas_gclid,

          COUNT(
            DISTINCT sessao_id
          ) FILTER (
            WHERE nome =
              'perfil_visualizado'
          )::INT
            AS perfis_visualizados,

          COUNT(
            DISTINCT sessao_id
          ) FILTER (
            WHERE nome =
              'agendamento_iniciado'
          )::INT
            AS agendamentos_iniciados,

          COUNT(
            DISTINCT ${AGENDAMENTO_CONCLUIDO_ID_SQL}
          ) FILTER (
            WHERE nome =
              'agendamento_concluido'
          )::INT
            AS agendamentos_concluidos,

          MIN(created_at)
            AS primeira_interacao,

          MAX(created_at)
            AS ultima_interacao

        FROM eventos_resolvidos

        GROUP BY
          origem_resolvida,
          midia_resolvida,
          campanha_resolvida

        ORDER BY
          agendamentos_concluidos DESC,
          sessoes DESC,
          ultima_interacao DESC

        LIMIT 100
      `,
      []
    );

  return resultado.rows;
}

async function listarConversoes(
  periodo = "all"
) {
  const filtro =
    filtroPeriodo(
      periodo,
      "e"
    );

  const resultado =
    await consultarEventos(
      `
        WITH
        ${GOOGLE_OFICIAL_CTE},
        eventos_resolvidos AS (
          SELECT
            e.*,
            ${ORIGEM_SQL}
              AS origem_resolvida,
            ${MIDIA_SQL}
              AS midia_resolvida,
            ${CAMPANHA_RESOLVIDA_SQL}
              AS campanha_resolvida,
            ${GCLID_RESOLVIDO_SQL}
              AS gclid_resolvido
          FROM eventos_produto e
          CROSS JOIN google_oficial
          WHERE e.nome =
            'agendamento_concluido'
            AND ${ATRIBUICAO_SQL}
            ${filtro}
        )

        SELECT
          e.id,
          e.sessao_id,
          e.negocio_id,

          n.nome
            AS negocio_nome,

          n.slug
            AS negocio_slug,

          e.propriedades
            ->> 'agendamento_id'
            AS agendamento_id,

          e.propriedades
            ->> 'servico_id'
            AS servico_id,

          e.origem_resolvida
            AS origem,

          e.midia_resolvida
            AS midia,

          e.campanha_resolvida
            AS campanha,

          e.gclid_resolvido,

          NULLIF(
            BTRIM(
              e.propriedades
                ->> 'utm_content'
            ),
            ''
          ) AS conteudo,

          NULLIF(
            BTRIM(
              e.propriedades
                ->> 'landing_page'
            ),
            ''
          ) AS landing_page,

          e.created_at

        FROM eventos_resolvidos e

        LEFT JOIN negocios n
          ON n.id = e.negocio_id

        ORDER BY
          e.created_at DESC,
          e.id DESC

        LIMIT 100
      `,
      []
    );

  return resultado.rows;
}

module.exports = {
  buscarResumo,
  listarCampanhas,
  listarConversoes,
  normalizarPeriodo,
  filtroPeriodo,
};
