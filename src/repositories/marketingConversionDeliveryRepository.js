const db = require("../db/db");

const MAX_TENTATIVAS = 5;

async function enfileirar({
  provedor,
  tipoEvento,
  payload
}) {
  const assinaturaId =
    Number(payload?.assinaturaId) || null;

  if (!assinaturaId) {
    throw new Error(
      "Entrega de conversão sem assinatura válida."
    );
  }

  const chaveCanonica =
    `assinatura:${assinaturaId}`;

  return db.executarTransacao(
    async (client) => {
      await client.query(
        `
        SELECT pg_advisory_xact_lock(
          hashtext($1)
        )
        `,
        [
          `marketing-conversion:${provedor}:${tipoEvento}:${assinaturaId}`
        ]
      );

      const existentes =
        await client.query(
          `
          SELECT *
          FROM marketing_conversoes_entregas
          WHERE provedor = $1
            AND tipo_evento = $2
            AND (
              chave_evento = $3
              OR payload ->> 'assinaturaId' = $4
            )
          ORDER BY
            CASE
              WHEN status = 'SENT' THEN 0
              WHEN chave_evento = $3 THEN 1
              WHEN status = 'PROCESSING' THEN 2
              WHEN status = 'PENDING' THEN 3
              WHEN status = 'FAILED' THEN 4
              ELSE 5
            END,
            id ASC
          FOR UPDATE
          `,
          [
            provedor,
            tipoEvento,
            chaveCanonica,
            String(assinaturaId)
          ]
        );

      const enviada =
        existentes.rows.find(
          (entrega) =>
            entrega.status === "SENT"
        );

      if (enviada) {
        const idsIgnorar =
          existentes.rows
            .filter(
              (entrega) =>
                entrega.id !== enviada.id &&
                entrega.status !== "SENT"
            )
            .map((entrega) => entrega.id);

        if (idsIgnorar.length) {
          await client.query(
            `
            UPDATE marketing_conversoes_entregas
            SET
              status = 'IGNORED',
              tentativas = tentativas + 1,
              proxima_tentativa_em = NULL,
              bloqueado_em = NULL,
              ultimo_erro =
                'Entrega substituída por conversão da mesma assinatura já enviada.',
              updated_at = NOW()
            WHERE id = ANY($1::bigint[])
            `,
            [idsIgnorar]
          );
        }

        return {
          novo: false,
          rearmado: false,
          entrega: enviada
        };
      }

      const existente =
        existentes.rows.find(
          (entrega) =>
            entrega.chave_evento ===
              chaveCanonica
        ) ||
        existentes.rows[0] ||
        null;

      if (existente) {
        const idsIgnorar =
          existentes.rows
            .filter(
              (entrega) =>
                entrega.id !== existente.id
            )
            .map((entrega) => entrega.id);

        if (idsIgnorar.length) {
          await client.query(
            `
            UPDATE marketing_conversoes_entregas
            SET
              status = 'IGNORED',
              tentativas = tentativas + 1,
              proxima_tentativa_em = NULL,
              bloqueado_em = NULL,
              ultimo_erro =
                'Entrega consolidada na identidade canônica da assinatura.',
              updated_at = NOW()
            WHERE id = ANY($1::bigint[])
              AND status <> 'SENT'
            `,
            [idsIgnorar]
          );
        }

        const mesmoPagamento =
          String(
            existente.payload?.pagamentoId || ""
          ) ===
          String(
            payload?.pagamentoId || ""
          );

        if (mesmoPagamento) {
          if (
            existente.chave_evento !==
              chaveCanonica
          ) {
            const canonica =
              await client.query(
                `
                UPDATE marketing_conversoes_entregas
                SET
                  chave_evento = $2,
                  updated_at = NOW()
                WHERE id = $1
                RETURNING *
                `,
                [
                  existente.id,
                  chaveCanonica
                ]
              );

            return {
              novo: false,
              rearmado: false,
              entrega:
                canonica.rows[0] ||
                existente
            };
          }

          return {
            novo: false,
            rearmado: false,
            entrega: existente
          };
        }

        const atualizada =
          await client.query(
            `
            UPDATE marketing_conversoes_entregas
            SET
              chave_evento = $2,
              payload = $3::jsonb,
              status = 'PENDING',
              tentativas = 0,
              proxima_tentativa_em = NOW(),
              bloqueado_em = NULL,
              enviado_em = NULL,
              ultimo_erro = NULL,
              updated_at = NOW()
            WHERE id = $1
              AND status <> 'SENT'
            RETURNING *
            `,
            [
              existente.id,
              chaveCanonica,
              JSON.stringify(payload || {})
            ]
          );

        return {
          novo: false,
          rearmado: true,
          entrega:
            atualizada.rows[0] ||
            existente
        };
      }

      const insercao =
        await client.query(
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
          RETURNING *
          `,
          [
            provedor,
            tipoEvento,
            chaveCanonica,
            JSON.stringify(payload || {})
          ]
        );

      return {
        novo: true,
        rearmado: false,
        entrega: insercao.rows[0]
      };
    }
  );
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

async function buscarSaudeEntregas(periodo = "30") {
  const periodos = {
    "7": "7 days",
    "30": "30 days",
    "90": "90 days",
    all: null
  };
  const seguro = Object.prototype.hasOwnProperty.call(
    periodos,
    String(periodo)
  )
    ? String(periodo)
    : "30";
  const intervalo = periodos[seguro];
  const filtroPeriodo = intervalo
    ? `AND created_at >= NOW() - INTERVAL '${intervalo}'`
    : "";

  const resultado = await db.query(
    `
    SELECT
      provedor,
      status,
      COUNT(*)::INT AS total,
      COUNT(*) FILTER (
        WHERE status = 'FAILED'
          AND proxima_tentativa_em IS NULL
      )::INT AS falhas_terminais,
      COUNT(*) FILTER (
        WHERE status = 'PROCESSING'
          AND bloqueado_em < NOW() - INTERVAL '5 minutes'
      )::INT AS processamentos_expirados,
      MIN(created_at) FILTER (
        WHERE status IN ('PENDING', 'FAILED', 'PROCESSING')
      ) AS pendencia_mais_antiga_em,
      MAX(enviado_em) FILTER (
        WHERE status = 'SENT'
      ) AS ultimo_envio_em,
      COUNT(*) FILTER (
        WHERE 1 = 1
          ${filtroPeriodo}
      )::INT AS atividade_periodo
    FROM marketing_conversoes_entregas
    WHERE tipo_evento = 'SUBSCRIPTION_ACTIVATED'
    GROUP BY provedor, status
    ORDER BY provedor, status
    `
  );

  return {
    periodo: seguro,
    linhas: resultado.rows
  };
}

async function buscarReconciliacaoConversoes(periodo = "30") {
  const periodos = {
    "7": "7 days",
    "30": "30 days",
    "90": "90 days",
    all: null
  };
  const seguro = Object.prototype.hasOwnProperty.call(
    periodos,
    String(periodo)
  )
    ? String(periodo)
    : "30";
  const intervalo = periodos[seguro];
  const filtroPeriodo = intervalo
    ? `AND ae.ocorrido_em >= NOW() - INTERVAL '${intervalo}'`
    : "";

  const resultado = await db.query(
    `
    WITH conversoes AS (
      SELECT DISTINCT ON (ae.assinatura_id)
        ae.assinatura_id,
        ae.negocio_id,
        ae.pagamento_id,
        ae.ocorrido_em
      FROM assinatura_eventos ae
      INNER JOIN pagamentos pg
        ON pg.id = ae.pagamento_id
      WHERE ae.tipo = 'CONVERSAO_INICIAL'
        AND ae.assinatura_id IS NOT NULL
        AND ae.pagamento_id IS NOT NULL
        AND pg.data_pagamento IS NOT NULL
        AND UPPER(COALESCE(pg.status, '')) IN (
          'CONFIRMED',
          'RECEIVED',
          'RECEIVED_IN_CASH'
        )
        ${filtroPeriodo}
      ORDER BY
        ae.assinatura_id,
        ae.ocorrido_em ASC,
        ae.id ASC
    ),
    provedores AS (
      SELECT 'google'::TEXT AS provedor
      UNION ALL
      SELECT 'meta'::TEXT
    ),
    base AS (
      SELECT
        c.assinatura_id,
        c.negocio_id,
        c.pagamento_id,
        c.ocorrido_em,
        p.provedor,
        e.id AS entrega_id,
        e.status,
        e.proxima_tentativa_em,
        e.bloqueado_em,
        e.ultimo_erro
      FROM conversoes c
      CROSS JOIN provedores p
      LEFT JOIN LATERAL (
        SELECT entrega.*
        FROM marketing_conversoes_entregas entrega
        WHERE entrega.provedor = p.provedor
          AND entrega.tipo_evento = 'SUBSCRIPTION_ACTIVATED'
          AND (
            entrega.chave_evento =
              'assinatura:' || c.assinatura_id::TEXT
            OR entrega.payload ->> 'assinaturaId' =
              c.assinatura_id::TEXT
          )
        ORDER BY
          CASE entrega.status
            WHEN 'SENT' THEN 0
            WHEN 'PROCESSING' THEN 1
            WHEN 'PENDING' THEN 2
            WHEN 'FAILED' THEN 3
            WHEN 'IGNORED' THEN 4
            ELSE 5
          END,
          entrega.id ASC
        LIMIT 1
      ) e ON TRUE
    )
    SELECT
      provedor,
      COUNT(*)::INT AS conversoes_pagas,
      COUNT(*) FILTER (
        WHERE status = 'SENT'
      )::INT AS enviadas,
      COUNT(*) FILTER (
        WHERE status = 'IGNORED'
          AND ultimo_erro IN (
            'sem_consentimento',
            'desabilitado'
          )
      )::INT AS inelegiveis_legitimas,
      COUNT(*) FILTER (
        WHERE status = 'IGNORED'
          AND ultimo_erro = 'renovacao'
      )::INT AS ignoradas_renovacao,
      COUNT(*) FILTER (
        WHERE entrega_id IS NULL
      )::INT AS sem_entrega,
      COUNT(*) FILTER (
        WHERE status = 'PENDING'
          OR (
            status = 'PROCESSING'
            AND bloqueado_em >=
              NOW() - INTERVAL '5 minutes'
          )
          OR (
            status = 'FAILED'
            AND proxima_tentativa_em IS NOT NULL
          )
      )::INT AS em_processamento,
      COUNT(*) FILTER (
        WHERE (
          status = 'FAILED'
          AND proxima_tentativa_em IS NULL
        )
        OR (
          status = 'PROCESSING'
          AND bloqueado_em <
            NOW() - INTERVAL '5 minutes'
        )
      )::INT AS perdas_tecnicas,
      COUNT(*) FILTER (
        WHERE status = 'IGNORED'
          AND COALESCE(ultimo_erro, '') NOT IN (
            'sem_consentimento',
            'desabilitado',
            'renovacao'
          )
      )::INT AS ignoradas_nao_classificadas
    FROM base
    GROUP BY provedor
    ORDER BY provedor
    `
  );

  return {
    periodo: seguro,
    provedores: resultado.rows
  };
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
  buscarSaudeEntregas,
  buscarReconciliacaoConversoes,
  reservarProximo,
  marcarEnviado,
  marcarIgnorado,
  marcarFalha,
  marcarFalhaTerminal,
  marcarProcessamentosEsgotados
};
