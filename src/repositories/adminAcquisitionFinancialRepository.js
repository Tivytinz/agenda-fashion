const db = require("../db/db");

const TIME_ZONE = "America/Sao_Paulo";

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

async function buscarRetornoAquisicao({
  diasMaturacaoMonetizacao = 21,
} = {}) {
  const diasMonetizacao =
    diasSeguro(
      diasMaturacaoMonetizacao
    );

  const [marco, campanhas, diagnostico] =
    await Promise.all([
      db.query(
        `
        SELECT
          ocorrido_em AS inicio_cobertura,
          (
            ocorrido_em
            AT TIME ZONE '${TIME_ZONE}'
          )::date + 1
            AS primeiro_dia_completo
        FROM financeiro_marcos
        WHERE chave =
          'aquisicao_financeira_v1_inicio'
        LIMIT 1
        `
      ),
      db.query(
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
            'aquisicao_financeira_v1_inicio'
          LIMIT 1
        ),
        custos_canonicos AS (
          SELECT
            g.campanha_id,
            g.data_gasto,
            (
              (
                NOW()
                AT TIME ZONE '${TIME_ZONE}'
              )::date -
              g.data_gasto
            )::INT AS idade_dias,
            SUM(g.valor_centavos)::BIGINT
              AS investimento_centavos
          FROM marketing_campanha_gastos g
          INNER JOIN marketing_campanhas mc
            ON mc.id = g.campanha_id
          CROSS JOIN marco m
          WHERE mc.objetivo = 'profissional'
            AND g.moeda = 'BRL'
            AND g.data_gasto > m.data_corte
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
              AT TIME ZONE '${TIME_ZONE}'
            )::date AS data_aquisicao,
            mna.primeira_conversao_data
              AS data_conversao,
            (
              mna.primeira_conversao_data -
              (
                mna.atribuicao_em
                AT TIME ZONE '${TIME_ZONE}'
              )::date
            )::INT AS dias_ate_conversao
          FROM marketing_negocio_aquisicoes mna
          CROSS JOIN marco m
          WHERE
            mna.classificacao_atribuicao =
              'oficial'
            AND mna.campanha_oficial_id
              IS NOT NULL
            AND (
              mna.atribuicao_em
              AT TIME ZONE '${TIME_ZONE}'
            )::date > m.data_corte
            AND (
              mna.primeira_conversao_data -
              (
                mna.atribuicao_em
                AT TIME ZONE '${TIME_ZONE}'
              )::date
            ) BETWEEN 0 AND $1::INT
        ),
        receita_negocio AS (
          SELECT
            s.negocio_id,
            s.campanha_oficial_id,
            s.data_aquisicao,
            s.data_conversao,
            COALESCE(
              SUM(
                ROUND(pg.valor * 100)
              ) FILTER (
                WHERE pg.data_pagamento
                  BETWEEN s.data_conversao
                    AND s.data_conversao + 30
              ),
              0
            )::BIGINT AS receita_d30_centavos,
            COALESCE(
              SUM(
                ROUND(pg.valor * 100)
              ) FILTER (
                WHERE pg.data_pagamento
                  BETWEEN s.data_conversao
                    AND s.data_conversao + 60
              ),
              0
            )::BIGINT AS receita_d60_centavos,
            COALESCE(
              SUM(
                ROUND(pg.valor * 100)
              ) FILTER (
                WHERE pg.data_pagamento
                  BETWEEN s.data_conversao
                    AND s.data_conversao + 90
              ),
              0
            )::BIGINT AS receita_d90_centavos,
            COALESCE(
              SUM(
                ROUND(pg.valor * 100)
              ) FILTER (
                WHERE UPPER(
                  COALESCE(pg.status, '')
                ) IN (
                  'REFUNDED',
                  'PARTIALLY_REFUNDED',
                  'REFUND_IN_PROGRESS',
                  'RECEIVED_IN_CASH_UNDONE',
                  'CHARGEBACK_REQUESTED',
                  'CHARGEBACK_DISPUTE',
                  'AWAITING_CHARGEBACK_REVERSAL'
                )
              ),
              0
            )::BIGINT
              AS valor_exposto_reversoes_centavos
          FROM snapshots s
          INNER JOIN assinaturas a
            ON a.negocio_id = s.negocio_id
          INNER JOIN pagamentos pg
            ON pg.assinatura_id = a.id
          WHERE pg.data_pagamento IS NOT NULL
            AND pg.data_pagamento >=
              s.data_conversao
          GROUP BY
            s.negocio_id,
            s.campanha_oficial_id,
            s.data_aquisicao,
            s.data_conversao
        ),
        custos_agregados AS (
          SELECT
            cc.campanha_id,
            COALESCE(
              SUM(cc.investimento_centavos)
                FILTER (
                  WHERE cc.idade_dias >=
                    $1::INT + 30
                ),
              0
            )::BIGINT
              AS investimento_d30_centavos,
            COALESCE(
              SUM(cc.investimento_centavos)
                FILTER (
                  WHERE cc.idade_dias >=
                    $1::INT + 60
                ),
              0
            )::BIGINT
              AS investimento_d60_centavos,
            COALESCE(
              SUM(cc.investimento_centavos)
                FILTER (
                  WHERE cc.idade_dias >=
                    $1::INT + 90
                ),
              0
            )::BIGINT
              AS investimento_d90_centavos,
            COUNT(*) FILTER (
              WHERE cc.idade_dias >=
                $1::INT + 30
            )::INT AS dias_maduros_d30,
            COUNT(*) FILTER (
              WHERE cc.idade_dias >=
                $1::INT + 60
            )::INT AS dias_maduros_d60,
            COUNT(*) FILTER (
              WHERE cc.idade_dias >=
                $1::INT + 90
            )::INT AS dias_maduros_d90
          FROM custos_canonicos cc
          GROUP BY cc.campanha_id
        ),
        retornos AS (
          SELECT
            rn.campanha_oficial_id
              AS campanha_id,
            COUNT(DISTINCT rn.negocio_id)
              FILTER (
                WHERE
                  (
                    (
                      NOW()
                      AT TIME ZONE
                        '${TIME_ZONE}'
                    )::date -
                    rn.data_aquisicao
                  ) >= $1::INT + 30
                  AND cc.investimento_centavos
                    IS NOT NULL
              )::INT AS negocios_pagos_d30,
            COUNT(DISTINCT rn.negocio_id)
              FILTER (
                WHERE
                  (
                    (
                      NOW()
                      AT TIME ZONE
                        '${TIME_ZONE}'
                    )::date -
                    rn.data_aquisicao
                  ) >= $1::INT + 60
                  AND cc.investimento_centavos
                    IS NOT NULL
              )::INT AS negocios_pagos_d60,
            COUNT(DISTINCT rn.negocio_id)
              FILTER (
                WHERE
                  (
                    (
                      NOW()
                      AT TIME ZONE
                        '${TIME_ZONE}'
                    )::date -
                    rn.data_aquisicao
                  ) >= $1::INT + 90
                  AND cc.investimento_centavos
                    IS NOT NULL
              )::INT AS negocios_pagos_d90,
            COALESCE(
              SUM(rn.receita_d30_centavos)
                FILTER (
                  WHERE
                    (
                      (
                        NOW()
                        AT TIME ZONE
                          '${TIME_ZONE}'
                      )::date -
                      rn.data_aquisicao
                    ) >= $1::INT + 30
                    AND cc.investimento_centavos
                      IS NOT NULL
                ),
              0
            )::BIGINT AS receita_d30_centavos,
            COALESCE(
              SUM(rn.receita_d60_centavos)
                FILTER (
                  WHERE
                    (
                      (
                        NOW()
                        AT TIME ZONE
                          '${TIME_ZONE}'
                      )::date -
                      rn.data_aquisicao
                    ) >= $1::INT + 60
                    AND cc.investimento_centavos
                      IS NOT NULL
                ),
              0
            )::BIGINT AS receita_d60_centavos,
            COALESCE(
              SUM(rn.receita_d90_centavos)
                FILTER (
                  WHERE
                    (
                      (
                        NOW()
                        AT TIME ZONE
                          '${TIME_ZONE}'
                      )::date -
                      rn.data_aquisicao
                    ) >= $1::INT + 90
                    AND cc.investimento_centavos
                      IS NOT NULL
                ),
              0
            )::BIGINT AS receita_d90_centavos,
            COALESCE(
              SUM(
                rn.valor_exposto_reversoes_centavos
              ) FILTER (
                WHERE cc.investimento_centavos
                  IS NOT NULL
              ),
              0
            )::BIGINT
              AS valor_exposto_reversoes_centavos,
            COUNT(DISTINCT rn.negocio_id)
              FILTER (
                WHERE cc.campanha_id IS NULL
                  AND (
                    (
                      NOW()
                      AT TIME ZONE
                        '${TIME_ZONE}'
                    )::date -
                    rn.data_aquisicao
                  ) >= $1::INT + 30
              )::INT
                AS pagantes_sem_custo_d30,
            COUNT(DISTINCT rn.negocio_id)
              FILTER (
                WHERE cc.campanha_id IS NULL
                  AND (
                    (
                      NOW()
                      AT TIME ZONE
                        '${TIME_ZONE}'
                    )::date -
                    rn.data_aquisicao
                  ) >= $1::INT + 60
              )::INT
                AS pagantes_sem_custo_d60,
            COUNT(DISTINCT rn.negocio_id)
              FILTER (
                WHERE cc.campanha_id IS NULL
                  AND (
                    (
                      NOW()
                      AT TIME ZONE
                        '${TIME_ZONE}'
                    )::date -
                    rn.data_aquisicao
                  ) >= $1::INT + 90
              )::INT
                AS pagantes_sem_custo_d90
          FROM receita_negocio rn
          LEFT JOIN custos_canonicos cc
            ON cc.campanha_id =
              rn.campanha_oficial_id
            AND cc.data_gasto =
              rn.data_aquisicao
          GROUP BY rn.campanha_oficial_id
        ),
        campanhas_base AS (
          SELECT campanha_id
          FROM custos_canonicos
          UNION
          SELECT campanha_oficial_id
          FROM snapshots
          WHERE campanha_oficial_id
            IS NOT NULL
        )
        SELECT
          mc.id AS campanha_id,
          mc.nome AS campanha_nome,
          mc.canal,
          mc.utm_source,
          mc.utm_medium,
          mc.utm_campaign,
          COALESCE(
            ca.investimento_d30_centavos,
            0
          )::BIGINT
            AS investimento_d30_centavos,
          COALESCE(
            ca.investimento_d60_centavos,
            0
          )::BIGINT
            AS investimento_d60_centavos,
          COALESCE(
            ca.investimento_d90_centavos,
            0
          )::BIGINT
            AS investimento_d90_centavos,
          COALESCE(
            ca.dias_maduros_d30,
            0
          )::INT AS dias_maduros_d30,
          COALESCE(
            ca.dias_maduros_d60,
            0
          )::INT AS dias_maduros_d60,
          COALESCE(
            ca.dias_maduros_d90,
            0
          )::INT AS dias_maduros_d90,
          COALESCE(
            r.negocios_pagos_d30,
            0
          )::INT AS negocios_pagos_d30,
          COALESCE(
            r.negocios_pagos_d60,
            0
          )::INT AS negocios_pagos_d60,
          COALESCE(
            r.negocios_pagos_d90,
            0
          )::INT AS negocios_pagos_d90,
          COALESCE(
            r.receita_d30_centavos,
            0
          )::BIGINT AS receita_d30_centavos,
          COALESCE(
            r.receita_d60_centavos,
            0
          )::BIGINT AS receita_d60_centavos,
          COALESCE(
            r.receita_d90_centavos,
            0
          )::BIGINT AS receita_d90_centavos,
          COALESCE(
            r.valor_exposto_reversoes_centavos,
            0
          )::BIGINT
            AS valor_exposto_reversoes_centavos,
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
          )::INT AS pagantes_sem_custo_d90
        FROM campanhas_base cb
        INNER JOIN marketing_campanhas mc
          ON mc.id = cb.campanha_id
        LEFT JOIN custos_agregados ca
          ON ca.campanha_id = mc.id
        LEFT JOIN retornos r
          ON r.campanha_id = mc.id
        WHERE mc.objetivo = 'profissional'
        ORDER BY
          COALESCE(
            ca.investimento_d30_centavos,
            0
          ) DESC,
          mc.id DESC
        `,
        [diasMonetizacao]
      ),
      db.query(
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
            'aquisicao_financeira_v1_inicio'
          LIMIT 1
        )
        SELECT
          COUNT(*)::INT AS snapshots_total,
          COUNT(*) FILTER (
            WHERE classificacao_atribuicao =
              'oficial'
          )::INT AS snapshots_oficiais,
          COUNT(*) FILTER (
            WHERE classificacao_atribuicao =
              'organico'
          )::INT AS snapshots_organicos,
          COUNT(*) FILTER (
            WHERE classificacao_atribuicao IN (
              'rastreamento_incompleto',
              'identidade_nao_oficial',
              'sem_evidencia'
            )
          )::INT
            AS snapshots_atribuicao_incompleta,
          COUNT(*) FILTER (
            WHERE (
              atribuicao_em
              AT TIME ZONE '${TIME_ZONE}'
            )::date <= m.data_corte
          )::INT
            AS snapshots_aquisicao_pre_cutover
        FROM marketing_negocio_aquisicoes mna
        CROSS JOIN marco m
        `
      ),
    ]);

  return {
    inicio_cobertura:
      marco.rows[0]?.inicio_cobertura || null,
    primeiro_dia_completo:
      marco.rows[0]?.primeiro_dia_completo || null,
    dias_maturacao_monetizacao:
      diasMonetizacao,
    campanhas: campanhas.rows,
    diagnostico:
      diagnostico.rows[0] || {},
  };
}

module.exports = {
  buscarRetornoAquisicao,
};
