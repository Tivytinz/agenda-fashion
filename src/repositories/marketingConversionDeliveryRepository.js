const db = require("../db/db");

const MAX_TENTATIVAS = 5;

async function enfileirar({
  provedor,
  tipoEvento,
  chaveEvento,
  payload
}) {
  const insercao = await db.query(
    `
    INSERT INTO marketing_conversoes_entregas (
      provedor,
      tipo_evento,
      chave_evento,
      payload,
      status,
      tentativas,
      proxima_tentativa_em
    )
    VALUES (
      $1, $2, $3, $4::jsonb,
      'PENDING', 0, NOW()
    )
    ON CONFLICT (
      provedor,
      tipo_evento,
      chave_evento
    )
    DO NOTHING
    RETURNING *
    `,
    [
      provedor,
      tipoEvento,
      chaveEvento,
      JSON.stringify(payload || {})
    ]
  );

  if (insercao.rows[0]) {
    return {
      novo: true,
      entrega: insercao.rows[0]
    };
  }

  const existente = await db.query(
    `
    SELECT *
    FROM marketing_conversoes_entregas
    WHERE provedor = $1
      AND tipo_evento = $2
      AND chave_evento = $3
    LIMIT 1
    `,
    [
      provedor,
      tipoEvento,
      chaveEvento
    ]
  );

  return {
    novo: false,
    entrega: existente.rows[0] || null
  };
}

function condicaoDisponivel() {
  return `
    (
      (
        status = 'PENDING'
        AND tentativas < ${MAX_TENTATIVAS}
      )
      OR (
        status = 'FAILED'
        AND tentativas < ${MAX_TENTATIVAS}
        AND proxima_tentativa_em IS NOT NULL
        AND proxima_tentativa_em <= NOW()
      )
      OR (
        status = 'PROCESSING'
        AND tentativas < ${MAX_TENTATIVAS}
        AND bloqueado_em
          < NOW() - INTERVAL '5 minutes'
      )
    )
  `;
}

async function reservarProximo() {
  const resultado = await db.query(
    `
    WITH candidato AS (
      SELECT id
      FROM marketing_conversoes_entregas
      WHERE ${condicaoDisponivel()}
      ORDER BY created_at ASC
      FOR UPDATE SKIP LOCKED
      LIMIT 1
    )
    UPDATE marketing_conversoes_entregas entrega
    SET
      status = 'PROCESSING',
      tentativas = entrega.tentativas + 1,
      bloqueado_em = NOW(),
      ultimo_erro = NULL,
      proxima_tentativa_em = NULL,
      updated_at = NOW()
    FROM candidato
    WHERE entrega.id = candidato.id
    RETURNING
      entrega.*,
      entrega.tentativas AS lease_tentativa
    `
  );

  return resultado.rows[0] || null;
}

function condicaoLeaseTerminal() {
  return `
    (
      status = 'PROCESSING'
      OR (
        status = 'FAILED'
        AND tentativas >= ${MAX_TENTATIVAS}
        AND proxima_tentativa_em IS NULL
        AND bloqueado_em
          < NOW() - INTERVAL '5 minutes'
      )
    )
  `;
}

async function marcarEnviado(
  id,
  leaseTentativa
) {
  const resultado = await db.query(
    `
    UPDATE marketing_conversoes_entregas
    SET
      status = 'SENT',
      ultimo_erro = NULL,
      proxima_tentativa_em = NULL,
      enviado_em = NOW(),
      updated_at = NOW()
    WHERE id = $1
      AND tentativas = $2
      AND ${condicaoLeaseTerminal()}
    RETURNING *
    `,
    [
      id,
      leaseTentativa
    ]
  );

  return resultado.rows[0] || null;
}

async function marcarIgnorado(
  id,
  leaseTentativa,
  motivo
) {
  const resultado = await db.query(
    `
    UPDATE marketing_conversoes_entregas
    SET
      status = 'IGNORED',
      ultimo_erro = $3,
      proxima_tentativa_em = NULL,
      updated_at = NOW()
    WHERE id = $1
      AND tentativas = $2
      AND ${condicaoLeaseTerminal()}
    RETURNING *
    `,
    [
      id,
      leaseTentativa,
      String(motivo || "Ignorado")
        .slice(0, 1000)
    ]
  );

  return resultado.rows[0] || null;
}

async function marcarFalha(
  id,
  leaseTentativa,
  erro
) {
  const resultado = await db.query(
    `
    UPDATE marketing_conversoes_entregas
    SET
      status = 'FAILED',
      ultimo_erro = $3,
      proxima_tentativa_em =
        CASE
          WHEN tentativas < ${MAX_TENTATIVAS}
            THEN NOW() + (
              INTERVAL '1 minute' *
              LEAST(
                GREATEST(tentativas, 1),
                ${MAX_TENTATIVAS}
              )
            )
          ELSE NULL
        END,
      updated_at = NOW()
    WHERE id = $1
      AND tentativas = $2
      AND status = 'PROCESSING'
    RETURNING *
    `,
    [
      id,
      leaseTentativa,
      String(erro || "Falha desconhecida")
        .slice(0, 2000)
    ]
  );

  return resultado.rows[0] || null;
}

async function marcarFalhaTerminal(
  id,
  leaseTentativa,
  erro
) {
  const resultado = await db.query(
    `
    UPDATE marketing_conversoes_entregas
    SET
      status = 'FAILED',
      ultimo_erro = $3,
      proxima_tentativa_em = NULL,
      updated_at = NOW()
    WHERE id = $1
      AND tentativas = $2
      AND status = 'PROCESSING'
    RETURNING *
    `,
    [
      id,
      leaseTentativa,
      String(erro || "Falha terminal")
        .slice(0, 2000)
    ]
  );

  return resultado.rows[0] || null;
}

async function marcarProcessamentosEsgotados() {
  const resultado = await db.query(
    `
    UPDATE marketing_conversoes_entregas
    SET
      status = 'FAILED',
      ultimo_erro = COALESCE(
        NULLIF(ultimo_erro, ''),
        'Limite máximo de tentativas atingido durante a entrega da conversão.'
      ),
      proxima_tentativa_em = NULL,
      updated_at = NOW()
    WHERE status = 'PROCESSING'
      AND tentativas >= ${MAX_TENTATIVAS}
      AND bloqueado_em
        < NOW() - INTERVAL '5 minutes'
    RETURNING *
    `
  );

  return resultado.rows;
}

module.exports = {
  enfileirar,
  reservarProximo,
  marcarEnviado,
  marcarIgnorado,
  marcarFalha,
  marcarFalhaTerminal,
  marcarProcessamentosEsgotados
};
