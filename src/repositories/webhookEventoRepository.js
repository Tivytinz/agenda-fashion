const db = require("../db/db");

async function registrarRecebimento({
  provedor,
  eventoId,
  tipoEvento,
  recursoId,
  payload
}) {
  const insercao = await db.query(
    `
    INSERT INTO webhook_eventos (
      provedor,
      evento_id,
      tipo_evento,
      recurso_id,
      status,
      tentativas,
      payload
    )
    VALUES (
      $1, $2, $3, $4,
      'PENDING', 0, $5::jsonb
    )
    ON CONFLICT (provedor, evento_id)
    DO NOTHING
    RETURNING *
    `,
    [
      provedor,
      eventoId,
      tipoEvento,
      recursoId || null,
      JSON.stringify(payload || {})
    ]
  );

  if (insercao.rows[0]) {
    return {
      novo: true,
      evento: insercao.rows[0]
    };
  }

  const existente = await db.query(
    `
    SELECT *
    FROM webhook_eventos
    WHERE provedor = $1
      AND evento_id = $2
    LIMIT 1
    `,
    [
      provedor,
      eventoId
    ]
  );

  return {
    novo: false,
    evento: existente.rows[0] || null
  };
}

function condicaoDisponivel() {
  return `
    (
      status = 'PENDING'
      OR (
        status = 'FAILED'
        AND tentativas < 10
        AND (
          proxima_tentativa_em IS NULL
          OR proxima_tentativa_em <= NOW()
        )
      )
      OR (
        status = 'PROCESSING'
        AND ultima_tentativa_em
          < NOW() - INTERVAL '5 minutes'
      )
    )
  `;
}

async function reservarPorId(id) {
  const resultado = await db.query(
    `
    UPDATE webhook_eventos
    SET
      status = 'PROCESSING',
      tentativas = tentativas + 1,
      erro = NULL,
      proxima_tentativa_em = NULL,
      ultima_tentativa_em = NOW(),
      processado_em = NULL
    WHERE id = $1
      AND ${condicaoDisponivel()}
    RETURNING *
    `,
    [id]
  );

  return resultado.rows[0] || null;
}

async function reservarProximo() {
  const resultado = await db.query(
    `
    WITH candidato AS (
      SELECT id
      FROM webhook_eventos
      WHERE ${condicaoDisponivel()}
      ORDER BY recebido_em ASC
      FOR UPDATE SKIP LOCKED
      LIMIT 1
    )
    UPDATE webhook_eventos evento
    SET
      status = 'PROCESSING',
      tentativas = evento.tentativas + 1,
      erro = NULL,
      proxima_tentativa_em = NULL,
      ultima_tentativa_em = NOW(),
      processado_em = NULL
    FROM candidato
    WHERE evento.id = candidato.id
    RETURNING evento.*
    `
  );

  return resultado.rows[0] || null;
}

async function marcarConcluido(id, status) {
  const resultado = await db.query(
    `
    UPDATE webhook_eventos
    SET
      status = $2,
      erro = NULL,
      proxima_tentativa_em = NULL,
      processado_em = NOW()
    WHERE id = $1
    RETURNING *
    `,
    [
      id,
      status
    ]
  );

  return resultado.rows[0] || null;
}

async function marcarFalha(id, erro) {
  const resultado = await db.query(
    `
    UPDATE webhook_eventos
    SET
      status = 'FAILED',
      erro = $2,
      proxima_tentativa_em =
        NOW() + (
          INTERVAL '1 minute' *
          LEAST(GREATEST(tentativas, 1), 10)
        ),
      processado_em = NULL
    WHERE id = $1
    RETURNING *
    `,
    [
      id,
      String(erro || "")
        .slice(0, 2000)
    ]
  );

  return resultado.rows[0] || null;
}

module.exports = {
  registrarRecebimento,
  reservarPorId,
  reservarProximo,
  marcarConcluido,
  marcarFalha
};
