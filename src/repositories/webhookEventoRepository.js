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
      $1, $2, $3, $4,
      $5::timestamp,
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

function prefixo(alias) {
  return alias
    ? `${alias}.`
    : "";
}

function condicaoDisponivel(alias = "") {
  const coluna = prefixo(alias);

  return `
    (
      (
        ${coluna}status = 'PENDING'
        AND ${coluna}tentativas < ${MAX_TENTATIVAS}
      )
      OR (
        ${coluna}status = 'FAILED'
        AND ${coluna}tentativas < ${MAX_TENTATIVAS}
        AND (
          ${coluna}proxima_tentativa_em IS NULL
          OR ${coluna}proxima_tentativa_em <= NOW()
        )
      )
      OR (
        ${coluna}status = 'PROCESSING'
        AND ${coluna}tentativas < ${MAX_TENTATIVAS}
        AND ${coluna}ultima_tentativa_em
          < NOW() - INTERVAL '5 minutes'
      )
    )
  `;
}

function semOutroProcessamentoDoRecurso(
  alias
) {
  return `
    (
      ${alias}.recurso_id IS NULL
      OR NOT EXISTS (
        SELECT 1
        FROM webhook_eventos em_processamento
        WHERE em_processamento.provedor =
          ${alias}.provedor
          AND em_processamento.recurso_id =
            ${alias}.recurso_id
          AND em_processamento.id <>
            ${alias}.id
          AND em_processamento.status =
            'PROCESSING'
      )
    )
  `;
}

async function travarRecurso(
  client,
  {
    id,
    provedor,
    recurso_id: recursoId
  }
) {
  await client.query(
    `
    SELECT pg_advisory_xact_lock(
      hashtext(
        'agenda-fashion:webhook:' ||
        $1
      ),
      hashtext(
        COALESCE(
          $2,
          'evento:' || $3::text
        )
      )
    )
    `,
    [
      provedor,
      recursoId || null,
      id
    ]
  );
}

async function reservarPorId(id) {
  return db.executarTransacao(
    async (client) => {
      const alvoResultado =
        await client.query(
          `
          SELECT
            id,
            provedor,
            recurso_id
          FROM webhook_eventos
          WHERE id = $1
          LIMIT 1
          `,
          [id]
        );

      const alvo =
        alvoResultado.rows[0];

      if (!alvo) {
        return null;
      }

      /*
       * A trava precisa ser adquirida em uma instrução anterior ao UPDATE.
       * Em READ COMMITTED, isso força o UPDATE seguinte a obter um snapshot
       * novo depois que outra reserva concorrente do mesmo recurso terminar.
       * Manter a trava dentro do mesmo statement não é suficiente: uma
       * instrução que aguardou a advisory lock pode continuar enxergando o
       * snapshot antigo e reservar dois eventos do mesmo recurso.
       */
      await travarRecurso(
        client,
        alvo
      );

      const resultado =
        await client.query(
          `
          UPDATE webhook_eventos evento
          SET
            status = 'PROCESSING',
            tentativas =
              evento.tentativas + 1,
            erro = NULL,
            proxima_tentativa_em = NULL,
            ultima_tentativa_em = NOW(),
            processado_em = NULL
          WHERE evento.id = $1
            AND ${condicaoDisponivel(
              "evento"
            )}
            AND ${semOutroProcessamentoDoRecurso(
              "evento"
            )}
          RETURNING
            evento.*,
            evento.tentativas
              AS lease_tentativa
          `,
          [id]
        );

      return (
        resultado.rows[0] || null
      );
    }
  );
}

async function reservarProximo() {
  return db.executarTransacao(
    async (client) => {
      const candidatoResultado =
        await client.query(
          `
          SELECT
            evento.id,
            evento.provedor,
            evento.recurso_id
          FROM webhook_eventos evento
          WHERE ${condicaoDisponivel(
            "evento"
          )}
            AND ${semOutroProcessamentoDoRecurso(
              "evento"
            )}
          ORDER BY
            evento.recebido_em ASC
          FOR UPDATE SKIP LOCKED
          LIMIT 1
          `
        );

      const candidato =
        candidatoResultado.rows[0];

      if (!candidato) {
        return null;
      }

      await travarRecurso(
        client,
        candidato
      );

      const resultado =
        await client.query(
          `
          UPDATE webhook_eventos evento
          SET
            status = 'PROCESSING',
            tentativas =
              evento.tentativas + 1,
            erro = NULL,
            proxima_tentativa_em = NULL,
            ultima_tentativa_em = NOW(),
            processado_em = NULL
          WHERE evento.id = $1
            AND ${condicaoDisponivel(
              "evento"
            )}
            AND ${semOutroProcessamentoDoRecurso(
              "evento"
            )}
          RETURNING
            evento.*,
            evento.tentativas
              AS lease_tentativa
          `,
          [candidato.id]
        );

      return (
        resultado.rows[0] || null
      );
    }
  );
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
  reservarPorId,
  reservarProximo,
  marcarConcluido,
  marcarFalha,
  marcarProcessamentosEsgotados
};
