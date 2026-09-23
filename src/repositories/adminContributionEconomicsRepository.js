const db = require("../db/db");

function diasPeriodo(periodo) {
  if (String(periodo) === "all") {
    return null;
  }

  const valor = Number(periodo);

  return (
    Number.isInteger(valor) &&
    valor >= 1 &&
    valor <= 3650
  )
    ? valor
    : 30;
}

async function buscarResumoContribuicao(
  periodo = "30"
) {
  const dias = diasPeriodo(periodo);

  const resultado = await db.query(
    `
    WITH marco AS (
      SELECT
        ocorrido_em,
        (
          ocorrido_em
          AT TIME ZONE 'America/Sao_Paulo'
        )::date AS data_corte
      FROM financeiro_marcos
      WHERE chave =
        'margem_contribuicao_v1_inicio'
      LIMIT 1
    ),
    janela AS (
      SELECT
        m.ocorrido_em,
        CASE
          WHEN $1::INT IS NULL
            THEN m.data_corte
          ELSE GREATEST(
            m.data_corte,
            (
              NOW()
              AT TIME ZONE 'America/Sao_Paulo'
            )::date - $1::INT
          )
        END AS inicio_data,
        (
          NOW()
          AT TIME ZONE 'America/Sao_Paulo'
        )::date AS fim_data
      FROM marco m
    ),
    fontes AS (
      SELECT
        f.id
      FROM contribuicao_fontes f
      WHERE f.ativa = TRUE
        AND f.obrigatoria_para_margem = TRUE
    ),
    cobertura AS (
      SELECT
        f.id,
        (
          cc.status = 'COMPLETA'
          AND cc.inicio_cobertura <=
            j.inicio_data
          AND cc.coberto_ate >=
            j.fim_data
        ) AS coberta
      FROM fontes f
      CROSS JOIN janela j
      LEFT JOIN contribuicao_cobertura cc
        ON cc.fonte_id = f.id
    ),
    custos AS (
      SELECT
        COALESCE(
          SUM(
            CASE
              WHEN c.tipo = 'DEBITO'
                THEN c.valor
              WHEN c.tipo = 'CREDITO'
                THEN -c.valor
              ELSE 0
            END
          ),
          0
        )::NUMERIC(14,2)
          AS valor
      FROM contribuicao_custos c
      INNER JOIN fontes f
        ON f.id = c.fonte_id
      CROSS JOIN janela j
      WHERE (
        c.ocorrido_em
        AT TIME ZONE 'America/Sao_Paulo'
      )::date BETWEEN
        j.inicio_data
        AND j.fim_data
    ),
    estornos AS (
      SELECT
        pagamento_id,
        COALESCE(
          SUM(valor) FILTER (
            WHERE status_provedor = 'DONE'
          ),
          0
        )::NUMERIC(14,2)
          AS valor_estornado
      FROM pagamento_estornos
      GROUP BY pagamento_id
    ),
    pagamentos_janela AS (
      SELECT
        pg.id,
        pe.status_reconciliacao,
        pe.valor_liquido_gateway,
        COALESCE(
          e.valor_estornado,
          0
        )::NUMERIC(14,2)
          AS valor_estornado
      FROM pagamentos pg
      CROSS JOIN janela j
      LEFT JOIN pagamento_economia pe
        ON pe.pagamento_id = pg.id
      LEFT JOIN estornos e
        ON e.pagamento_id = pg.id
      WHERE pg.data_pagamento IS NOT NULL
        AND pg.data_pagamento BETWEEN
          j.inicio_data
          AND j.fim_data
    ),
    gateway AS (
      SELECT
        COUNT(*)::INT
          AS pagamentos_elegiveis,
        COUNT(*) FILTER (
          WHERE status_reconciliacao
            IS DISTINCT FROM 'COMPLETO'
        )::INT
          AS pagamentos_incompletos,
        COALESCE(
          SUM(
            valor_liquido_gateway -
            valor_estornado
          ) FILTER (
            WHERE status_reconciliacao =
              'COMPLETO'
          ),
          0
        )::NUMERIC(14,2)
          AS receita_liquida
      FROM pagamentos_janela
    )
    SELECT
      j.ocorrido_em AS inicio_cobertura,
      j.inicio_data,
      j.fim_data,
      (
        SELECT COUNT(*)::INT
        FROM fontes
      ) AS fontes_obrigatorias,
      (
        SELECT COUNT(*)::INT
        FROM cobertura
        WHERE coberta
      ) AS fontes_cobertas,
      (
        (
          SELECT COUNT(*)
          FROM fontes
        ) > 0
        AND (
          SELECT COUNT(*)
          FROM cobertura
          WHERE coberta
        ) = (
          SELECT COUNT(*)
          FROM fontes
        )
      ) AS cobertura_completa,
      CASE
        WHEN (
          (
            SELECT COUNT(*)
            FROM fontes
          ) > 0
          AND (
            SELECT COUNT(*)
            FROM cobertura
            WHERE coberta
          ) = (
            SELECT COUNT(*)
            FROM fontes
          )
        )
          THEN (
            SELECT valor
            FROM custos
          )
        ELSE NULL
      END AS custos_variaveis_observados,
      g.pagamentos_elegiveis
        AS pagamentos_gateway_elegiveis,
      g.pagamentos_incompletos
        AS pagamentos_gateway_incompletos,
      (
        g.pagamentos_incompletos = 0
      ) AS cobertura_gateway_completa,
      CASE
        WHEN g.pagamentos_incompletos = 0
          THEN g.receita_liquida
        ELSE NULL
      END AS receita_liquida_gateway
    FROM janela j
    CROSS JOIN gateway g
    `,
    [dias]
  );

  return resultado.rows[0] || {
    inicio_cobertura: null,
    inicio_data: null,
    fim_data: null,
    fontes_obrigatorias: 0,
    fontes_cobertas: 0,
    cobertura_completa: false,
    custos_variaveis_observados: null,
    pagamentos_gateway_elegiveis: 0,
    pagamentos_gateway_incompletos: 0,
    cobertura_gateway_completa: false,
    receita_liquida_gateway: null,
  };
}

async function buscarLtvContribuicaoObservado() {
  const resultado = await db.query(
    `
    WITH marcos AS (
      SELECT
        MAX(ocorrido_em) FILTER (
          WHERE chave = 'ltv_v1_inicio'
        ) AS ltv_inicio,
        MAX(ocorrido_em) FILTER (
          WHERE chave =
            'economia_liquida_v1_inicio'
        ) AS economia_inicio,
        MAX(ocorrido_em) FILTER (
          WHERE chave =
            'margem_contribuicao_v1_inicio'
        ) AS contribuicao_inicio
      FROM financeiro_marcos
    ),
    fontes AS (
      SELECT f.id
      FROM contribuicao_fontes f
      WHERE f.ativa = TRUE
        AND f.obrigatoria_para_margem = TRUE
    ),
    contagem_fontes AS (
      SELECT COUNT(*)::INT AS total
      FROM fontes
    ),
    conversoes AS (
      SELECT DISTINCT ON (ae.negocio_id)
        ae.negocio_id,
        pg.data_pagamento
          AS primeira_conversao_data,
        ae.ocorrido_em
          AS primeira_conversao_em
      FROM assinatura_eventos ae
      INNER JOIN pagamentos pg
        ON pg.id = ae.pagamento_id
      CROSS JOIN marcos m
      WHERE ae.tipo =
          'CONVERSAO_INICIAL'
        AND ae.ocorrido_em >=
          m.ltv_inicio
        AND pg.data_pagamento
          IS NOT NULL
      ORDER BY
        ae.negocio_id,
        ae.ocorrido_em ASC,
        ae.id ASC
    ),
    estornos AS (
      SELECT
        pagamento_id,
        COALESCE(
          SUM(valor) FILTER (
            WHERE status_provedor = 'DONE'
          ),
          0
        )::NUMERIC(14,2)
          AS valor_estornado
      FROM pagamento_estornos
      GROUP BY pagamento_id
    ),
    pagamentos_coorte AS (
      SELECT
        c.negocio_id,
        c.primeira_conversao_data,
        pg.id AS pagamento_id,
        (
          pg.data_pagamento -
          c.primeira_conversao_data
        )::INT AS idade_dias,
        pe.status_reconciliacao,
        pe.valor_liquido_gateway,
        COALESCE(
          e.valor_estornado,
          0
        )::NUMERIC(14,2)
          AS valor_estornado
      FROM conversoes c
      INNER JOIN assinaturas a
        ON a.negocio_id =
          c.negocio_id
      INNER JOIN pagamentos pg
        ON pg.assinatura_id = a.id
      LEFT JOIN pagamento_economia pe
        ON pe.pagamento_id = pg.id
      LEFT JOIN estornos e
        ON e.pagamento_id = pg.id
      WHERE pg.data_pagamento IS NOT NULL
        AND pg.data_pagamento >=
          c.primeira_conversao_data
        AND pg.data_pagamento <=
          (
            NOW()
            AT TIME ZONE 'America/Sao_Paulo'
          )::date
    ),
    custos_coorte AS (
      SELECT
        c.negocio_id,
        (
          (
            cc.ocorrido_em
            AT TIME ZONE 'America/Sao_Paulo'
          )::date -
          c.primeira_conversao_data
        )::INT AS idade_dias,
        CASE
          WHEN cc.tipo = 'DEBITO'
            THEN cc.valor
          WHEN cc.tipo = 'CREDITO'
            THEN -cc.valor
          ELSE 0
        END::NUMERIC(14,2)
          AS valor
      FROM conversoes c
      INNER JOIN contribuicao_custos cc
        ON cc.negocio_id = c.negocio_id
      INNER JOIN fontes f
        ON f.id = cc.fonte_id
      WHERE (
        cc.ocorrido_em
        AT TIME ZONE 'America/Sao_Paulo'
      )::date >=
        c.primeira_conversao_data
    ),
    por_negocio AS (
      SELECT
        c.negocio_id,
        c.primeira_conversao_data,
        c.primeira_conversao_em,
        (
          c.primeira_conversao_em >=
            m.economia_inicio
          AND
          c.primeira_conversao_em >=
            m.contribuicao_inicio
        ) AS coberto_cutover,
        cf.total AS fontes_obrigatorias,
        (
          (
            NOW()
            AT TIME ZONE 'America/Sao_Paulo'
          )::date >=
          c.primeira_conversao_data + 30
        ) AS maduro_d30,
        (
          (
            NOW()
            AT TIME ZONE 'America/Sao_Paulo'
          )::date >=
          c.primeira_conversao_data + 60
        ) AS maduro_d60,
        (
          (
            NOW()
            AT TIME ZONE 'America/Sao_Paulo'
          )::date >=
          c.primeira_conversao_data + 90
        ) AS maduro_d90,
        (
          cf.total > 0
          AND NOT EXISTS (
            SELECT 1
            FROM fontes f
            LEFT JOIN contribuicao_cobertura cov
              ON cov.fonte_id = f.id
            WHERE
              cov.status IS DISTINCT FROM
                'COMPLETA'
              OR cov.inicio_cobertura >
                c.primeira_conversao_data
              OR cov.coberto_ate IS NULL
              OR cov.coberto_ate <
                c.primeira_conversao_data + 30
          )
        ) AS custos_cobertos_d30,
        (
          cf.total > 0
          AND NOT EXISTS (
            SELECT 1
            FROM fontes f
            LEFT JOIN contribuicao_cobertura cov
              ON cov.fonte_id = f.id
            WHERE
              cov.status IS DISTINCT FROM
                'COMPLETA'
              OR cov.inicio_cobertura >
                c.primeira_conversao_data
              OR cov.coberto_ate IS NULL
              OR cov.coberto_ate <
                c.primeira_conversao_data + 60
          )
        ) AS custos_cobertos_d60,
        (
          cf.total > 0
          AND NOT EXISTS (
            SELECT 1
            FROM fontes f
            LEFT JOIN contribuicao_cobertura cov
              ON cov.fonte_id = f.id
            WHERE
              cov.status IS DISTINCT FROM
                'COMPLETA'
              OR cov.inicio_cobertura >
                c.primeira_conversao_data
              OR cov.coberto_ate IS NULL
              OR cov.coberto_ate <
                c.primeira_conversao_data + 90
          )
        ) AS custos_cobertos_d90,
        COUNT(pc.pagamento_id) FILTER (
          WHERE pc.idade_dias
            BETWEEN 0 AND 30
            AND pc.status_reconciliacao
              IS DISTINCT FROM 'COMPLETO'
        )::INT AS gateway_incompletos_d30,
        COUNT(pc.pagamento_id) FILTER (
          WHERE pc.idade_dias
            BETWEEN 0 AND 60
            AND pc.status_reconciliacao
              IS DISTINCT FROM 'COMPLETO'
        )::INT AS gateway_incompletos_d60,
        COUNT(pc.pagamento_id) FILTER (
          WHERE pc.idade_dias
            BETWEEN 0 AND 90
            AND pc.status_reconciliacao
              IS DISTINCT FROM 'COMPLETO'
        )::INT AS gateway_incompletos_d90,
        COALESCE(
          SUM(
            pc.valor_liquido_gateway -
            pc.valor_estornado
          ) FILTER (
            WHERE pc.idade_dias
              BETWEEN 0 AND 30
              AND pc.status_reconciliacao =
                'COMPLETO'
          ),
          0
        )::NUMERIC(14,2)
          AS receita_liquida_d30,
        COALESCE(
          SUM(
            pc.valor_liquido_gateway -
            pc.valor_estornado
          ) FILTER (
            WHERE pc.idade_dias
              BETWEEN 0 AND 60
              AND pc.status_reconciliacao =
                'COMPLETO'
          ),
          0
        )::NUMERIC(14,2)
          AS receita_liquida_d60,
        COALESCE(
          SUM(
            pc.valor_liquido_gateway -
            pc.valor_estornado
          ) FILTER (
            WHERE pc.idade_dias
              BETWEEN 0 AND 90
              AND pc.status_reconciliacao =
                'COMPLETO'
          ),
          0
        )::NUMERIC(14,2)
          AS receita_liquida_d90,
        COALESCE(
          (
            SELECT SUM(custo.valor)
            FROM custos_coorte custo
            WHERE custo.negocio_id =
                c.negocio_id
              AND custo.idade_dias
                BETWEEN 0 AND 30
          ),
          0
        )::NUMERIC(14,2)
          AS custos_d30,
        COALESCE(
          (
            SELECT SUM(custo.valor)
            FROM custos_coorte custo
            WHERE custo.negocio_id =
                c.negocio_id
              AND custo.idade_dias
                BETWEEN 0 AND 60
          ),
          0
        )::NUMERIC(14,2)
          AS custos_d60,
        COALESCE(
          (
            SELECT SUM(custo.valor)
            FROM custos_coorte custo
            WHERE custo.negocio_id =
                c.negocio_id
              AND custo.idade_dias
                BETWEEN 0 AND 90
          ),
          0
        )::NUMERIC(14,2)
          AS custos_d90
      FROM conversoes c
      CROSS JOIN marcos m
      CROSS JOIN contagem_fontes cf
      LEFT JOIN pagamentos_coorte pc
        ON pc.negocio_id = c.negocio_id
      GROUP BY
        c.negocio_id,
        c.primeira_conversao_data,
        c.primeira_conversao_em,
        m.economia_inicio,
        m.contribuicao_inicio,
        cf.total
    )
    SELECT
      m.contribuicao_inicio
        AS inicio_cobertura,
      pn.fontes_obrigatorias,
      TO_CHAR(
        DATE_TRUNC(
          'month',
          pn.primeira_conversao_data
        ),
        'YYYY-MM'
      ) AS coorte_mes,
      COUNT(*)::INT AS negocios,
      COUNT(*) FILTER (
        WHERE pn.maduro_d30
          AND pn.coberto_cutover
      )::INT AS maduros_elegiveis_d30,
      COUNT(*) FILTER (
        WHERE pn.maduro_d60
          AND pn.coberto_cutover
      )::INT AS maduros_elegiveis_d60,
      COUNT(*) FILTER (
        WHERE pn.maduro_d90
          AND pn.coberto_cutover
      )::INT AS maduros_elegiveis_d90,
      COUNT(*) FILTER (
        WHERE pn.maduro_d30
          AND pn.coberto_cutover
          AND (
            NOT pn.custos_cobertos_d30
            OR pn.gateway_incompletos_d30 > 0
          )
      )::INT AS negocios_incompletos_d30,
      COUNT(*) FILTER (
        WHERE pn.maduro_d60
          AND pn.coberto_cutover
          AND (
            NOT pn.custos_cobertos_d60
            OR pn.gateway_incompletos_d60 > 0
          )
      )::INT AS negocios_incompletos_d60,
      COUNT(*) FILTER (
        WHERE pn.maduro_d90
          AND pn.coberto_cutover
          AND (
            NOT pn.custos_cobertos_d90
            OR pn.gateway_incompletos_d90 > 0
          )
      )::INT AS negocios_incompletos_d90,
      COUNT(*) FILTER (
        WHERE pn.maduro_d30
          AND pn.coberto_cutover
          AND pn.custos_cobertos_d30
          AND pn.gateway_incompletos_d30 = 0
      )::INT AS maduros_cobertos_d30,
      COUNT(*) FILTER (
        WHERE pn.maduro_d60
          AND pn.coberto_cutover
          AND pn.custos_cobertos_d60
          AND pn.gateway_incompletos_d60 = 0
      )::INT AS maduros_cobertos_d60,
      COUNT(*) FILTER (
        WHERE pn.maduro_d90
          AND pn.coberto_cutover
          AND pn.custos_cobertos_d90
          AND pn.gateway_incompletos_d90 = 0
      )::INT AS maduros_cobertos_d90,
      COALESCE(
        SUM(
          pn.receita_liquida_d30 -
          pn.custos_d30
        ) FILTER (
          WHERE pn.maduro_d30
            AND pn.coberto_cutover
            AND pn.custos_cobertos_d30
            AND pn.gateway_incompletos_d30 = 0
        ),
        0
      )::NUMERIC(14,2)
        AS contribuicao_d30,
      COALESCE(
        SUM(
          pn.receita_liquida_d60 -
          pn.custos_d60
        ) FILTER (
          WHERE pn.maduro_d60
            AND pn.coberto_cutover
            AND pn.custos_cobertos_d60
            AND pn.gateway_incompletos_d60 = 0
        ),
        0
      )::NUMERIC(14,2)
        AS contribuicao_d60,
      COALESCE(
        SUM(
          pn.receita_liquida_d90 -
          pn.custos_d90
        ) FILTER (
          WHERE pn.maduro_d90
            AND pn.coberto_cutover
            AND pn.custos_cobertos_d90
            AND pn.gateway_incompletos_d90 = 0
        ),
        0
      )::NUMERIC(14,2)
        AS contribuicao_d90
    FROM por_negocio pn
    CROSS JOIN marcos m
    GROUP BY
      m.contribuicao_inicio,
      pn.fontes_obrigatorias,
      DATE_TRUNC(
        'month',
        pn.primeira_conversao_data
      )
    ORDER BY
      DATE_TRUNC(
        'month',
        pn.primeira_conversao_data
      ) ASC
    `
  );

  return {
    inicio_cobertura:
      resultado.rows[0]
        ?.inicio_cobertura ||
      null,
    fontes_obrigatorias:
      Number(
        resultado.rows[0]
          ?.fontes_obrigatorias ||
        0
      ),
    coortes: resultado.rows,
  };
}

module.exports = {
  buscarResumoContribuicao,
  buscarLtvContribuicaoObservado,
};
