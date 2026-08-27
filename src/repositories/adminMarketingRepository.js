const db = require(
  "../db/db"
);
const {
  campanhaAusenteSql,
  criarAtribuicaoSql,
  criarVinculoCampanhaOficialSql,
} = require(
  "./marketingAttributionSql"
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

const ATRIBUICAO_SQL =
  criarAtribuicaoSql("e");

const ATRIBUICAO_PAGA_SQL =
  ATRIBUICAO_SQL.atribuicaoPaga;

const TRAFEGO_ORGANICO_SQL =
  ATRIBUICAO_SQL.trafegoOrganico;

const ATRIBUICAO_RASTREADA_SQL =
  ATRIBUICAO_SQL.atribuicaoRastreada;

const ORIGEM_SQL =
  ATRIBUICAO_SQL.origem;

const MIDIA_SQL =
  ATRIBUICAO_SQL.midia;

const CAMPANHA_RESOLVIDA_SQL =
  ATRIBUICAO_SQL.campanha;

/*
 * Clique sem UTM confirma mídia paga, mas não identifica
 * sozinho qual campanha originou a visita. Não inferimos a
 * campanha pela lista ativa, pois isso reescreveria o histórico.
 */
const GOOGLE_CLICK_RESOLVIDO_SQL =
  "FALSE";

const GCLID_RESOLVIDO_SQL =
  "FALSE";

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
        WITH eventos_resolvidos AS (
          SELECT
            e.*,
            ${ATRIBUICAO_PAGA_SQL}
              AS pago,
            ${TRAFEGO_ORGANICO_SQL}
              AS organico,
            ${ATRIBUICAO_RASTREADA_SQL}
              AS rastreado,
            ${ORIGEM_SQL}
              AS origem_resolvida,
            ${MIDIA_SQL}
              AS midia_resolvida,
            ${CAMPANHA_RESOLVIDA_SQL}
              AS campanha_resolvida
          FROM eventos_produto e
          WHERE 1 = 1
            ${filtro}
        ),
        sessoes_classificadas AS (
          SELECT
            sessao_id,
            BOOL_OR(pago) AS pago,
            BOOL_OR(organico) AS organico,
            BOOL_OR(rastreado) AS rastreado
          FROM eventos_resolvidos
          GROUP BY sessao_id
        )

        SELECT
          (
            SELECT COUNT(*)::INT
            FROM sessoes_classificadas
          ) AS total_sessoes,

          (
            SELECT COUNT(*)::INT
            FROM sessoes_classificadas
            WHERE pago
          ) AS sessoes,

          (
            SELECT COUNT(*)::INT
            FROM sessoes_classificadas
            WHERE NOT pago
              AND organico
          ) AS sessoes_organicas,

          (
            SELECT COUNT(*)::INT
            FROM sessoes_classificadas
            WHERE NOT pago
              AND NOT organico
              AND NOT rastreado
          ) AS sessoes_autonomas,

          (
            SELECT COUNT(*)::INT
            FROM sessoes_classificadas
            WHERE NOT pago
              AND NOT organico
              AND rastreado
          ) AS sessoes_rastreamento_incompleto,

          COUNT(
            DISTINCT (
              origem_resolvida,
              midia_resolvida,
              campanha_resolvida
            )
          ) FILTER (
            WHERE pago
          )::INT AS campanhas,

          COUNT(DISTINCT sessao_id) FILTER (
            WHERE pago
              AND nome = 'perfil_visualizado'
          )::INT AS perfis_visualizados,

          COUNT(DISTINCT sessao_id) FILTER (
            WHERE pago
              AND nome = 'agendamento_iniciado'
          )::INT AS agendamentos_iniciados,

          COUNT(DISTINCT sessao_id) FILTER (
            WHERE pago
              AND nome = 'agendamento_concluido'
          )::INT AS sessoes_convertidas,

          COUNT(
            DISTINCT ${AGENDAMENTO_CONCLUIDO_ID_SQL}
          ) FILTER (
            WHERE pago
              AND nome = 'agendamento_concluido'
          )::INT AS agendamentos_concluidos

        FROM eventos_resolvidos
      `,
      [
        {
          total_sessoes: 0,
          sessoes: 0,
          sessoes_organicas: 0,
          sessoes_autonomas: 0,
          sessoes_rastreamento_incompleto: 0,
          campanhas: 0,
          perfis_visualizados: 0,
          agendamentos_iniciados: 0,
          sessoes_convertidas: 0,
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

  const vinculoCampanha =
    criarVinculoCampanhaOficialSql({
      origem: "e.origem_resolvida",
      midia: "e.midia_resolvida",
      campanha: "e.campanha_resolvida",
      momento: "e.created_at",
    });

  const campanhaAusente =
    campanhaAusenteSql(
      "e.campanha_resolvida"
    );

  const resultado =
    await consultarEventos(
      `
        WITH eventos_resolvidos AS (
          SELECT
            e.*,
            ${ORIGEM_SQL}
              AS origem_resolvida,
            ${MIDIA_SQL}
              AS midia_resolvida,
            ${CAMPANHA_RESOLVIDA_SQL}
              AS campanha_resolvida,
            ${GCLID_RESOLVIDO_SQL}
              AS gclid_resolvido,
            ${GOOGLE_CLICK_RESOLVIDO_SQL}
              AS google_click_resolvido
          FROM eventos_produto e
          WHERE ${ATRIBUICAO_PAGA_SQL}
            ${filtro}
        ),

        eventos_classificados AS (
          SELECT
            e.*,
            COALESCE(
              campanha_oficial.utm_source,
              e.origem_resolvida
            ) AS origem_atribuida,
            COALESCE(
              campanha_oficial.utm_medium,
              e.midia_resolvida
            ) AS midia_atribuida,
            COALESCE(
              campanha_oficial.utm_campaign,
              e.campanha_resolvida
            ) AS campanha_atribuida,
            campanha_oficial.id
              AS campanha_oficial_id,
            campanha_oficial.objetivo
              AS campanha_oficial_objetivo,
            campanha_oficial.ativo
              AS campanha_oficial_ativa,
            campanha_oficial.metodo_resolucao,
            CASE
              WHEN campanha_oficial.id IS NOT NULL
                THEN 'oficial'
              WHEN ${campanhaAusente}
                THEN 'rastreamento_incompleto'
              ELSE 'identidade_nao_oficial'
            END AS classificacao_atribuicao
          FROM eventos_resolvidos e
          ${vinculoCampanha}
        )

        SELECT
          origem_atribuida AS origem,
          midia_atribuida AS midia,
          campanha_atribuida AS campanha,
          campanha_oficial_id,
          campanha_oficial_objetivo,
          campanha_oficial_ativa,
          classificacao_atribuicao,

          COUNT(DISTINCT sessao_id)::INT AS sessoes,

          COUNT(DISTINCT sessao_id) FILTER (
            WHERE metodo_resolucao =
              'utm_exata'
          )::INT
            AS sessoes_atribuicao_direta,

          COUNT(DISTINCT sessao_id) FILTER (
            WHERE metodo_resolucao IS NOT NULL
              AND metodo_resolucao <>
                'utm_exata'
          )::INT
            AS sessoes_atribuicao_assistida,

          COUNT(DISTINCT sessao_id) FILTER (
            WHERE gclid_resolvido
          )::INT AS sessoes_resolvidas_gclid,

          COUNT(DISTINCT sessao_id) FILTER (
            WHERE google_click_resolvido
          )::INT AS sessoes_resolvidas_google_click,

          COUNT(DISTINCT sessao_id) FILTER (
            WHERE nome = 'perfil_visualizado'
          )::INT AS perfis_visualizados,

          COUNT(DISTINCT sessao_id) FILTER (
            WHERE nome = 'agendamento_iniciado'
          )::INT AS agendamentos_iniciados,

          COUNT(DISTINCT sessao_id) FILTER (
            WHERE nome = 'agendamento_concluido'
          )::INT AS sessoes_convertidas,

          COUNT(
            DISTINCT ${AGENDAMENTO_CONCLUIDO_ID_SQL}
          ) FILTER (
            WHERE nome = 'agendamento_concluido'
          )::INT AS agendamentos_concluidos,

          MIN(created_at) AS primeira_interacao,
          MAX(created_at) AS ultima_interacao

        FROM eventos_classificados

        GROUP BY
          origem_atribuida,
          midia_atribuida,
          campanha_atribuida,
          campanha_oficial_id,
          campanha_oficial_objetivo,
          campanha_oficial_ativa,
          classificacao_atribuicao

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

  const vinculoCampanha =
    criarVinculoCampanhaOficialSql({
      origem: "e.origem_resolvida",
      midia: "e.midia_resolvida",
      campanha: "e.campanha_resolvida",
      momento: "e.created_at",
    });

  const campanhaAusente =
    campanhaAusenteSql(
      "e.campanha_resolvida"
    );

  const resultado =
    await consultarEventos(
      `
        WITH eventos_resolvidos AS (
          SELECT
            e.*,
            ${ORIGEM_SQL}
              AS origem_resolvida,
            ${MIDIA_SQL}
              AS midia_resolvida,
            ${CAMPANHA_RESOLVIDA_SQL}
              AS campanha_resolvida,
            ${GCLID_RESOLVIDO_SQL}
              AS gclid_resolvido,
            ${GOOGLE_CLICK_RESOLVIDO_SQL}
              AS google_click_resolvido
          FROM eventos_produto e
          WHERE e.nome = 'agendamento_concluido'
            AND ${ATRIBUICAO_PAGA_SQL}
            ${filtro}
        ),

        eventos_classificados AS (
          SELECT
            e.*,
            COALESCE(
              campanha_oficial.utm_source,
              e.origem_resolvida
            ) AS origem_atribuida,
            COALESCE(
              campanha_oficial.utm_medium,
              e.midia_resolvida
            ) AS midia_atribuida,
            COALESCE(
              campanha_oficial.utm_campaign,
              e.campanha_resolvida
            ) AS campanha_atribuida,
            campanha_oficial.id
              AS campanha_oficial_id,
            campanha_oficial.objetivo
              AS campanha_oficial_objetivo,
            campanha_oficial.ativo
              AS campanha_oficial_ativa,
            campanha_oficial.metodo_resolucao,
            CASE
              WHEN campanha_oficial.id IS NOT NULL
                THEN 'oficial'
              WHEN ${campanhaAusente}
                THEN 'rastreamento_incompleto'
              ELSE 'identidade_nao_oficial'
            END AS classificacao_atribuicao
          FROM eventos_resolvidos e
          ${vinculoCampanha}
        )

        SELECT
          e.id,
          e.sessao_id,
          e.negocio_id,
          n.nome AS negocio_nome,
          n.slug AS negocio_slug,
          e.propriedades ->> 'agendamento_id' AS agendamento_id,
          e.propriedades ->> 'servico_id' AS servico_id,
          e.origem_atribuida AS origem,
          e.midia_atribuida AS midia,
          e.campanha_atribuida AS campanha,
          e.campanha_resolvida AS campanha_original,
          e.campanha_oficial_id,
          e.campanha_oficial_objetivo,
          e.campanha_oficial_ativa,
          e.classificacao_atribuicao,
          e.metodo_resolucao,
          e.gclid_resolvido,
          e.google_click_resolvido,
          NULLIF(BTRIM(e.propriedades ->> 'utm_content'), '') AS conteudo,
          NULLIF(BTRIM(e.propriedades ->> 'landing_page'), '') AS landing_page,
          e.created_at

        FROM eventos_classificados e

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
