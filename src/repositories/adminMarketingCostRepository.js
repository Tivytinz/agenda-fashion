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

function periodoSeguro(valor) {
  const periodo = String(
    valor || "30"
  ).trim();

  return PERIODOS_PERMITIDOS.has(
    periodo
  )
    ? periodo
    : "30";
}

function inicioPeriodoTimestampSql(
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
    bases[periodoSeguro(periodo)];

  return base
    ? `(${base} AT TIME ZONE '${REPORT_TIME_ZONE}')`
    : null;
}

function inicioPeriodoDataSql(
  periodo
) {
  const hoje =
    `(NOW() AT TIME ZONE '${REPORT_TIME_ZONE}')::date`;

  const inicios = {
    today:
      hoje,
    "7":
      `(${hoje} - 6)`,
    "30":
      `(${hoje} - 29)`,
    month:
      `date_trunc('month', ${hoje})::date`,
  };

  return inicios[
    periodoSeguro(periodo)
  ] || null;
}

function filtroEvento(
  periodo,
  alias = "e"
) {
  const inicio =
    inicioPeriodoTimestampSql(
      periodo
    );

  if (!inicio) {
    return "";
  }

  return `AND ${alias}.created_at >= ${inicio}`;
}

function filtroGasto(
  periodo,
  alias = "g"
) {
  const inicio =
    inicioPeriodoDataSql(
      periodo
    );

  if (!inicio) {
    return "";
  }

  return `AND ${alias}.data_gasto >= ${inicio}`;
}

async function listarDesempenho(
  periodo = "30"
) {
  const eventos =
    filtroEvento(
      periodo,
      "e"
    );

  const gastos =
    filtroGasto(
      periodo,
      "g"
    );

  const atribuicao =
    criarAtribuicaoSql("e");

  const vinculoCampanha =
    criarVinculoCampanhaOficialSql({
      origem: "e.origem_resolvida",
      midia: "e.midia_resolvida",
      campanha: "e.campanha_resolvida",
      momento: "e.created_at",
      alias: "campanha_encontrada",
    });

  const resultado =
    await db.query(
      `
      WITH eventos_resolvidos AS (
        SELECT
          e.*,
          ${atribuicao.origem}
            AS origem_resolvida,
          ${atribuicao.midia}
            AS midia_resolvida,
          ${atribuicao.campanha}
            AS campanha_resolvida
        FROM eventos_produto e
        WHERE 1 = 1
          ${eventos}
      ),

      eventos_vinculados AS (
        SELECT
          e.*,
          campanha_encontrada.id
            AS campanha_id,
          campanha_encontrada.metodo_resolucao
            AS metodo_resolucao
        FROM eventos_resolvidos e
        ${vinculoCampanha}
      ),

      gastos_por_campanha_dia AS (
        SELECT
          g.campanha_id,
          g.data_gasto,

          COALESCE(
            SUM(g.valor_centavos),
            0
          )::BIGINT
            AS investimento_centavos

        FROM marketing_campanha_gastos g

        WHERE g.moeda = 'BRL'
          ${gastos}

        GROUP BY
          g.campanha_id,
          g.data_gasto
      ),

      gastos_por_campanha AS (
        SELECT
          gcd.campanha_id,

          COALESCE(
            SUM(
              gcd.investimento_centavos
            ),
            0
          )::BIGINT
            AS investimento_centavos

        FROM gastos_por_campanha_dia gcd

        GROUP BY gcd.campanha_id
      ),

      eventos_por_campanha AS (
        SELECT
          mc.id AS campanha_id,

          COUNT(
            DISTINCT e.sessao_id
          ) FILTER (
            WHERE e.id IS NOT NULL
          )::INT AS sessoes,

          COUNT(
            DISTINCT e.sessao_id
          ) FILTER (
            WHERE e.id IS NOT NULL
              AND e.metodo_resolucao <>
                'utm_exata'
          )::INT
            AS sessoes_atribuicao_assistida,

          COUNT(
            DISTINCT COALESCE(
              NULLIF(
                BTRIM(
                  e.propriedades
                    ->> 'agendamento_id'
                ),
                ''
              ),
              e.id::TEXT
            )
          ) FILTER (
            WHERE e.nome =
              'agendamento_concluido'
          )::INT
            AS agendamentos_concluidos

        FROM marketing_campanhas mc

        LEFT JOIN eventos_vinculados e
          ON e.campanha_id = mc.id

        GROUP BY mc.id
      )

      SELECT
        mc.id,
        mc.nome,
        mc.canal,
        mc.objetivo,
        mc.utm_source,
        mc.utm_medium,
        mc.utm_campaign,
        mc.ativo,

        COALESCE(
          epc.sessoes,
          0
        )::INT AS sessoes,

        CASE
          WHEN COALESCE(
            gpc.investimento_centavos,
            0
          ) > 0
            THEN COALESCE(
              epc.sessoes,
              0
            )
          ELSE 0
        END::INT AS sessoes_com_custo,

        COALESCE(
          epc.sessoes_atribuicao_assistida,
          0
        )::INT
          AS sessoes_atribuicao_assistida,

        COALESCE(
          epc.agendamentos_concluidos,
          0
        )::INT
          AS agendamentos_concluidos,

        CASE
          WHEN COALESCE(
            gpc.investimento_centavos,
            0
          ) > 0
            THEN COALESCE(
              epc.agendamentos_concluidos,
              0
            )
          ELSE 0
        END::INT
          AS agendamentos_concluidos_com_custo,

        COALESCE(
          gpc.investimento_centavos,
          0
        )::BIGINT
          AS investimento_centavos

      FROM marketing_campanhas mc

      LEFT JOIN eventos_por_campanha epc
        ON epc.campanha_id = mc.id

      LEFT JOIN gastos_por_campanha gpc
        ON gpc.campanha_id = mc.id

      ORDER BY
        investimento_centavos DESC,
        agendamentos_concluidos DESC,
        sessoes DESC,
        mc.created_at DESC,
        mc.id DESC
      `
    );

  return resultado.rows;
}

async function buscarDiagnosticoAtribuicao(
  periodo = "30"
) {
  const eventos =
    filtroEvento(
      periodo,
      "e"
    );

  const atribuicao =
    criarAtribuicaoSql("e");

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
    await db.query(
      `
      WITH eventos_resolvidos AS (
        SELECT
          e.*,
          ${atribuicao.origem}
            AS origem_resolvida,
          ${atribuicao.midia}
            AS midia_resolvida,
          ${atribuicao.campanha}
            AS campanha_resolvida
        FROM eventos_produto e
        WHERE ${atribuicao.atribuicaoPaga}
          ${eventos}
      ),

      eventos_classificados AS (
        SELECT
          e.sessao_id,
          campanha_oficial.id IS NOT NULL
            AS oficial,
          campanha_oficial.metodo_resolucao,
          ${campanhaAusente}
            AS campanha_ausente
        FROM eventos_resolvidos e
        ${vinculoCampanha}
      ),

      sessoes AS (
        SELECT
          sessao_id,
          BOOL_OR(oficial) AS oficial,
          BOOL_OR(
            oficial
            AND metodo_resolucao =
              'utm_exata'
          ) AS atribuicao_direta,
          BOOL_OR(
            oficial
            AND metodo_resolucao <>
              'utm_exata'
          ) AS atribuicao_assistida,
          BOOL_OR(campanha_ausente)
            AS campanha_ausente
        FROM eventos_classificados
        GROUP BY sessao_id
      )

      SELECT
        COUNT(*) FILTER (
          WHERE oficial
        )::INT AS sessoes_oficiais,
        COUNT(*) FILTER (
          WHERE oficial
            AND atribuicao_direta
        )::INT
          AS sessoes_atribuicao_direta,
        COUNT(*) FILTER (
          WHERE oficial
            AND NOT atribuicao_direta
            AND atribuicao_assistida
        )::INT
          AS sessoes_atribuicao_assistida,
        COUNT(*) FILTER (
          WHERE NOT oficial
            AND campanha_ausente
        )::INT AS sessoes_sem_campanha,
        COUNT(*) FILTER (
          WHERE NOT oficial
            AND NOT campanha_ausente
        )::INT AS sessoes_identidade_nao_oficial
      FROM sessoes
      `
    );

  return resultado.rows[0] || {};
}

async function listarGastos(
  periodo = "30"
) {
  const filtro =
    filtroGasto(
      periodo,
      "g"
    );

  const resultado =
    await db.query(
      `
      SELECT
        g.id,
        g.campanha_id,
        g.data_gasto,
        g.valor_centavos,
        g.moeda,
        g.fonte,
        g.observacao,
        g.criado_por_usuario_id,
        g.atualizado_por_usuario_id,
        g.created_at,
        g.updated_at,
        mc.nome AS campanha_nome,
        mc.canal,
        mc.objetivo,
        mc.utm_source,
        mc.utm_medium,
        mc.utm_campaign

      FROM marketing_campanha_gastos g

      INNER JOIN marketing_campanhas mc
        ON mc.id = g.campanha_id

      WHERE 1 = 1
        ${filtro}

      ORDER BY
        g.data_gasto DESC,
        g.updated_at DESC,
        g.id DESC

      LIMIT 200
      `
    );

  return resultado.rows;
}

async function salvarGastoManual({
  campanhaId,
  dataGasto,
  valorCentavos,
  observacao,
  usuarioId,
}) {
  const resultado =
    await db.query(
      `
      INSERT INTO marketing_campanha_gastos (
        campanha_id,
        data_gasto,
        valor_centavos,
        moeda,
        fonte,
        observacao,
        criado_por_usuario_id,
        atualizado_por_usuario_id
      )
      VALUES (
        $1,
        $2,
        $3,
        'BRL',
        'manual',
        $4,
        $5,
        $5
      )
      ON CONFLICT (
        campanha_id,
        data_gasto,
        fonte
      )
      DO UPDATE SET
        valor_centavos =
          EXCLUDED.valor_centavos,
        observacao =
          EXCLUDED.observacao,
        atualizado_por_usuario_id =
          EXCLUDED.atualizado_por_usuario_id,
        updated_at = NOW()
      RETURNING
        id,
        campanha_id,
        data_gasto,
        valor_centavos,
        moeda,
        fonte,
        observacao,
        criado_por_usuario_id,
        atualizado_por_usuario_id,
        created_at,
        updated_at
      `,
      [
        campanhaId,
        dataGasto,
        valorCentavos,
        observacao,
        usuarioId,
      ]
    );

  return resultado.rows[0];
}

module.exports = {
  listarDesempenho,
  buscarDiagnosticoAtribuicao,
  listarGastos,
  salvarGastoManual,
  filtroEvento,
  filtroGasto,
  periodoSeguro,
};
