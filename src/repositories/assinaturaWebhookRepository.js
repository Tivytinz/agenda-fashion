const db = require("../db/db");

async function bloquearNegocioDoEvento(client, { subscriptionId = null, paymentId = null, assinaturaId = null, externalReference = null }) {
  await client.query(`
    SELECT n.id FROM negocios n
    WHERE EXISTS (
      SELECT 1 FROM assinaturas a
      WHERE a.negocio_id = n.id AND (a.asaas_subscription_id = $1 OR a.id = $3
        OR EXISTS (SELECT 1 FROM pagamentos p WHERE p.assinatura_id = a.id AND p.asaas_payment_id = $2)
        OR EXISTS (SELECT 1 FROM assinatura_renovacao_operacoes o WHERE o.assinatura_id = a.id
          AND (o.referencia_externa = $4 OR o.asaas_subscription_id = $1 OR o.recorrencia_anterior_id = $1)))
    )
    ORDER BY n.id FOR UPDATE OF n
  `, [subscriptionId, paymentId, assinaturaId, externalReference]);
}

async function buscarPorSubscriptionParaAtualizar(
  client,
  subscriptionId,
  { incluirHistorico = false } = {}
) {
  const resultado = await client.query(
    `
      SELECT a.*
      FROM assinaturas a
      WHERE asaas_subscription_id = $1 OR EXISTS (
        SELECT 1 FROM assinatura_renovacao_operacoes o
        WHERE o.assinatura_id = a.id AND o.asaas_subscription_id = $1
          AND o.estado IN ('PENDING', 'REMOVING')
      )
      ${incluirHistorico ? `OR EXISTS (
        SELECT 1 FROM assinatura_renovacao_operacoes o
        WHERE o.assinatura_id = a.id AND (o.recorrencia_anterior_id = $1 OR o.asaas_subscription_id = $1)
      )` : ""}
      LIMIT 1
      FOR UPDATE OF a
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
    renovacaoCancelada = false,
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
        acesso_pago_ate = COALESCE(acesso_pago_ate, CASE WHEN ativo = TRUE AND acesso_pago_reconciliado = FALSE THEN data_proxima_cobranca END),
        data_proxima_cobranca = COALESCE($7, data_proxima_cobranca),
        ativo = $8,
        renovacao_cancelada = renovacao_cancelada OR $12::boolean,
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
      renovacaoCancelada,
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
  const resultado = await client.query(
    `
      UPDATE negocios n
      SET plano_id = $1
      WHERE n.id = $2
        AND n.plano_id = $3
        AND NOT EXISTS (
          SELECT 1
          FROM assinaturas atual
          INNER JOIN planos apl
            ON apl.id = atual.plano_id
          WHERE atual.negocio_id = n.id
            AND atual.id <> $4
            AND atual.ativo = TRUE
            AND apl.valor > 0
        )
      RETURNING n.id
    `,
    [
      novoPlanoId,
      negocioId,
      planoAtualId,
      assinaturaIgnoradaId,
    ]
  );

  return resultado.rows[0] || null;
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
  { assinaturaId, status, observacao, acessoPagoAte }
) {
  const resultado = await client.query(
    `
      UPDATE assinaturas a
      SET
        renovacao_cancelada = a.renovacao_cancelada OR UPPER(a.status) IN ('CANCELED', 'CANCELLED', 'REACTIVATING'),
        acesso_pago_reconciliado = TRUE,
        acesso_pago_ate = $4::date,
        status = CASE WHEN $4::date > CURRENT_DATE AND NOT EXISTS (
          SELECT 1 FROM assinaturas nova WHERE nova.negocio_id = a.negocio_id AND nova.id > a.id AND nova.ativo = TRUE
        ) THEN CASE
          WHEN EXISTS (SELECT 1 FROM assinatura_renovacao_operacoes o
            WHERE o.assinatura_id = a.id AND o.tentativa = a.reativacao_tentativa AND o.estado IN ('PENDING', 'REMOVING')) THEN 'REACTIVATING'
          WHEN a.renovacao_cancelada OR UPPER(a.status) IN ('CANCELED', 'CANCELLED') THEN 'CANCELED'
          ELSE 'ACTIVE' END ELSE $1 END,
        ativo = COALESCE($4::date > CURRENT_DATE, FALSE) AND NOT EXISTS (
          SELECT 1 FROM assinaturas nova WHERE nova.negocio_id = a.negocio_id AND nova.id > a.id AND nova.ativo = TRUE
        ),
        observacoes = CONCAT_WS(
          E'\n',
          NULLIF(observacoes, ''),
          $2::text
        ),
        updated_at = NOW()
      WHERE id = $3
      RETURNING *
    `,
    [status, observacao, assinaturaId, acessoPagoAte || null]
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
        acesso_pago_ate = GREATEST(COALESCE(acesso_pago_ate, data_proxima_cobranca), $2::date),
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
  bloquearNegocioDoEvento,
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
