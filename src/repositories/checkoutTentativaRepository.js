const db = require("../db/db");

async function iniciar({
  negocioId,
  chaveIdempotencia,
  requestHash
}) {
  const insercao = await db.query(
    `
    INSERT INTO checkout_tentativas (
      negocio_id,
      chave_idempotencia,
      request_hash,
      status
    )
    VALUES ($1, $2, $3, 'PROCESSING')
    ON CONFLICT (negocio_id, chave_idempotencia)
    DO NOTHING
    RETURNING *
    `,
    [
      negocioId,
      chaveIdempotencia,
      requestHash
    ]
  );

  if (insercao.rows[0]) {
    return {
      executar: true,
      nova: true,
      tentativa: insercao.rows[0]
    };
  }

  const existente = await db.query(
    `
    SELECT *
    FROM checkout_tentativas
    WHERE negocio_id = $1
      AND chave_idempotencia = $2
    LIMIT 1
    `,
    [
      negocioId,
      chaveIdempotencia
    ]
  );

  const tentativa = existente.rows[0] || null;

  if (!tentativa) {
    throw new Error(
      "Não foi possível recuperar a tentativa de checkout."
    );
  }

  if (tentativa.request_hash !== requestHash) {
    const erro = new Error(
      "A chave de idempotência já foi usada em outro checkout."
    );

    erro.code = "IDEMPOTENCY_KEY_REUSED";
    throw erro;
  }

  if (tentativa.status === "COMPLETED") {
    return {
      executar: false,
      nova: false,
      tentativa
    };
  }

  const retomada = await db.query(
    `
    UPDATE checkout_tentativas
    SET
      status = 'PROCESSING',
      erro = NULL,
      updated_at = NOW()
    WHERE id = $1
      AND (
        status = 'FAILED'
        OR (
          status = 'PROCESSING'
          AND updated_at < NOW() - INTERVAL '5 minutes'
        )
      )
    RETURNING *
    `,
    [tentativa.id]
  );

  if (retomada.rows[0]) {
    return {
      executar: true,
      nova: false,
      tentativa: retomada.rows[0]
    };
  }

  return {
    executar: false,
    nova: false,
    emProcessamento: true,
    tentativa
  };
}

async function vincularAssinatura(
  id,
  assinaturaId,
  executor = db
) {
  const resultado = await executor.query(
    `
    UPDATE checkout_tentativas
    SET
      assinatura_id = COALESCE(assinatura_id, $2),
      updated_at = NOW()
    WHERE id = $1
    RETURNING *
    `,
    [
      id,
      assinaturaId
    ]
  );

  return resultado.rows[0] || null;
}

async function concluir(id, resposta) {
  const resultado = await db.query(
    `
    UPDATE checkout_tentativas
    SET
      status = 'COMPLETED',
      resposta = $2::jsonb,
      erro = NULL,
      updated_at = NOW()
    WHERE id = $1
    RETURNING *
    `,
    [
      id,
      JSON.stringify(resposta)
    ]
  );

  return resultado.rows[0] || null;
}

async function marcarFalha(id, erro) {
  const resultado = await db.query(
    `
    UPDATE checkout_tentativas
    SET
      status = 'FAILED',
      erro = $2,
      updated_at = NOW()
    WHERE id = $1
    RETURNING *
    `,
    [
      id,
      String(erro || "").slice(0, 2000)
    ]
  );

  return resultado.rows[0] || null;
}

module.exports = {
  iniciar,
  vincularAssinatura,
  concluir,
  marcarFalha
};
