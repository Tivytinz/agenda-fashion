const db = require("../db/db");

const MAX_TENTATIVAS = 10;

async function registrarRecebimento({
  provedor,
  eventoId,
  tipoEvento,
  recursoId,
  eventoCriadoEm,
  payload
}) {
  const insercao = await db.query(
    `
    INSERT INTO webhook_eventos (
      provedor,
      evento_id,
      tipo_evento,
      recurso_id,
      evento_criado_em,
      status,
      tentativas,
      payload
    )
    VALUES (
      $1, $2, $3, $4, $5::timestamp,
      'PENDING', 0, $6::jsonb
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
      eventoCriadoEm || null,
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

function condicaoDisponivel(
  alias = ""
) {
  const prefixo = alias
    ? `${alias}.`
    : "";

  return `
    (
      (
        ${prefixo}status = 'PENDING'
        AND ${prefixo}tentativas < ${MAX_TENTATIVAS}
      )
      OR (
        ${prefixo}status = 'FAILED'
        AND ${prefixo}tentativas < ${MAX_TENTATIVAS}
        AND (
          ${prefixo}proxima_tentativa_em IS NULL
          OR ${prefixo}proxima_tentativa_em <= NOW()
        )
      )
      OR (
        ${prefixo}status = 'PROCESSING'
        AND ${prefixo}tentativas < ${MAX_TENTATIVAS}
        AND ${prefixo}ultima_tentativa_em
          < NOW() - INTERVAL '5 minutes'
      )
    )
  `;
}

function condicaoSemProcessamentoDoMesmoRecurso(
  alias
) {
  return `
    (
      ${alias}.recurso_id IS NULL
      OR NOT EXISTS (
        SELECT 1
        FROM webhook_eventos outro
        WHERE outro.provedor = ${alias}.provedor
          AND outro.recurso_id = ${alias}.recurso_id
          AND outro.id <> ${alias}.id
          AND outro.status = 'PROCESSING'
          AND outro.ultima_tentativa_em >=
            NOW() - INTERVAL '5 minutes'
      )
    )
  `;
}

function condicaoEventoMaisRecenteAplicado(
  alias
) {
  return `
    ${alias}.recurso_id IS NOT NULL
    AND ${alias}.evento_criado_em IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM webhook_eventos recente
      WHERE recente.provedor = ${alias}.provedor
        AND recente.recurso_id = ${alias}.recurso_id
        AND recente.id <> ${alias}.id
        AND recente.status = 'PROCESSED'
        AND recente.evento_criado_em IS NOT NULL
        AND (
          recente.evento_criado_em >
            ${alias}.evento_criado_em
          OR (
            recente.evento_criado_em =
              ${alias}.evento_criado_em
            AND recente.id > ${alias}.id
          )
        )
    )
  `;
}

async function marcarObsoletoSeNecessario(
  id
) {
  const resultado = await db.query(
    `
    UPDATE webhook_eventos evento
    SET
      status = 'IGNORED',
      erro = NULL,
      proxima_tentativa_em = NULL,
      processado_em = NOW()
    WHERE evento.id = $1
      AND ${condicaoDisponivel("evento")}
      AND ${condicaoEventoMaisRecenteAplicado("evento")}
    RETURNING *
    `,
    [id]
  );

  return resultado.rows[0] || null;
}

async function marcarEventosObsoletos() {
  const resultado = await db.query(
    `
    UPDATE webhook_eventos evento
    SET
      status = 'IGNORED',
      erro = NULL,
      proxima_tentativa_em = NULL,
      processado_em = NOW()
    WHERE ${condicaoDisponivel("evento")}
      AND ${condicaoEventoMaisRecenteAplicado("evento")}
    RETURNING *
    `
  );

  return resultado.rows;
}

async function reservarPorId(id) {
  const resultado = await db.query(
    `
    UPDATE webhook_eventos evento
    SET
      status = 'PROCESSING',
      tentativas = evento.tentativas + 1,
      erro = NULL,
      proxima_tentativa_em = NULL,
      ultima_tentativa_em = NOW(),
      processado_em = NULL
    WHERE evento.id = $1
      AND ${condicaoDisponivel("evento")}
      AND ${condicaoSemProcessamentoDoMesmoRecurso("evento")}
    RETURNING
      evento.*,
      evento.tentativas AS lease_tentativa
    `,
    [id]
  );

  return resultado.rows[0] || null;
}

async function reservarProximo() {
  const resultado = await db.query(
    `
    WITH candidato AS (
      SELECT evento.id
      FROM webhook_eventos evento
      WHERE ${condicaoDisponivel("evento")}
        AND ${condicaoSemProcessamentoDoMesmoRecurso("evento")}
      ORDER BY evento.recebido_em ASC
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
    RETURNING
      evento.*,
      evento.tentativas AS lease_tentativa
    `
  );

  return resultado.rows[0] || null;
}

function condicaoFinalizacaoComLease() {
  return `
    (
      status = 'PROCESSING'
      OR (
        status = 'FAILED'
        AND tentativas >= ${MAX_TENTATIVAS}
        AND proxima_tentativa_em IS NULL
        AND ultima_tentativa_em
          < NOW() - INTERVAL '5 minutes'
      )
    )
  `;
}

async function marcarConcluido(
  id,
  status,
  leaseTentativa = null
) {
  const possuiLease =
    Number.isInteger(leaseTentativa);

  const parametros = [
    id,
    status
  ];

  if (possuiLease) {
    parametros.push(leaseTentativa);
  }

  const resultado = await db.query(
    `
    UPDATE webhook_eventos
    SET
      status = $2,
      erro = NULL,
      proxima_tentativa_em = NULL,
      processado_em = NOW()
    WHERE id = $1
      ${
        possuiLease
          ? `AND tentativas = $3
      AND ${condicaoFinalizacaoComLease()}`
          : ""
      }
    RETURNING *
    `,
    parametros
  );

  return resultado.rows[0] || null;
}

async function marcarFalha(
  id,
  erro,
  leaseTentativa = null
) {
  const possuiLease =
    Number.isInteger(leaseTentativa);

  const parametros = [
    id,
    String(erro || "")
      .slice(0, 2000)
  ];

  if (possuiLease) {
    parametros.push(leaseTentativa);
  }

  const resultado = await db.query(
    `
    UPDATE webhook_eventos
    SET
      status = 'FAILED',
      erro = $2,
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
      processado_em = NULL
    WHERE id = $1
      ${
        possuiLease
          ? `AND status = 'PROCESSING'
      AND tentativas = $3`
          : ""
      }
    RETURNING *
    `,
    parametros
  );

  return resultado.rows[0] || null;
}

async function marcarProcessamentosEsgotados() {
  const resultado = await db.query(
    `
    UPDATE webhook_eventos
    SET
      status = 'FAILED',
      erro = COALESCE(
        NULLIF(erro, ''),
        'Limite máximo de tentativas atingido durante o processamento do webhook.'
      ),
      proxima_tentativa_em = NULL,
      processado_em = NULL
    WHERE status = 'PROCESSING'
      AND tentativas >= ${MAX_TENTATIVAS}
      AND ultima_tentativa_em
        < NOW() - INTERVAL '5 minutes'
    RETURNING *
    `
  );

  return resultado.rows;
}

module.exports = {
  registrarRecebimento,
  marcarObsoletoSeNecessario,
  marcarEventosObsoletos,
  reservarPorId,
  reservarProximo,
  marcarConcluido,
  marcarFalha,
  marcarProcessamentosEsgotados
};
