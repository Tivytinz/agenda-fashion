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

function filtroPeriodo(
  periodo,
  alias = "e"
) {
  const prefixo =
    alias
      ? `${alias}.`
      : "";

  const filtros = {
    all:
      "",

    today:
      `AND ${prefixo}created_at >= CURRENT_DATE`,

    "7":
      `AND ${prefixo}created_at >= NOW() - INTERVAL '7 days'`,

    "30":
      `AND ${prefixo}created_at >= NOW() - INTERVAL '30 days'`,

    month:
      `AND DATE_TRUNC('month', ${prefixo}created_at) = DATE_TRUNC('month', NOW())`,
  };

  return filtros[
    normalizarPeriodo(periodo)
  ];
}

const ATRIBUICAO_SQL = `
  (
    NULLIF(
      BTRIM(
        e.propriedades ->> 'utm_source'
      ),
      ''
    ) IS NOT NULL

    OR NULLIF(
      BTRIM(
        e.propriedades ->> 'utm_campaign'
      ),
      ''
    ) IS NOT NULL

    OR NULLIF(
      BTRIM(
        e.propriedades ->> 'gclid'
      ),
      ''
    ) IS NOT NULL

    OR NULLIF(
      BTRIM(
        e.propriedades ->> 'fbclid'
      ),
      ''
    ) IS NOT NULL
  )
`;

const ORIGEM_SQL = `
  COALESCE(
    NULLIF(
      BTRIM(
        e.propriedades ->> 'utm_source'
      ),
      ''
    ),
    CASE
      WHEN NULLIF(
        BTRIM(
          e.propriedades ->> 'gclid'
        ),
        ''
      ) IS NOT NULL
      THEN 'google'

      WHEN NULLIF(
        BTRIM(
          e.propriedades ->> 'fbclid'
        ),
        ''
      ) IS NOT NULL
      THEN 'facebook'

      ELSE 'desconhecida'
    END
  )
`;

const MIDIA_SQL = `
  COALESCE(
    NULLIF(
      BTRIM(
        e.propriedades ->> 'utm_medium'
      ),
      ''
    ),
    CASE
      WHEN NULLIF(
        BTRIM(
          e.propriedades ->> 'gclid'
        ),
        ''
      ) IS NOT NULL
        OR NULLIF(
          BTRIM(
            e.propriedades ->> 'fbclid'
          ),
          ''
        ) IS NOT NULL
      THEN 'cpc'
      ELSE 'desconhecida'
    END
  )
`;

const CAMPANHA_SQL = `
  COALESCE(
    NULLIF(
      BTRIM(
        e.propriedades ->> 'utm_campaign'
      ),
      ''
    ),
    '(sem campanha)'
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
        SELECT
          COUNT(
            DISTINCT e.sessao_id
          ) FILTER (
            WHERE ${ATRIBUICAO_SQL}
          )::INT
            AS sessoes,

          COUNT(
            DISTINCT (
              ${ORIGEM_SQL},
              ${MIDIA_SQL},
              ${CAMPANHA_SQL}
            )
          ) FILTER (
            WHERE ${ATRIBUICAO_SQL}
          )::INT
            AS campanhas,

          COUNT(
            DISTINCT e.sessao_id
          ) FILTER (
            WHERE ${ATRIBUICAO_SQL}
              AND e.nome =
                'perfil_visualizado'
          )::INT
            AS perfis_visualizados,

          COUNT(
            DISTINCT e.sessao_id
          ) FILTER (
            WHERE ${ATRIBUICAO_SQL}
              AND e.nome =
                'agendamento_iniciado'
          )::INT
            AS agendamentos_iniciados,

          COUNT(
            DISTINCT e.sessao_id
          ) FILTER (
            WHERE ${ATRIBUICAO_SQL}
              AND e.nome =
                'agendamento_concluido'
          )::INT
            AS agendamentos_concluidos

        FROM eventos_produto e

        WHERE 1 = 1
          ${filtro}
      `,
      [
        {
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
        SELECT
          ${ORIGEM_SQL}
            AS origem,

          ${MIDIA_SQL}
            AS midia,

          ${CAMPANHA_SQL}
            AS campanha,

          COUNT(
            DISTINCT e.sessao_id
          )::INT
            AS sessoes,

          COUNT(
            DISTINCT e.sessao_id
          ) FILTER (
            WHERE e.nome =
              'perfil_visualizado'
          )::INT
            AS perfis_visualizados,

          COUNT(
            DISTINCT e.sessao_id
          ) FILTER (
            WHERE e.nome =
              'agendamento_iniciado'
          )::INT
            AS agendamentos_iniciados,

          COUNT(
            DISTINCT e.sessao_id
          ) FILTER (
            WHERE e.nome =
              'agendamento_concluido'
          )::INT
            AS agendamentos_concluidos,

          MIN(e.created_at)
            AS primeira_interacao,

          MAX(e.created_at)
            AS ultima_interacao

        FROM eventos_produto e

        WHERE ${ATRIBUICAO_SQL}
          ${filtro}

        GROUP BY
          ${ORIGEM_SQL},
          ${MIDIA_SQL},
          ${CAMPANHA_SQL}

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

          ${ORIGEM_SQL}
            AS origem,

          ${MIDIA_SQL}
            AS midia,

          ${CAMPANHA_SQL}
            AS campanha,

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

        FROM eventos_produto e

        LEFT JOIN negocios n
          ON n.id = e.negocio_id

        WHERE e.nome =
          'agendamento_concluido'

          AND ${ATRIBUICAO_SQL}

          ${filtro}

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
};
