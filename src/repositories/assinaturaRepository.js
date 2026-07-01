const db = require("../db/db");

async function criarAssinatura(client, dados) {
    const executor = client || db;

    const result = await executor.query(
        `
    INSERT INTO assinaturas (
      negocio_id,
      plano_id,
      asaas_customer_id,
      asaas_subscription_id,
      status,
      forma_pagamento,
      periodicidade,
      valor,
      data_proxima_cobranca,
      ativo,
      observacoes
    )
    VALUES (
      $1, $2, $3, $4, $5,
      $6, $7, $8, $9, $10, $11
    )
    RETURNING *
    `,
        [
            dados.negocio_id,
            dados.plano_id,
            dados.asaas_customer_id || null,
            dados.asaas_subscription_id || null,
            dados.status || "PENDING",
            dados.forma_pagamento || null,
            dados.periodicidade || "MONTHLY",
            dados.valor,
            dados.data_proxima_cobranca || null,
            dados.ativo || false,
            dados.observacoes || null
        ]
    );

    return result.rows[0];
}

async function buscarAssinaturaAtivaPorNegocio(negocioId) {
    const result = await db.query(
        `
    SELECT *
    FROM assinaturas
    WHERE negocio_id = $1
      AND ativo = true
    ORDER BY id DESC
    LIMIT 1
    `,
        [negocioId]
    );

    return result.rows[0] || null;
}

async function buscarPorSubscriptionId(subscriptionId) {
    const result = await db.query(
        `
    SELECT *
    FROM assinaturas
    WHERE asaas_subscription_id = $1
    LIMIT 1
    `,
        [subscriptionId]
    );

    return result.rows[0] || null;
}

async function ativarAssinatura(client, assinaturaId) {
    const executor = client || db;

    const result = await executor.query(
        `
    UPDATE assinaturas
    SET
      status = 'ACTIVE',
      ativo = true,
      updated_at = NOW()
    WHERE id = $1
    RETURNING *
    `,
        [assinaturaId]
    );

    return result.rows[0] || null;
}

async function desativarAssinaturasDoNegocio(client, negocioId) {
    const executor = client || db;

    await executor.query(
        `
    UPDATE assinaturas
    SET
      ativo = false,
      updated_at = NOW()
    WHERE negocio_id = $1
    `,
        [negocioId]
    );
}

async function buscarPorId(assinaturaId) {
    const result = await db.query(
        `
        SELECT *
        FROM assinaturas
        WHERE id = $1
        LIMIT 1
        `,
        [assinaturaId]
    );

    return result.rows[0] || null;
}

module.exports = {
    criarAssinatura,
    buscarAssinaturaAtivaPorNegocio,
    buscarPorSubscriptionId,
    ativarAssinatura,
    desativarAssinaturasDoNegocio,
    buscarPorId
};