const db = require("../db/db");

const TIME_ZONE = "America/Sao_Paulo";

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

function diasMaturacaoSeguro(valor) {
  const dias = Number(valor);

  return (
    Number.isInteger(dias) &&
    dias >= 1 &&
    dias <= 180
  )
    ? dias
    : 21;
}

async function buscarResumoEconomia(
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
          AT TIME ZONE '${TIME_ZONE}'
        )::date AS data_corte
      FROM financeiro_marcos
      WHERE chave =
        'economia_liquida_v1_inicio'
      LIMIT 1
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
    base AS (
      SELECT
        pg.id,
        pg.data_pagamento,
        pe.valor_bruto,
        pe.valor_liquido_gateway,
        pe.status_reconciliacao,
        COALESCE(
          e.valor_estornado,
          0
        )::NUMERIC(14,2)
          AS valor_estornado
      FROM pagamentos pg
      CROSS JOIN marco m
      LEFT JOIN pagamento_economia pe
        ON pe.pagamento_id = pg.id
      LEFT JOIN estornos e
        ON e.pagamento_id = pg.id
      WHERE pg.data_pagamento IS NOT NULL
        AND pg.data_pagamento >=
          m.data_corte
        AND (
          $1::INT IS NULL
          OR pg.data_pagamento >=
            (
              NOW()
              AT TIME ZONE '${TIME_ZONE}'
            )::date - $1::INT
        )
    )
    SELECT
      m.ocorrido_em
        AS inicio_cobertura,
      COUNT(b.id)::INT
        AS pagamentos_elegiveis,
      COUNT(b.id) FILTER (
        WHERE b.status_reconciliacao =
          'COMPLETO'
      )::INT
        AS pagamentos_completos,
      COUNT(b.id) FILTER (
        WHERE b.status_reconciliacao
          IS DISTINCT FROM 'COMPLETO'
      )::INT
        AS pagamentos_incompletos,
      COALESCE(
        SUM(b.valor_bruto) FILTER (
          WHERE b.status_reconciliacao =
            'COMPLETO'
        ),
        0
      )::NUMERIC(14,2)
        AS valor_bruto_reconciliado,
      COALESCE(
        SUM(
          b.valor_bruto -
          b.valor_liquido_gateway
        ) FILTER (
          WHERE b.status_reconciliacao =
            'COMPLETO'
        ),
        0
      )::NUMERIC(14,2)
        AS taxas_gateway_observadas,
      COALESCE(
        SUM(b.valor_estornado) FILTER (
          WHERE b.status_reconciliacao =
            'COMPLETO'
        ),
        0
      )::NUMERIC(14,2)
        AS estornos_concluidos,
      COALESCE(
        SUM(
          b.valor_liquido_gateway -
          b.valor_estornado
        ) FILTER (
          WHERE b.status_reconciliacao =
            'COMPLETO'
        ),
        0
      )::NUMERIC(14,2)
        AS receita_liquida_gateway
    FROM marco m
    LEFT JOIN base b
      ON TRUE
    GROUP BY m.ocorrido_em
    `,
    [dias]
  );

  return resultado.rows[0] || {};
}

async function buscarLtvLiquidoObservado() {
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
        ) AS economia_inicio
      FROM financeiro_marcos
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
        c.primeira_conversao_em,
        pg.id AS pagamento_id,
        pg.data_pagamento,
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
            AT TIME ZONE '${TIME_ZONE}'
          )::date
    ),
    por_negocio AS (
      SELECT
        c.negocio_id,
        c.primeira_conversao_data,
        c.primeira_conversao_em,
        (
          c.primeira_conversao_em >=
          m.economia_inicio
        ) AS coberto_economia,
        (
          (
            NOW()
            AT TIME ZONE '${TIME_ZONE}'
          )::date >=
          c.primeira_conversao_data + 30
        ) AS maduro_d30,
        (
          (
            NOW()
            AT TIME ZONE '${TIME_ZONE}'
          )::date >=
          c.primeira_conversao_data + 60
        ) AS maduro_d60,
        (
          (
            NOW()
            AT TIME ZONE '${TIME_ZONE}'
          )::date >=
          c.primeira_conversao_data + 90
        ) AS maduro_d90,
        COUNT(pc.pagamento_id) FILTER (
          WHERE pc.idade_dias
            BETWEEN 0 AND 30
            AND pc.status_reconciliacao
              IS DISTINCT FROM 'COMPLETO'
        )::INT AS incompletos_d30,
        COUNT(pc.pagamento_id) FILTER (
          WHERE pc.idade_dias
            BETWEEN 0 AND 60
            AND pc.status_reconciliacao
              IS DISTINCT FROM 'COMPLETO'
        )::INT AS incompletos_d60,
        COUNT(pc.pagamento_id) FILTER (
          WHERE pc.idade_dias
            BETWEEN 0 AND 90
            AND pc.status_reconciliacao
              IS DISTINCT FROM 'COMPLETO'
        )::INT AS incompletos_d90,
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
          AS receita_liquida_d90
      FROM conversoes c
      CROSS JOIN marcos m
      LEFT JOIN pagamentos_coorte pc
        ON pc.negocio_id =
          c.negocio_id
      GROUP BY
        c.negocio_id,
        c.primeira_conversao_data,
        c.primeira_conversao_em,
        m.economia_inicio
    )
    SELECT
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
          AND pn.coberto_economia
      )::INT AS maduros_cobertos_d30,
      COUNT(*) FILTER (
        WHERE pn.maduro_d60
          AND pn.coberto_economia
      )::INT AS maduros_cobertos_d60,
      COUNT(*) FILTER (
        WHERE pn.maduro_d90
          AND pn.coberto_economia
      )::INT AS maduros_cobertos_d90,
      COUNT(*) FILTER (
        WHERE pn.maduro_d30
          AND pn.coberto_economia
          AND pn.incompletos_d30 > 0
      )::INT
        AS negocios_incompletos_d30,
      COUNT(*) FILTER (
        WHERE pn.maduro_d60
          AND pn.coberto_economia
          AND pn.incompletos_d60 > 0
      )::INT
        AS negocios_incompletos_d60,
      COUNT(*) FILTER (
        WHERE pn.maduro_d90
          AND pn.coberto_economia
          AND pn.incompletos_d90 > 0
      )::INT
        AS negocios_incompletos_d90,
      COALESCE(
        SUM(pn.receita_liquida_d30)
          FILTER (
            WHERE pn.maduro_d30
              AND pn.coberto_economia
          ),
        0
      )::NUMERIC(14,2)
        AS receita_liquida_d30,
      COALESCE(
        SUM(pn.receita_liquida_d60)
          FILTER (
            WHERE pn.maduro_d60
              AND pn.coberto_economia
          ),
        0
      )::NUMERIC(14,2)
        AS receita_liquida_d60,
      COALESCE(
        SUM(pn.receita_liquida_d90)
          FILTER (
            WHERE pn.maduro_d90
              AND pn.coberto_economia
          ),
        0
      )::NUMERIC(14,2)
        AS receita_liquida_d90
    FROM por_negocio pn
    GROUP BY
      DATE_TRUNC(
        'month',
        pn.primeira_conversao_data
      )
    ORDER BY
      DATE_TRUNC(
        'month',
        pn.primeira_conversao_data
      ) DESC
    `
  );

  const marco = await db.query(
    `
    SELECT ocorrido_em
    FROM financeiro_marcos
    WHERE chave =
      'economia_liquida_v1_inicio'
    LIMIT 1
    `
  );

  return {
    inicio_cobertura:
      marco.rows[0]?.ocorrido_em ||
      null,
    coortes: resultado.rows,
  };
}

async function buscarRetornoLiquidoAquisicao({
  diasMaturacaoMonetizacao = 21,
} = {}) {
  const dias =
    diasMaturacaoSeguro(
      diasMaturacaoMonetizacao
    );

  const resultado = await db.query(
    `
    WITH marco AS (
      SELECT ocorrido_em
      FROM financeiro_marcos
      WHERE chave =
        'economia_liquida_v1_inicio'
      LIMIT 1
    ),
    snapshots AS (
      SELECT
        mna.negocio_id,
        mna.campanha_oficial_id,
        (
          mna.atribuicao_em
          AT TIME ZONE '${TIME_ZONE}'
        )::date AS data_aquisicao,
        mna.primeira_conversao_data
          AS data_conversao,
        mna.primeira_conversao_em
      FROM marketing_negocio_aquisicoes
        mna
      WHERE mna.classificacao_atribuicao =
          'oficial'
        AND mna.campanha_oficial_id
          IS NOT NULL
        AND mna.atribuicao_em
          IS NOT NULL
        AND (
          mna.primeira_conversao_data -
          (
            mna.atribuicao_em
            AT TIME ZONE '${TIME_ZONE}'
          )::date
        ) BETWEEN 0 AND $1::INT
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
    pagamentos_negocio AS (
      SELECT
        s.negocio_id,
        pg.id AS pagamento_id,
        pg.data_pagamento,
        (
          pg.data_pagamento -
          s.data_conversao
        )::INT AS idade_dias,
        pe.status_reconciliacao,
        pe.valor_liquido_gateway,
        COALESCE(
          e.valor_estornado,
          0
        )::NUMERIC(14,2)
          AS valor_estornado
      FROM snapshots s
      INNER JOIN assinaturas a
        ON a.negocio_id = s.negocio_id
      INNER JOIN pagamentos pg
        ON pg.assinatura_id = a.id
      LEFT JOIN pagamento_economia pe
        ON pe.pagamento_id = pg.id
      LEFT JOIN estornos e
        ON e.pagamento_id = pg.id
      WHERE pg.data_pagamento IS NOT NULL
        AND pg.data_pagamento >=
          s.data_conversao
    ),
    por_negocio AS (
      SELECT
        s.negocio_id,
        s.campanha_oficial_id,
        s.data_aquisicao,
        (
          s.primeira_conversao_em >=
          m.ocorrido_em
        ) AS coberto_economia,
        COUNT(pn.pagamento_id) FILTER (
          WHERE pn.idade_dias
            BETWEEN 0 AND 30
            AND pn.status_reconciliacao
              IS DISTINCT FROM 'COMPLETO'
        )::INT AS incompletos_d30,
        COUNT(pn.pagamento_id) FILTER (
          WHERE pn.idade_dias
            BETWEEN 0 AND 60
            AND pn.status_reconciliacao
              IS DISTINCT FROM 'COMPLETO'
        )::INT AS incompletos_d60,
        COUNT(pn.pagamento_id) FILTER (
          WHERE pn.idade_dias
            BETWEEN 0 AND 90
            AND pn.status_reconciliacao
              IS DISTINCT FROM 'COMPLETO'
        )::INT AS incompletos_d90,
        COALESCE(
          SUM(
            pn.valor_liquido_gateway -
            pn.valor_estornado
          ) FILTER (
            WHERE pn.idade_dias
              BETWEEN 0 AND 30
              AND pn.status_reconciliacao =
                'COMPLETO'
          ),
          0
        )::NUMERIC(14,2)
          AS receita_liquida_d30,
        COALESCE(
          SUM(
            pn.valor_liquido_gateway -
            pn.valor_estornado
          ) FILTER (
            WHERE pn.idade_dias
              BETWEEN 0 AND 60
              AND pn.status_reconciliacao =
                'COMPLETO'
          ),
          0
        )::NUMERIC(14,2)
          AS receita_liquida_d60,
        COALESCE(
          SUM(
            pn.valor_liquido_gateway -
            pn.valor_estornado
          ) FILTER (
            WHERE pn.idade_dias
              BETWEEN 0 AND 90
              AND pn.status_reconciliacao =
                'COMPLETO'
          ),
          0
        )::NUMERIC(14,2)
          AS receita_liquida_d90
      FROM snapshots s
      CROSS JOIN marco m
      LEFT JOIN pagamentos_negocio pn
        ON pn.negocio_id =
          s.negocio_id
      GROUP BY
        s.negocio_id,
        s.campanha_oficial_id,
        s.data_aquisicao,
        s.primeira_conversao_em,
        m.ocorrido_em
    )
    SELECT
      campanha_oficial_id
        AS campanha_id,
      COUNT(*) FILTER (
        WHERE coberto_economia
          AND (
            (
              NOW()
              AT TIME ZONE '${TIME_ZONE}'
            )::date -
            data_aquisicao
          ) >= $1::INT + 30
      )::INT AS negocios_d30,
      COUNT(*) FILTER (
        WHERE coberto_economia
          AND (
            (
              NOW()
              AT TIME ZONE '${TIME_ZONE}'
            )::date -
            data_aquisicao
          ) >= $1::INT + 60
      )::INT AS negocios_d60,
      COUNT(*) FILTER (
        WHERE coberto_economia
          AND (
            (
              NOW()
              AT TIME ZONE '${TIME_ZONE}'
            )::date -
            data_aquisicao
          ) >= $1::INT + 90
      )::INT AS negocios_d90,
      COUNT(*) FILTER (
        WHERE coberto_economia
          AND incompletos_d30 > 0
          AND (
            (
              NOW()
              AT TIME ZONE '${TIME_ZONE}'
            )::date -
            data_aquisicao
          ) >= $1::INT + 30
      )::INT AS incompletos_d30,
      COUNT(*) FILTER (
        WHERE coberto_economia
          AND incompletos_d60 > 0
          AND (
            (
              NOW()
              AT TIME ZONE '${TIME_ZONE}'
            )::date -
            data_aquisicao
          ) >= $1::INT + 60
      )::INT AS incompletos_d60,
      COUNT(*) FILTER (
        WHERE coberto_economia
          AND incompletos_d90 > 0
          AND (
            (
              NOW()
              AT TIME ZONE '${TIME_ZONE}'
            )::date -
            data_aquisicao
          ) >= $1::INT + 90
      )::INT AS incompletos_d90,
      COALESCE(
        SUM(receita_liquida_d30)
          FILTER (
            WHERE coberto_economia
              AND (
                (
                  NOW()
                  AT TIME ZONE '${TIME_ZONE}'
                )::date -
                data_aquisicao
              ) >= $1::INT + 30
          ),
        0
      )::NUMERIC(14,2)
        AS receita_liquida_d30,
      COALESCE(
        SUM(receita_liquida_d60)
          FILTER (
            WHERE coberto_economia
              AND (
                (
                  NOW()
                  AT TIME ZONE '${TIME_ZONE}'
                )::date -
                data_aquisicao
              ) >= $1::INT + 60
          ),
        0
      )::NUMERIC(14,2)
        AS receita_liquida_d60,
      COALESCE(
        SUM(receita_liquida_d90)
          FILTER (
            WHERE coberto_economia
              AND (
                (
                  NOW()
                  AT TIME ZONE '${TIME_ZONE}'
                )::date -
                data_aquisicao
              ) >= $1::INT + 90
          ),
        0
      )::NUMERIC(14,2)
        AS receita_liquida_d90
    FROM por_negocio
    GROUP BY campanha_oficial_id
    `,
    [dias]
  );

  const marco = await db.query(
    `
    SELECT ocorrido_em
    FROM financeiro_marcos
    WHERE chave =
      'economia_liquida_v1_inicio'
    LIMIT 1
    `
  );

  return {
    inicio_cobertura:
      marco.rows[0]?.ocorrido_em ||
      null,
    campanhas: resultado.rows,
  };
}

module.exports = {
  buscarResumoEconomia,
  buscarLtvLiquidoObservado,
  buscarRetornoLiquidoAquisicao,
};
