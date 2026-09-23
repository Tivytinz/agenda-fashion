const db = require("../db/db");

const STATUS_ELEGIVEIS = [
  "CONFIRMED",
  "RECEIVED",
  "RECEIVED_IN_CASH",
  "REFUNDED",
  "PARTIALLY_REFUNDED",
  "REFUND_IN_PROGRESS",
  "REFUND_DENIED",
  "RECEIVED_IN_CASH_UNDONE",
  "CHARGEBACK_REQUESTED",
  "CHARGEBACK_DISPUTE",
  "AWAITING_CHARGEBACK_REVERSAL",
];

function limiteSeguro(valor) {
  const convertido = Number(valor);

  if (
    !Number.isInteger(convertido) ||
    convertido < 1 ||
    convertido > 200
  ) {
    return 50;
  }

  return convertido;
}

async function listarPendentes(limite = 50) {
  const resultado = await db.query(
    `
    WITH marco AS (
      SELECT ocorrido_em
      FROM financeiro_marcos
      WHERE chave = 'economia_liquida_v1_inicio'
      LIMIT 1
    )
    SELECT
      pg.id AS pagamento_id,
      pg.asaas_payment_id,
      pg.status,
      pg.valor,
      pg.asaas_ultimo_evento_em,
      pg.asaas_ultimo_evento_id
    FROM pagamentos pg
    CROSS JOIN marco m
    LEFT JOIN pagamento_economia pe
      ON pe.pagamento_id = pg.id
    WHERE pg.asaas_payment_id IS NOT NULL
      AND UPPER(COALESCE(pg.status, '')) =
        ANY($2::text[])
      AND COALESCE(
        pg.asaas_ultimo_evento_em,
        pg.created_at::timestamp
      ) >= m.ocorrido_em::timestamp
      AND (
        pe.pagamento_id IS NULL
        OR pg.asaas_ultimo_evento_em
          IS DISTINCT FROM
          pe.ultimo_evento_asaas_em
        OR pg.asaas_ultimo_evento_id
          IS DISTINCT FROM
          pe.ultimo_evento_asaas_id
        OR (
          pe.proxima_reconciliacao_em
            IS NOT NULL
          AND pe.proxima_reconciliacao_em
            <= NOW()
        )
      )
    ORDER BY
      COALESCE(
        pg.asaas_ultimo_evento_em,
        pg.created_at::timestamp
      ) ASC,
      pg.id ASC
    LIMIT $1
    `,
    [
      limiteSeguro(limite),
      STATUS_ELEGIVEIS,
    ]
  );

  return resultado.rows;
}

async function persistirReconciliacao({
  pagamentoId,
  eventoEsperadoEm = null,
  eventoEsperadoId = null,
  economia,
  estornos = [],
}) {
  return db.executarTransacao(
    async (client) => {
      const atual = await client.query(
        `
        SELECT
          id,
          asaas_payment_id,
          asaas_ultimo_evento_em,
          asaas_ultimo_evento_id,
          (
            asaas_ultimo_evento_em
              IS NOT DISTINCT FROM
              $2::timestamp
            AND asaas_ultimo_evento_id
              IS NOT DISTINCT FROM
              $3::varchar
          ) AS fence_valido
        FROM pagamentos
        WHERE id = $1
        LIMIT 1
        FOR UPDATE
        `,
        [
          pagamentoId,
          eventoEsperadoEm,
          eventoEsperadoId,
        ]
      );

      const pagamento =
        atual.rows[0] || null;

      if (!pagamento) {
        return null;
      }

      if (pagamento.fence_valido !== true) {
        return {
          obsoleto: true,
          pagamento_id: pagamento.id,
        };
      }

      const reconciliado =
        await client.query(
          `
          INSERT INTO pagamento_economia (
            pagamento_id,
            asaas_payment_id,
            valor_bruto,
            valor_liquido_gateway,
            data_credito,
            status_pagamento_snapshot,
            status_reconciliacao,
            ultimo_evento_asaas_em,
            ultimo_evento_asaas_id,
            proxima_reconciliacao_em,
            sincronizado_em,
            updated_at
          )
          VALUES (
            $1, $2, $3, $4, $5,
            $6, $7, $8, $9, $10,
            NOW(), NOW()
          )
          ON CONFLICT (pagamento_id)
          DO UPDATE SET
            asaas_payment_id =
              EXCLUDED.asaas_payment_id,
            valor_bruto =
              EXCLUDED.valor_bruto,
            valor_liquido_gateway =
              EXCLUDED.valor_liquido_gateway,
            data_credito =
              EXCLUDED.data_credito,
            status_pagamento_snapshot =
              EXCLUDED.status_pagamento_snapshot,
            status_reconciliacao =
              EXCLUDED.status_reconciliacao,
            ultimo_evento_asaas_em =
              EXCLUDED.ultimo_evento_asaas_em,
            ultimo_evento_asaas_id =
              EXCLUDED.ultimo_evento_asaas_id,
            proxima_reconciliacao_em =
              EXCLUDED.proxima_reconciliacao_em,
            sincronizado_em = NOW(),
            updated_at = NOW()
          RETURNING *
          `,
          [
            pagamento.id,
            pagamento.asaas_payment_id,
            economia.valorBruto,
            economia.valorLiquidoGateway,
            economia.dataCredito,
            economia.statusPagamento,
            economia.statusReconciliacao,
            pagamento.asaas_ultimo_evento_em,
            pagamento.asaas_ultimo_evento_id,
            economia.proximaReconciliacaoEm,
          ]
        );

      for (const estorno of estornos) {
        await client.query(
          `
          INSERT INTO pagamento_estornos (
            pagamento_id,
            chave_provedor,
            valor,
            status_provedor,
            ocorrido_em
          )
          VALUES (
            $1, $2, $3, $4, $5
          )
          ON CONFLICT (
            pagamento_id,
            chave_provedor
          )
          DO UPDATE SET
            valor = EXCLUDED.valor,
            status_provedor =
              EXCLUDED.status_provedor,
            ocorrido_em =
              COALESCE(
                EXCLUDED.ocorrido_em,
                pagamento_estornos.ocorrido_em
              ),
            updated_at = NOW()
          `,
          [
            pagamento.id,
            estorno.chaveProvedor,
            estorno.valor,
            estorno.status,
            estorno.ocorridoEm,
          ]
        );
      }

      return reconciliado.rows[0] || null;
    }
  );
}

async function contarPendentes() {
  const resultado = await db.query(
    `
    WITH marco AS (
      SELECT ocorrido_em
      FROM financeiro_marcos
      WHERE chave = 'economia_liquida_v1_inicio'
      LIMIT 1
    )
    SELECT COUNT(*)::INT AS total
    FROM pagamentos pg
    CROSS JOIN marco m
    LEFT JOIN pagamento_economia pe
      ON pe.pagamento_id = pg.id
    WHERE pg.asaas_payment_id IS NOT NULL
      AND UPPER(COALESCE(pg.status, '')) =
        ANY($1::text[])
      AND COALESCE(
        pg.asaas_ultimo_evento_em,
        pg.created_at::timestamp
      ) >= m.ocorrido_em::timestamp
      AND (
        pe.pagamento_id IS NULL
        OR pe.status_reconciliacao
          <> 'COMPLETO'
      )
    `,
    [STATUS_ELEGIVEIS]
  );

  return Number(
    resultado.rows[0]?.total || 0
  );
}

module.exports = {
  listarPendentes,
  persistirReconciliacao,
  contarPendentes,
};
