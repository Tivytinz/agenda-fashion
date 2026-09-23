const db = require("../db/db");

async function buscarFonteAtiva(
  codigo,
  executor = db
) {
  const resultado = await executor.query(
    `
    SELECT
      id,
      codigo,
      nome,
      categoria,
      ativa,
      obrigatoria_para_margem
    FROM contribuicao_fontes
    WHERE codigo = $1
      AND ativa = TRUE
    LIMIT 1
    `,
    [codigo]
  );

  return resultado.rows[0] || null;
}

async function persistirCusto({
  fonteCodigo,
  negocioId,
  chaveOrigem,
  tipo,
  valor,
  ocorridoEm,
  custoReferenciadoId = null,
  detalhes = {},
}) {
  const fonte = await buscarFonteAtiva(
    fonteCodigo
  );

  if (!fonte) {
    return {
      fonteAusente: true,
      registro: null,
      criado: false,
    };
  }

  const inserido = await db.query(
    `
    INSERT INTO contribuicao_custos (
      fonte_id,
      negocio_id,
      chave_origem,
      tipo,
      valor,
      ocorrido_em,
      custo_referenciado_id,
      detalhes
    )
    VALUES (
      $1,
      $2,
      $3,
      $4,
      $5,
      $6,
      $7,
      $8::jsonb
    )
    ON CONFLICT (
      fonte_id,
      chave_origem
    )
    DO NOTHING
    RETURNING
      id,
      fonte_id,
      negocio_id,
      chave_origem,
      tipo,
      valor,
      ocorrido_em,
      custo_referenciado_id,
      detalhes
    `,
    [
      fonte.id,
      negocioId,
      chaveOrigem,
      tipo,
      valor,
      ocorridoEm,
      custoReferenciadoId,
      JSON.stringify(detalhes || {}),
    ]
  );

  if (inserido.rows[0]) {
    return {
      fonteAusente: false,
      registro: inserido.rows[0],
      criado: true,
    };
  }

  const existente = await db.query(
    `
    SELECT
      id,
      fonte_id,
      negocio_id,
      chave_origem,
      tipo,
      valor,
      ocorrido_em,
      custo_referenciado_id,
      detalhes
    FROM contribuicao_custos
    WHERE fonte_id = $1
      AND chave_origem = $2
    LIMIT 1
    `,
    [
      fonte.id,
      chaveOrigem,
    ]
  );

  return {
    fonteAusente: false,
    registro:
      existente.rows[0] || null,
    criado: false,
  };
}

async function persistirCobertura({
  fonteCodigo,
  inicioCobertura,
  cobertoAte,
  status,
}) {
  const fonte = await buscarFonteAtiva(
    fonteCodigo
  );

  if (!fonte) {
    return {
      fonteAusente: true,
      registro: null,
    };
  }

  const resultado = await db.query(
    `
    INSERT INTO contribuicao_cobertura (
      fonte_id,
      inicio_cobertura,
      coberto_ate,
      status,
      sincronizado_em,
      updated_at
    )
    VALUES (
      $1,
      $2,
      $3,
      $4,
      NOW(),
      NOW()
    )
    ON CONFLICT (fonte_id)
    DO UPDATE SET
      coberto_ate =
        EXCLUDED.coberto_ate,
      status =
        EXCLUDED.status,
      sincronizado_em = NOW(),
      updated_at = NOW()
    WHERE
      contribuicao_cobertura
        .inicio_cobertura =
          EXCLUDED.inicio_cobertura
      AND (
        contribuicao_cobertura
          .coberto_ate IS NULL
        OR EXCLUDED.coberto_ate IS NULL
        OR EXCLUDED.coberto_ate >=
          contribuicao_cobertura
            .coberto_ate
      )
    RETURNING
      fonte_id,
      inicio_cobertura,
      coberto_ate,
      status,
      sincronizado_em
    `,
    [
      fonte.id,
      inicioCobertura,
      cobertoAte,
      status,
    ]
  );

  return {
    fonteAusente: false,
    registro:
      resultado.rows[0] || null,
  };
}

module.exports = {
  buscarFonteAtiva,
  persistirCusto,
  persistirCobertura,
};
