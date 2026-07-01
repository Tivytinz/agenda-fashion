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
      data_pagamento = COALESCE($2, data_pagamento)
    WHERE asaas_payment_id = $3
    RETURNING *
    `,
        [
            dados.status,
            dados.data_pagamento || null,
            paymentId
        ]
    );

    return result.rows[0] || null;
}

module.exports = {
    criarPagamento,
    buscarPorPaymentId,
    atualizarStatusPagamento
};