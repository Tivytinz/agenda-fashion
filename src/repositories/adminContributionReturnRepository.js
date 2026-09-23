const db = require("../db/db");

const TIME_ZONE =
  "America/Sao_Paulo";

function diasSeguro(valor) {
  const dias = Number(valor);

  if (
    !Number.isInteger(dias) ||
    dias < 1 ||
    dias > 180
  ) {
    return 21;
  }

  return dias;
}

async function buscarProntidao() {
  const resultado = await db.query(
    `
    WITH marco_wave30 AS (
      SELECT ocorrido_em
      FROM financeiro_marcos
      WHERE chave =
        'retorno_contribuicao_v1_inicio'
      LIMIT 1
    ),
    marco_contribuicao AS (
      SELECT ocorrido_em
      FROM financeiro_marcos
      WHERE chave =
        'margem_contribuicao_v1_inicio'
      LIMIT 1
    ),
    fontes AS (
      SELECT
        f.id,
        cc.inicio_cobertura,
        cc.coberto_ate,
        cc.status
      FROM contribuicao_fontes f
      LEFT JOIN contribuicao_cobertura cc
        ON cc.fonte_id = f.id
      WHERE f.ativa = TRUE
        AND f.obrigatoria_para_margem = TRUE
    )
    SELECT
      (
        SELECT ocorrido_em
        FROM marco_wave30
      ) AS inicio_cobertura_wave30,
      (
        SELECT ocorrido_em
        FROM marco_contribuicao
      ) AS inicio_cobertura_contribuicao,
      COUNT(*)::INT
        AS fontes_obrigatorias,
      COUNT(*) FILTER (
        WHERE
          status = 'COMPLETA'
          AND inicio_cobertura IS NOT NULL
          AND coberto_ate IS NOT NULL
          AND coberto_ate >=
            (
              NOW()
              AT TIME ZONE 'America/Sao_Paulo'
            )::date
      )::INT
        AS fontes_cobertas_ate_hoje,
      MIN(inicio_cobertura)
        AS inicio_cobertura_fontes,
      MIN(coberto_ate)
        AS menor_coberto_ate,
      (
        COUNT(*) > 0
        AND COUNT(*) FILTER (
          WHERE
            status = 'COMPLETA'
            AND inicio_cobertura IS NOT NULL
            AND coberto_ate IS NOT NULL
            AND coberto_ate >=
              (
                NOW()
                AT TIME ZONE 'America/Sao_Paulo'
              )::date
        ) = COUNT(*)
      ) AS cobertura_contribuicao_completa_hoje
    FROM fontes
    `
  );

  return resultado.rows[0] || {
    inicio_cobertura_wave30: null,
    inicio_cobertura_contribuicao: null,
    fontes_obrigatorias: 0,
    fontes_cobertas_ate_hoje: 0,
    inicio_cobertura_fontes: null,
    menor_coberto_ate: null,
    cobertura_contribuicao_completa_hoje:
      false,
  };
}

async function buscarRetornoContribuicaoAquisicao({
  diasMaturacaoMonetizacao = 21,
} = {}) {
  const dias =
    diasSeguro(
      diasMaturacaoMonetizacao
    );

  const resultado = await db.query(
    `
    WITH marcos AS (
      SELECT
        MAX(ocorrido_em) FILTER (
          WHERE chave =
            'retorno_contribuicao_v1_inicio'
        ) AS wave30_inicio,
        MAX(ocorrido_em) FILTER (
          WHERE chave =
            'margem_contribuicao_v1_inicio'
        ) AS contribuicao_inicio,
        MAX(ocorrido_em) FILTER (
          WHERE chave =
            'economia_liquida_v1_inicio'
        ) AS economia_inicio,
        (
          MAX(ocorrido_em) FILTER (
            WHERE chave =
              'retorno_contribuicao_v1_inicio'
          )
          AT TIME ZONE 'America/Sao_Paulo'
        )::date AS wave30_data
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
    custos_midia AS (
      SELECT
        g.campanha_id,
        g.data_gasto,
        (
          (
            NOW()
            AT TIME ZONE 'America/Sao_Paulo'
          )::date -
          g.data_gasto
        )::INT AS idade_dias,
        SUM(g.valor_centavos)::BIGINT
          AS investimento_centavos
      FROM marketing_campanha_gastos g
      CROSS JOIN marcos m
      WHERE g.objetivo_snapshot =
          'profissional'
        AND g.moeda = 'BRL'
        AND g.data_gasto >
          m.wave30_data
      GROUP BY
        g.campanha_id,
        g.data_gasto
    ),
    snapshots AS (
      SELECT
        mna.negocio_id,
        mna.campanha_oficial_id,
        (
          mna.atribuicao_em
          AT TIME ZONE 'America/Sao_Paulo'
        )::date AS data_aquisicao,
        mna.primeira_conversao_data
          AS data_conversao,
        mna.primeira_conversao_em
      FROM marketing_negocio_aquisicoes
        mna
      CROSS JOIN marcos m
      WHERE
        mna.classificacao_atribuicao =
          'oficial'
        AND mna.campanha_oficial_id
          IS NOT NULL
        AND mna.atribuicao_em
          IS NOT NULL
        AND mna.primeira_conversao_em >=
          m.wave30_inicio
        AND mna.primeira_conversao_em >=
          m.contribuicao_inicio
        AND mna.primeira_conversao_em >=
          m.economia_inicio
        AND (
          mna.atribuicao_em
          AT TIME ZONE 'America/Sao_Paulo'
        )::date > m.wave30_data
        AND (
          mna.primeira_conversao_data -
          (
            mna.atribuicao_em
            AT TIME ZONE 'America/Sao_Paulo'
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
        ON a.negocio_id =
          s.negocio_id
      INNER JOIN pagamentos pg
        ON pg.assinatura_id = a.id
      LEFT JOIN pagamento_economia pe
        ON pe.pagamento_id = pg.id
      LEFT JOIN estornos e
        ON e.pagamento_id = pg.id
      WHERE pg.data_pagamento
          IS NOT NULL
        AND pg.data_pagamento >=
          s.data_conversao
    ),
    custos_contribuicao AS (
      SELECT
        s.negocio_id,
        (
          (
            c.ocorrido_em
            AT TIME ZONE 'America/Sao_Paulo'
          )::date -
          s.data_conversao
        )::INT AS idade_dias,
        CASE
          WHEN c.tipo = 'DEBITO'
            THEN c.valor
          WHEN c.tipo = 'CREDITO'
            THEN -c.valor
          ELSE 0
        END::NUMERIC(14,2)
          AS valor
      FROM snapshots s
      INNER JOIN contribuicao_custos c
        ON c.negocio_id =
          s.negocio_id
      INNER JOIN fontes f
        ON f.id = c.fonte_id
      WHERE (
        c.ocorrido_em
        AT TIME ZONE 'America/Sao_Paulo'
      )::date >=
        s.data_conversao
    ),
    por_negocio AS (
      SELECT
        s.negocio_id,
        s.campanha_oficial_id,
        s.data_aquisicao,
        s.data_conversao,
        cm.investimento_centavos,
        cf.total AS fontes_obrigatorias,
        (
          (
            NOW()
            AT TIME ZONE 'America/Sao_Paulo'
          )::date -
          s.data_aquisicao
        ) >= $1::INT + 30
          AS maduro_d30,
        (
          (
            NOW()
            AT TIME ZONE 'America/Sao_Paulo'
          )::date -
          s.data_aquisicao
        ) >= $1::INT + 60
          AS maduro_d60,
        (
          (
            NOW()
            AT TIME ZONE 'America/Sao_Paulo'
          )::date -
          s.data_aquisicao
        ) >= $1::INT + 90
          AS maduro_d90,
        (
          cf.total > 0
          AND NOT EXISTS (
            SELECT 1
            FROM fontes f
            LEFT JOIN contribuicao_cobertura cc
              ON cc.fonte_id = f.id
            WHERE
              cc.status IS DISTINCT FROM
                'COMPLETA'
              OR cc.inicio_cobertura >
                s.data_conversao
              OR cc.coberto_ate IS NULL
              OR cc.coberto_ate <
                s.data_conversao + 30
          )
        ) AS custos_cobertos_d30,
        (
          cf.total > 0
          AND NOT EXISTS (
            SELECT 1
            FROM fontes f
            LEFT JOIN contribuicao_cobertura cc
              ON cc.fonte_id = f.id
            WHERE
              cc.status IS DISTINCT FROM
                'COMPLETA'
              OR cc.inicio_cobertura >
                s.data_conversao
              OR cc.coberto_ate IS NULL
              OR cc.coberto_ate <
                s.data_conversao + 60
          )
        ) AS custos_cobertos_d60,
        (
          cf.total > 0
          AND NOT EXISTS (
            SELECT 1
            FROM fontes f
            LEFT JOIN contribuicao_cobertura cc
              ON cc.fonte_id = f.id
            WHERE
              cc.status IS DISTINCT FROM
                'COMPLETA'
              OR cc.inicio_cobertura >
                s.data_conversao
              OR cc.coberto_ate IS NULL
              OR cc.coberto_ate <
                s.data_conversao + 90
          )
        ) AS custos_cobertos_d90,
        COUNT(pn.pagamento_id) FILTER (
          WHERE pn.idade_dias
            BETWEEN 0 AND 30
            AND pn.status_reconciliacao
              IS DISTINCT FROM 'COMPLETO'
        )::INT
          AS gateway_incompletos_d30,
        COUNT(pn.pagamento_id) FILTER (
          WHERE pn.idade_dias
            BETWEEN 0 AND 60
            AND pn.status_reconciliacao
              IS DISTINCT FROM 'COMPLETO'
        )::INT
          AS gateway_incompletos_d60,
        COUNT(pn.pagamento_id) FILTER (
          WHERE pn.idade_dias
            BETWEEN 0 AND 90
            AND pn.status_reconciliacao
              IS DISTINCT FROM 'COMPLETO'
        )::INT
          AS gateway_incompletos_d90,
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
          AS receita_liquida_d90,
        COALESCE(
          (
            SELECT SUM(cc.valor)
            FROM custos_contribuicao cc
            WHERE cc.negocio_id =
                s.negocio_id
              AND cc.idade_dias
                BETWEEN 0 AND 30
          ),
          0
        )::NUMERIC(14,2)
          AS custos_d30,
        COALESCE(
          (
            SELECT SUM(cc.valor)
            FROM custos_contribuicao cc
            WHERE cc.negocio_id =
                s.negocio_id
              AND cc.idade_dias
                BETWEEN 0 AND 60
          ),
          0
        )::NUMERIC(14,2)
          AS custos_d60,
        COALESCE(
          (
            SELECT SUM(cc.valor)
            FROM custos_contribuicao cc
            WHERE cc.negocio_id =
                s.negocio_id
              AND cc.idade_dias
                BETWEEN 0 AND 90
          ),
          0
        )::NUMERIC(14,2)
          AS custos_d90
      FROM snapshots s
      CROSS JOIN contagem_fontes cf
      LEFT JOIN custos_midia cm
        ON cm.campanha_id =
          s.campanha_oficial_id
        AND cm.data_gasto =
          s.data_aquisicao
      LEFT JOIN pagamentos_negocio pn
        ON pn.negocio_id =
          s.negocio_id
      GROUP BY
        s.negocio_id,
        s.campanha_oficial_id,
        s.data_aquisicao,
        s.data_conversao,
        cm.investimento_centavos,
        cf.total
    ),
    custos_midia_agregados AS (
      SELECT
        campanha_id,
        COALESCE(
          SUM(investimento_centavos)
            FILTER (
              WHERE idade_dias >=
                $1::INT + 30
            ),
          0
        )::BIGINT
          AS investimento_d30_centavos,
        COALESCE(
          SUM(investimento_centavos)
            FILTER (
              WHERE idade_dias >=
                $1::INT + 60
            ),
          0
        )::BIGINT
          AS investimento_d60_centavos,
        COALESCE(
          SUM(investimento_centavos)
            FILTER (
              WHERE idade_dias >=
                $1::INT + 90
            ),
          0
        )::BIGINT
          AS investimento_d90_centavos,
        COUNT(*) FILTER (
          WHERE idade_dias >=
            $1::INT + 30
        )::INT AS dias_maduros_d30,
        COUNT(*) FILTER (
          WHERE idade_dias >=
            $1::INT + 60
        )::INT AS dias_maduros_d60,
        COUNT(*) FILTER (
          WHERE idade_dias >=
            $1::INT + 90
        )::INT AS dias_maduros_d90
      FROM custos_midia
      GROUP BY campanha_id
    ),
    retornos AS (
      SELECT
        campanha_oficial_id
          AS campanha_id,
        MAX(fontes_obrigatorias)::INT
          AS fontes_obrigatorias,
        COUNT(DISTINCT negocio_id)
          FILTER (
            WHERE maduro_d30
              AND investimento_centavos
                IS NOT NULL
          )::INT AS negocios_d30,
        COUNT(DISTINCT negocio_id)
          FILTER (
            WHERE maduro_d60
              AND investimento_centavos
                IS NOT NULL
          )::INT AS negocios_d60,
        COUNT(DISTINCT negocio_id)
          FILTER (
            WHERE maduro_d90
              AND investimento_centavos
                IS NOT NULL
          )::INT AS negocios_d90,
        COUNT(DISTINCT negocio_id)
          FILTER (
            WHERE maduro_d30
              AND investimento_centavos
                IS NULL
          )::INT
            AS pagantes_sem_custo_d30,
        COUNT(DISTINCT negocio_id)
          FILTER (
            WHERE maduro_d60
              AND investimento_centavos
                IS NULL
          )::INT
            AS pagantes_sem_custo_d60,
        COUNT(DISTINCT negocio_id)
          FILTER (
            WHERE maduro_d90
              AND investimento_centavos
                IS NULL
          )::INT
            AS pagantes_sem_custo_d90,
        COUNT(DISTINCT negocio_id)
          FILTER (
            WHERE maduro_d30
              AND investimento_centavos
                IS NOT NULL
              AND (
                NOT custos_cobertos_d30
                OR gateway_incompletos_d30 >
                  0
              )
          )::INT AS incompletos_d30,
        COUNT(DISTINCT negocio_id)
          FILTER (
            WHERE maduro_d60
              AND investimento_centavos
                IS NOT NULL
              AND (
                NOT custos_cobertos_d60
                OR gateway_incompletos_d60 >
                  0
              )
          )::INT AS incompletos_d60,
        COUNT(DISTINCT negocio_id)
          FILTER (
            WHERE maduro_d90
              AND investimento_centavos
                IS NOT NULL
              AND (
                NOT custos_cobertos_d90
                OR gateway_incompletos_d90 >
                  0
              )
          )::INT AS incompletos_d90,
        COUNT(DISTINCT negocio_id)
          FILTER (
            WHERE maduro_d30
              AND investimento_centavos
                IS NOT NULL
              AND custos_cobertos_d30
              AND gateway_incompletos_d30 =
                0
          )::INT AS negocios_cobertos_d30,
        COUNT(DISTINCT negocio_id)
          FILTER (
            WHERE maduro_d60
              AND investimento_centavos
                IS NOT NULL
              AND custos_cobertos_d60
              AND gateway_incompletos_d60 =
                0
          )::INT AS negocios_cobertos_d60,
        COUNT(DISTINCT negocio_id)
          FILTER (
            WHERE maduro_d90
              AND investimento_centavos
                IS NOT NULL
              AND custos_cobertos_d90
              AND gateway_incompletos_d90 =
                0
          )::INT AS negocios_cobertos_d90,
        COALESCE(
          SUM(
            receita_liquida_d30 -
            custos_d30
          ) FILTER (
            WHERE maduro_d30
              AND investimento_centavos
                IS NOT NULL
              AND custos_cobertos_d30
              AND gateway_incompletos_d30 =
                0
          ),
          0
        )::NUMERIC(14,2)
          AS contribuicao_d30,
        COALESCE(
          SUM(
            receita_liquida_d60 -
            custos_d60
          ) FILTER (
            WHERE maduro_d60
              AND investimento_centavos
                IS NOT NULL
              AND custos_cobertos_d60
              AND gateway_incompletos_d60 =
                0
          ),
          0
        )::NUMERIC(14,2)
          AS contribuicao_d60,
        COALESCE(
          SUM(
            receita_liquida_d90 -
            custos_d90
          ) FILTER (
            WHERE maduro_d90
              AND investimento_centavos
                IS NOT NULL
              AND custos_cobertos_d90
              AND gateway_incompletos_d90 =
                0
          ),
          0
        )::NUMERIC(14,2)
          AS contribuicao_d90
      FROM por_negocio
      GROUP BY campanha_oficial_id
    ),
    campanhas_base AS (
      SELECT campanha_id
      FROM custos_midia
      UNION
      SELECT campanha_oficial_id
      FROM snapshots
    )
    SELECT
      cb.campanha_id,
      cf.total AS fontes_obrigatorias,
      COALESCE(
        cma.investimento_d30_centavos,
        0
      )::BIGINT
        AS investimento_d30_centavos,
      COALESCE(
        cma.investimento_d60_centavos,
        0
      )::BIGINT
        AS investimento_d60_centavos,
      COALESCE(
        cma.investimento_d90_centavos,
        0
      )::BIGINT
        AS investimento_d90_centavos,
      COALESCE(
        cma.dias_maduros_d30,
        0
      )::INT AS dias_maduros_d30,
      COALESCE(
        cma.dias_maduros_d60,
        0
      )::INT AS dias_maduros_d60,
      COALESCE(
        cma.dias_maduros_d90,
        0
      )::INT AS dias_maduros_d90,
      COALESCE(
        r.negocios_d30,
        0
      )::INT AS negocios_d30,
      COALESCE(
        r.negocios_d60,
        0
      )::INT AS negocios_d60,
      COALESCE(
        r.negocios_d90,
        0
      )::INT AS negocios_d90,
      COALESCE(
        r.negocios_cobertos_d30,
        0
      )::INT AS negocios_cobertos_d30,
      COALESCE(
        r.negocios_cobertos_d60,
        0
      )::INT AS negocios_cobertos_d60,
      COALESCE(
        r.negocios_cobertos_d90,
        0
      )::INT AS negocios_cobertos_d90,
      COALESCE(
        r.incompletos_d30,
        0
      )::INT AS incompletos_d30,
      COALESCE(
        r.incompletos_d60,
        0
      )::INT AS incompletos_d60,
      COALESCE(
        r.incompletos_d90,
        0
      )::INT AS incompletos_d90,
      COALESCE(
        r.pagantes_sem_custo_d30,
        0
      )::INT AS pagantes_sem_custo_d30,
      COALESCE(
        r.pagantes_sem_custo_d60,
        0
      )::INT AS pagantes_sem_custo_d60,
      COALESCE(
        r.pagantes_sem_custo_d90,
        0
      )::INT AS pagantes_sem_custo_d90,
      COALESCE(
        r.contribuicao_d30,
        0
      )::NUMERIC(14,2)
        AS contribuicao_d30,
      COALESCE(
        r.contribuicao_d60,
        0
      )::NUMERIC(14,2)
        AS contribuicao_d60,
      COALESCE(
        r.contribuicao_d90,
        0
      )::NUMERIC(14,2)
        AS contribuicao_d90
    FROM campanhas_base cb
    CROSS JOIN contagem_fontes cf
    LEFT JOIN custos_midia_agregados cma
      ON cma.campanha_id =
        cb.campanha_id
    LEFT JOIN retornos r
      ON r.campanha_id =
        cb.campanha_id
    ORDER BY cb.campanha_id
    `,
    [dias]
  );

  const marco = await db.query(
    `
    SELECT ocorrido_em
    FROM financeiro_marcos
    WHERE chave =
      'retorno_contribuicao_v1_inicio'
    LIMIT 1
    `
  );

  return {
    inicio_cobertura:
      marco.rows[0]?.ocorrido_em ||
      null,
    dias_maturacao_monetizacao:
      dias,
    campanhas: resultado.rows,
  };
}

module.exports = {
  buscarProntidao,
  buscarRetornoContribuicaoAquisicao,
};
