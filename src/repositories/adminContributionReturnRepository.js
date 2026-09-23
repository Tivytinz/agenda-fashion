const db = require("../db/db");

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
      )::INT AS fontes_cobertas_ate_hoje,
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

module.exports = {
  buscarProntidao,
};
