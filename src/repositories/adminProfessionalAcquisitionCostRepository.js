const db = require(
  "../db/db"
);
const {
  filtroGasto,
  periodoSeguro,
} = require(
  "./adminMarketingCostRepository"
);

async function listarInvestimentos(
  periodo = "30"
) {
  const periodoNormalizado =
    periodoSeguro(periodo);
  const filtro = filtroGasto(
    periodoNormalizado,
    "g"
  );

  const resultado = await db.query(
    `
    SELECT
      mc.id AS campanha_id,
      mc.nome AS campanha_nome,
      mc.canal,
      mc.objetivo,
      mc.utm_source,
      mc.utm_medium,
      mc.utm_campaign,
      COUNT(
        DISTINCT g.data_gasto
      )::INT AS dias_com_gasto,
      COALESCE(
        SUM(g.valor_centavos),
        0
      )::BIGINT AS investimento_centavos

    FROM marketing_campanhas mc

    INNER JOIN marketing_campanha_gastos g
      ON g.campanha_id = mc.id

    WHERE mc.objetivo = 'profissional'
      AND g.moeda = 'BRL'
      ${filtro}

    GROUP BY
      mc.id,
      mc.nome,
      mc.canal,
      mc.objetivo,
      mc.utm_source,
      mc.utm_medium,
      mc.utm_campaign

    ORDER BY
      investimento_centavos DESC,
      mc.id DESC
    `
  );

  return {
    periodo: periodoNormalizado,
    linhas: resultado.rows,
  };
}

async function listarInvestimentosDiarios(
  periodo = "30"
) {
  const periodoNormalizado =
    periodoSeguro(periodo);
  const filtro = filtroGasto(
    periodoNormalizado,
    "g"
  );

  const resultado = await db.query(
    `
    SELECT
      mc.id AS campanha_id,
      mc.nome AS campanha_nome,
      mc.canal,
      mc.objetivo,
      mc.utm_source,
      mc.utm_medium,
      mc.utm_campaign,
      g.data_gasto::TEXT AS data_gasto,
      (
        (NOW() AT TIME ZONE 'America/Sao_Paulo')::DATE -
        g.data_gasto
      )::INT AS idade_dias,
      COALESCE(
        SUM(g.valor_centavos),
        0
      )::BIGINT AS investimento_centavos

    FROM marketing_campanhas mc

    INNER JOIN marketing_campanha_gastos g
      ON g.campanha_id = mc.id

    WHERE mc.objetivo = 'profissional'
      AND g.moeda = 'BRL'
      ${filtro}

    GROUP BY
      mc.id,
      mc.nome,
      mc.canal,
      mc.objetivo,
      mc.utm_source,
      mc.utm_medium,
      mc.utm_campaign,
      g.data_gasto

    ORDER BY
      g.data_gasto DESC,
      mc.id DESC
    `
  );

  return {
    periodo: periodoNormalizado,
    linhas: resultado.rows,
  };
}

module.exports = {
  listarInvestimentos,
  listarInvestimentosDiarios,
};
