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

  const resultado =
    await db.query(
      `
      WITH eventos_por_campanha AS (
        SELECT
          mc.id AS campanha_id,

          COUNT(
            DISTINCT e.sessao_id
          ) FILTER (
            WHERE e.id IS NOT NULL
          )::INT AS sessoes,

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
          )::INT AS agendamentos_concluidos

        FROM marketing_campanhas mc

        LEFT JOIN eventos_produto e
          ON NULLIF(
            BTRIM(
              e.propriedades
                ->> 'utm_source'
            ),
            ''
          ) = mc.utm_source

          AND COALESCE(
            NULLIF(
              BTRIM(
                e.propriedades
                  ->> 'utm_medium'
              ),
              ''
            ),
            'cpc'
          ) = mc.utm_medium

          AND NULLIF(
            BTRIM(
              e.propriedades
                ->> 'utm_campaign'
            ),
            ''
          ) = mc.utm_campaign

          ${eventos}

        GROUP BY mc.id
      ),

      gastos_por_campanha AS (
        SELECT
          g.campanha_id,

          COALESCE(
            SUM(g.valor_centavos),
            0
          )::BIGINT
            AS investimento_centavos

        FROM marketing_campanha_gastos g

        WHERE g.moeda = 'BRL'
          ${gastos}

        GROUP BY g.campanha_id
      )

      SELECT
        mc.id,
        mc.nome,
        mc.canal,
        mc.utm_source,
        mc.utm_medium,
        mc.utm_campaign,
        mc.ativo,

        COALESCE(
          epc.sessoes,
          0
        )::INT AS sessoes,

        COALESCE(
          epc.agendamentos_concluidos,
          0
        )::INT
          AS agendamentos_concluidos,

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
  listarGastos,
  salvarGastoManual,
  filtroEvento,
  filtroGasto,
  periodoSeguro,
};
