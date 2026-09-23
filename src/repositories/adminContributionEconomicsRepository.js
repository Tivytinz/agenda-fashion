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

module.exports = {
  buscarResumoContribuicao,
};
