const db = require("../db/db");

async function buscarPorSubscriptionParaAtualizar(
  client,
  subscriptionId
) {
  const resultado = await client.query(
    `
      SELECT *
      FROM assinaturas
      WHERE asaas_subscription_id = $1
      LIMIT 1
      FOR UPDATE
    `,
    [subscriptionId]
  );

  return resultado.rows[0] || null;
}

async function buscarPorReferenciaParaAtualizar(
  client,
  assinaturaId,
  subscriptionId
) {
  const resultado = await client.query(
    `
      SELECT *
      FROM assinaturas
      WHERE id = $1
        AND (
          asaas_subscription_id IS NULL
          OR asaas_subscription_id = $2
        )
      LIMIT 1
      FOR UPDATE
    `,
    [assinaturaId, subscriptionId]
  );

  return resultado.rows[0] || null;
}

async function atualizarPorWebhook(
  client,
  {
    assinaturaId,
    subscriptionId,
    customerId,
    status,
    formaPagamento,
    periodicidade,
    valor,
    proximaCobranca,
    ativo,
    eventoCriadoEm,
    eventoId,
  }
) {
  const resultado = await client.query(
    `
      UPDATE assinaturas
      SET
        asaas_subscription_id = $1,
        asaas_customer_id = COALESCE($2, asaas_customer_id),
        status = $3,
        forma_pagamento = COALESCE($4, forma_pagamento),
        periodicidade = COALESCE($5, periodicidade),
        valor = COALESCE($6, valor),
        data_proxima_cobranca = COALESCE($7, data_proxima_cobranca),
        ativo = $8,
        asaas_ultimo_evento_em = CASE
          WHEN $9::timestamp IS NOT NULL THEN $9::timestamp
          ELSE asaas_ultimo_evento_em
        END,
        asaas_ultimo_evento_id = CASE
          WHEN $9::timestamp IS NOT NULL THEN $10
          ELSE asaas_ultimo_evento_id
        END,
        updated_at = NOW()
      WHERE id = $11
        AND (
          $9::timestamp IS NULL
          OR asaas_ultimo_evento_em IS NULL
          OR $9::timestamp >= asaas_ultimo_evento_em
        )
      RETURNING *
    `,
    [
      subscriptionId,
      customerId,
      status,
      formaPagamento,
      periodicidade,
      valor,
      proximaCobranca,
      ativo,
      eventoCriadoEm,
      eventoId,
      assinaturaId,
    ]
  );

  return resultado.rows[0] || null;
}

async function buscarPlanoGratis(client = db) {
  const resultado = await client.query(
    `
      SELECT id
      FROM planos
      WHERE slug = 'inicial'
        AND ativo = TRUE
      LIMIT 1
    `
  );

  return resultado.rows[0] || null;
}

async function atualizarPlanoNegocioSeSemOutraAssinatura(
  client,
  {
    negocioId,
    planoAtualId,
    assinaturaIgnoradaId,
    novoPlanoId,
  }
) {
  await client.query(
    `
      UPDATE negocios n
      SET plano_id = $1
      WHERE n.id = $2
        AND n.plano_id = $3
        AND NOT EXISTS (
          SELECT 1
          FROM assinaturas atual
          WHERE atual.negocio_id = n.id
            AND atual.id <> $4
            AND atual.ativo = TRUE
        )
    `,
    [
      novoPlanoId,
      negocioId,
      planoAtualId,
      assinaturaIgnoradaId,
    ]
  );
}

async function buscarPorPagamentoParaAtualizar(
  client,
  paymentId
) {
  const resultado = await client.query(
    `
      SELECT
        p.id AS pagamento_id,
        p.data_pagamento,
        p.data_vencimento,
        a.*
      FROM pagamentos p
      INNER JOIN assinaturas a
        ON a.id = p.assinatura_id
      WHERE p.asaas_payment_id = $1
      LIMIT 1
      FOR UPDATE OF p, a
    `,
    [paymentId]
  );

  return resultado.rows[0] || null;
}

async function suspenderAssinatura(
  client,
  { assinaturaId, status, observacao }
) {
  const resultado = await client.query(
    `
      UPDATE assinaturas
      SET
        status = $1,
        ativo = FALSE,
        observacoes = CONCAT_WS(
          E'\n',
          NULLIF(observacoes, ''),
          $2::text
        ),
        updated_at = NOW()
      WHERE id = $3
      RETURNING *
    `,
    [status, observacao, assinaturaId]
  );

  return resultado.rows[0] || null;
}

async function encerrarAssinaturaPendente(
  client,
  {
    assinaturaId,
    status,
    observacao,
  }
) {
  const resultado = await client.query(
    `
      UPDATE assinaturas
      SET
        status = $1,
        ativo = FALSE,
        observacoes = CONCAT_WS(
          E'\\n',
          NULLIF(observacoes, ''),
          $2::text
        ),
        updated_at = NOW()
      WHERE id = $3
        AND ativo = FALSE
        AND UPPER(status) IN (
          'PENDING',
          'PENDING_PAYMENT'
        )
      RETURNING *
    `,
    [status, observacao, assinaturaId]
  );

  return resultado.rows[0] || null;
}

async function confirmarPagamento(
  client,
  {
    pagamentoId,
    status,
    eventoCriadoEm,
    eventoId,
    invoiceUrl,
  }
) {
  const resultado = await client.query(
    `
      UPDATE pagamentos
      SET
        status = $1,
        data_pagamento = COALESCE(data_pagamento, NOW()),
        invoice_url = COALESCE($5, invoice_url),
        asaas_ultimo_evento_em = CASE
          WHEN $3::timestamp IS NOT NULL THEN $3::timestamp
          ELSE asaas_ultimo_evento_em
        END,
        asaas_ultimo_evento_id = CASE
          WHEN $3::timestamp IS NOT NULL THEN $4
          ELSE asaas_ultimo_evento_id
        END
      WHERE id = $2
        AND (
          $3::timestamp IS NULL
          OR asaas_ultimo_evento_em IS NULL
          OR $3::timestamp >= asaas_ultimo_evento_em
        )
      RETURNING id
    `,
    [
      status,
      pagamentoId,
      eventoCriadoEm,
      eventoId,
      invoiceUrl || null,
    ]
  );

  return resultado.rows[0] || null;
}

async function buscarAssinaturaVigenteMaisNova(
  client,
  negocioId,
  assinaturaId
) {
  const resultado = await client.query(
    `
      SELECT atual.id AS assinatura_vigente_id
      FROM negocios n
      LEFT JOIN LATERAL (
        SELECT a.id
        FROM assinaturas a
        WHERE a.negocio_id = n.id
          AND a.id > $2
          AND a.ativo = TRUE
        ORDER BY a.id DESC
        LIMIT 1
      ) atual ON TRUE
      WHERE n.id = $1
      FOR UPDATE OF n
    `,
    [negocioId, assinaturaId]
  );

  return resultado.rows[0]?.assinatura_vigente_id || null;
}

async function listarAtivasAnteriores(
  client,
  negocioId,
  assinaturaId
) {
  const resultado = await client.query(
    `
      SELECT id, asaas_subscription_id
      FROM assinaturas
      WHERE negocio_id = $1
        AND id <> $2
        AND ativo = TRUE
      ORDER BY id ASC
      FOR UPDATE
    `,
    [negocioId, assinaturaId]
  );

  return resultado.rows;
}

async function cancelarAtivasSubstituidas(
  client,
  negocioId,
  assinaturaId
) {
  await client.query(
    `
      UPDATE assinaturas
      SET
        ativo = FALSE,
        status = CASE
          WHEN asaas_subscription_id IS NOT NULL THEN 'CANCELED'
          ELSE status
        END,
        observacoes = CONCAT_WS(
          E'\n',
          NULLIF(observacoes, ''),
          'Recorrência substituída por uma nova assinatura.'
        ),
        updated_at = NOW()
      WHERE negocio_id = $1
        AND id <> $2
        AND ativo = TRUE
    `,
    [negocioId, assinaturaId]
  );
}

async function desativarOutras(
  client,
  negocioId,
  assinaturaId
) {
  await client.query(
    `
      UPDATE assinaturas
      SET ativo = FALSE
      WHERE negocio_id = $1
        AND id <> $2
    `,
    [negocioId, assinaturaId]
  );
}

async function ativarAssinatura(
  client,
  {
    assinaturaId,
    subscriptionId,
    proximaCobranca,
    observacoes,
  }
) {
  const resultado = await client.query(
    `
      UPDATE assinaturas
      SET
        asaas_subscription_id = $1,
        status = 'ACTIVE',
        data_proxima_cobranca = $2,
        ativo = TRUE,
        observacoes = $3
      WHERE id = $4
      RETURNING *
    `,
    [
      subscriptionId,
      proximaCobranca,
      observacoes,
      assinaturaId,
    ]
  );

  return resultado.rows[0] || null;
}

async function atualizarPlanoNegocio(
  client,
  negocioId,
  planoId
) {
  await client.query(
    `
      UPDATE negocios
      SET plano_id = $1
      WHERE id = $2
    `,
    [planoId, negocioId]
  );
}

module.exports = {
  buscarPorSubscriptionParaAtualizar,
  buscarPorReferenciaParaAtualizar,
  atualizarPorWebhook,
  buscarPlanoGratis,
  atualizarPlanoNegocioSeSemOutraAssinatura,
  buscarPorPagamentoParaAtualizar,
  suspenderAssinatura,
  encerrarAssinaturaPendente,
  confirmarPagamento,
  buscarAssinaturaVigenteMaisNova,
  listarAtivasAnteriores,
  cancelarAtivasSubstituidas,
  desativarOutras,
  ativarAssinatura,
  atualizarPlanoNegocio,
};
