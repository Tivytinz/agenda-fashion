const db = require("../db/db");

function executorConsulta(client) {
  return client || db;
}

async function ehPrimeiroPagamentoAssinatura({
  assinaturaId,
  pagamentoId,
  client = null
}) {
  const resultado = await executorConsulta(client)
    .query(
      `
      SELECT EXISTS (
        SELECT 1
        FROM pagamentos atual
        WHERE atual.assinatura_id = $1
          AND atual.asaas_payment_id = $2
          AND atual.data_pagamento IS NOT NULL
          AND UPPER(atual.status) IN (
            'CONFIRMED',
            'RECEIVED',
            'RECEIVED_IN_CASH'
          )
          AND NOT EXISTS (
            SELECT 1
            FROM pagamentos anterior
            WHERE anterior.assinatura_id =
              atual.assinatura_id
              AND anterior.data_pagamento
                IS NOT NULL
              AND UPPER(anterior.status) IN (
                'CONFIRMED',
                'RECEIVED',
                'RECEIVED_IN_CASH'
              )
              AND (
                anterior.data_pagamento <
                  atual.data_pagamento
                OR (
                  anterior.data_pagamento =
                    atual.data_pagamento
                  AND anterior.id < atual.id
                )
              )
          )
      ) AS primeiro_pagamento
      `,
      [
        assinaturaId,
        pagamentoId
      ]
    );

  return resultado.rows[0]
    ?.primeiro_pagamento === true;
}

async function buscarPagamentoConfirmado({
  assinaturaId,
  pagamentoId,
  client = null
}) {
  const resultado = await executorConsulta(client)
    .query(
      `
      SELECT
        p.id,
        p.assinatura_id,
        p.asaas_payment_id,
        p.valor,
        p.data_pagamento,
        p.confirmado_em
      FROM pagamentos p
      WHERE p.assinatura_id = $1
        AND p.asaas_payment_id = $2
        AND p.data_pagamento IS NOT NULL
        AND UPPER(p.status) IN (
          'CONFIRMED',
          'RECEIVED',
          'RECEIVED_IN_CASH'
        )
      LIMIT 1
      `,
      [
        assinaturaId,
        pagamentoId
      ]
    );

  return resultado.rows[0] || null;
}

async function buscarConversaoInicialConfirmada({
  assinaturaId,
  pagamentoId,
  client = null
}) {
  const resultado = await executorConsulta(client)
    .query(
      `
      SELECT
        ae.id AS assinatura_evento_id,
        ae.negocio_id,
        ae.assinatura_id,
        ae.pagamento_id AS pagamento_interno_id,
        ae.ocorrido_em,
        dono.usuario_id AS usuario_aquisicao_id,
        p.asaas_payment_id,
        p.valor,
        p.data_pagamento,
        p.confirmado_em
      FROM assinatura_eventos ae
      INNER JOIN pagamentos p
        ON p.id = ae.pagamento_id
      LEFT JOIN LATERAL (
        SELECT un.usuario_id
        FROM usuarios_negocios un
        WHERE un.negocio_id = ae.negocio_id
          AND un.papel = 'dono'
        ORDER BY
          un.created_at ASC,
          un.id ASC
        LIMIT 1
      ) dono ON TRUE
      WHERE ae.tipo = 'CONVERSAO_INICIAL'
        AND ae.assinatura_id = $1
        AND p.asaas_payment_id = $2
        AND p.data_pagamento IS NOT NULL
        AND UPPER(p.status) IN (
          'CONFIRMED',
          'RECEIVED',
          'RECEIVED_IN_CASH'
        )
        AND NOT EXISTS (
          SELECT 1
          FROM assinatura_eventos anterior
          INNER JOIN pagamentos pagamento_anterior
            ON pagamento_anterior.id =
              anterior.pagamento_id
          WHERE anterior.negocio_id =
              ae.negocio_id
            AND anterior.tipo =
              'CONVERSAO_INICIAL'
            AND pagamento_anterior.data_pagamento
              IS NOT NULL
            AND (
              pagamento_anterior.data_pagamento <
                p.data_pagamento
              OR (
                pagamento_anterior.data_pagamento =
                  p.data_pagamento
                AND anterior.id < ae.id
              )
            )
        )
      ORDER BY ae.id ASC
      LIMIT 1
      `,
      [
        assinaturaId,
        pagamentoId
      ]
    );

  return resultado.rows[0] || null;
}

module.exports = {
  ehPrimeiroPagamentoAssinatura,
  buscarPagamentoConfirmado,
  buscarConversaoInicialConfirmada
};
