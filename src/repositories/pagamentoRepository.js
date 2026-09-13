const db = require("../db/db");

async function criarPagamento(client, dados) {
    const executor = client || db;

    const result = await executor.query(
        `
    INSERT INTO pagamentos (
      assinatura_id,
      asaas_payment_id,
      valor,
      forma_pagamento,
      status,
      data_vencimento,
      data_pagamento,
      pix_copia_cola,
      pix_qrcode
    )
    VALUES (
      $1, $2, $3, $4, $5,
      $6, $7, $8, $9
    )
    ON CONFLICT (asaas_payment_id)
      WHERE asaas_payment_id IS NOT NULL
    DO UPDATE SET
      status = EXCLUDED.status,
      data_vencimento = EXCLUDED.data_vencimento,
      pix_copia_cola = COALESCE(
        EXCLUDED.pix_copia_cola,
        pagamentos.pix_copia_cola
      ),
      pix_qrcode = COALESCE(
        EXCLUDED.pix_qrcode,
        pagamentos.pix_qrcode
      ),
      updated_at = NOW()
    RETURNING *
    `,
        [
            dados.assinatura_id,
            dados.asaas_payment_id || null,
            dados.valor,
            dados.forma_pagamento || null,
            dados.status || "PENDING",
            dados.data_vencimento || null,
            dados.data_pagamento || null,
            dados.pix_copia_cola || null,
            dados.pix_qrcode || null
        ]
    );

    return result.rows[0];
}

async function buscarPorPaymentId(paymentId) {
    const result = await db.query(
        `
    SELECT *
    FROM pagamentos
    WHERE asaas_payment_id = $1
    LIMIT 1
    `,
        [paymentId]
    );

    return result.rows[0] || null;
}

async function atualizarStatusPagamento(client, paymentId, dados) {
    const executor = client || db;

    const result = await executor.query(
        `
    UPDATE pagamentos
    SET
      status = $1,
      data_pagamento = COALESCE($2, data_pagamento),
      asaas_ultimo_evento_em = CASE
        WHEN $3::timestamp IS NOT NULL
          THEN $3::timestamp
        ELSE asaas_ultimo_evento_em
      END,
      asaas_ultimo_evento_id = CASE
        WHEN $3::timestamp IS NOT NULL
          THEN $4
        ELSE asaas_ultimo_evento_id
      END,
      updated_at = NOW()
    WHERE asaas_payment_id = $5
      AND (
        $3::timestamp IS NULL
        OR asaas_ultimo_evento_em IS NULL
        OR $3::timestamp >=
          asaas_ultimo_evento_em
      )
    RETURNING *
    `,
        [
            dados.status,
            dados.data_pagamento || null,
            dados.evento_criado_em || null,
            dados.evento_id || null,
            paymentId
        ]
    );

    return result.rows[0] || null;
}

async function listarPorAssinatura(assinaturaId, limite = 12) {
    const result = await db.query(
        `
        SELECT
            id,
            asaas_payment_id,
            valor,
            forma_pagamento,
            status,
            data_vencimento,
            data_pagamento,
            created_at
        FROM pagamentos
        WHERE assinatura_id = $1
        ORDER BY id DESC
        LIMIT $2
        `,
        [assinaturaId, limite]
    );

    return result.rows;
}

module.exports = {
    criarPagamento,
    buscarPorPaymentId,
    atualizarStatusPagamento,
    listarPorAssinatura
};
