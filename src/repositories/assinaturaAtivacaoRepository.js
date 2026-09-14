const db = require("../db/db");

async function buscarContextoPagamento(
  client,
  paymentId,
  {
    bloquear = false
  } = {}
) {
  const executor = client || db;
  const trava = bloquear
    ? "FOR UPDATE OF p, a"
    : "";

  const resultado = await executor.query(
    `
    SELECT
      p.id AS pagamento_id,
      p.data_pagamento,
      p.data_vencimento,
      p.asaas_ultimo_evento_em AS pagamento_ultimo_evento_em,
      p.asaas_ultimo_evento_id AS pagamento_ultimo_evento_id,
      a.*
    FROM pagamentos p
    INNER JOIN assinaturas a
      ON a.id = p.assinatura_id
    WHERE p.asaas_payment_id = $1
    LIMIT 1
    ${trava}
    `,
    [paymentId]
  );

  return resultado.rows[0] || null;
}

async function bloquearNegocio(
  client,
  negocioId
) {
  const resultado = await client.query(
    `
    SELECT id
    FROM negocios
    WHERE id = $1
    FOR UPDATE
    `,
    [negocioId]
  );

  return resultado.rows[0] || null;
}

async function buscarAssinaturaAtivaMaisNova(
  client,
  negocioId,
  assinaturaId
) {
  const resultado = await client.query(
    `
    SELECT id
    FROM assinaturas
    WHERE negocio_id = $1
      AND id > $2
      AND ativo = TRUE
    ORDER BY id DESC
    LIMIT 1
    `,
    [negocioId, assinaturaId]
  );

  return resultado.rows[0] || null;
}

async function vincularRecorrenciaAsaas(
  client,
  assinaturaId,
  asaasSubscriptionId
) {
  if (!asaasSubscriptionId) {
    return null;
  }

  const resultado = await client.query(
    `
    UPDATE assinaturas
    SET
      asaas_subscription_id =
        COALESCE(
          asaas_subscription_id,
          $1
        ),
      updated_at = NOW()
    WHERE id = $2
      AND (
        asaas_subscription_id IS NULL
        OR asaas_subscription_id = $1
      )
    RETURNING asaas_subscription_id
    `,
    [asaasSubscriptionId, assinaturaId]
  );

  return resultado.rows[0] || null;
}

async function desativarAssinaturasConcorrentes(
  client,
  negocioId,
  assinaturaId
) {
  return client.query(
    `
    UPDATE assinaturas
    SET
      ativo = FALSE,
      status = CASE
        WHEN asaas_subscription_id IS NOT NULL
          THEN 'CANCELED'
        ELSE status
      END,
      observacoes = CASE
        WHEN asaas_subscription_id IS NOT NULL
          THEN CONCAT_WS(
            E'\n',
            NULLIF(observacoes, ''),
            'Recorrência substituída por uma nova assinatura.'
          )
        ELSE observacoes
      END,
      updated_at = NOW()
    WHERE negocio_id = $1
      AND id <> $2
      AND ativo = TRUE
    `,
    [negocioId, assinaturaId]
  );
}

async function ativarAssinatura(
  client,
  {
    assinaturaId,
    asaasSubscriptionId,
    dataProximaCobranca,
    observacoes
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
      observacoes = $3,
      updated_at = NOW()
    WHERE id = $4
    RETURNING *
    `,
    [
      asaasSubscriptionId || null,
      dataProximaCobranca || null,
      observacoes || null,
      assinaturaId
    ]
  );

  return resultado.rows[0] || null;
}

async function atualizarPlanoNegocio(
  client,
  negocioId,
  planoId
) {
  const resultado = await client.query(
    `
    UPDATE negocios
    SET plano_id = $1
    WHERE id = $2
    RETURNING id, plano_id
    `,
    [planoId, negocioId]
  );

  return resultado.rows[0] || null;
}

async function listarRecorrenciasSubstituidas(
  client,
  negocioId,
  assinaturaId
) {
  const resultado = await client.query(
    `
    SELECT DISTINCT asaas_subscription_id
    FROM assinaturas
    WHERE negocio_id = $1
      AND id <> $2
      AND asaas_subscription_id IS NOT NULL
      AND status = 'CANCELED'
      AND COALESCE(observacoes, '') LIKE
        '%Recorrência substituída por uma nova assinatura.%'
    `,
    [negocioId, assinaturaId]
  );

  return resultado.rows
    .map(
      (item) =>
        String(
          item.asaas_subscription_id || ""
        ).trim()
    )
    .filter(Boolean);
}

async function existeVinculoRecorrenciaAsaas(
  asaasSubscriptionId
) {
  if (!asaasSubscriptionId) {
    return false;
  }

  const resultado = await db.query(
    `
    SELECT 1
    FROM assinaturas
    WHERE asaas_subscription_id = $1
    LIMIT 1
    `,
    [asaasSubscriptionId]
  );

  return Boolean(resultado.rows[0]);
}

module.exports = {
  buscarContextoPagamento,
  bloquearNegocio,
  buscarAssinaturaAtivaMaisNova,
  vincularRecorrenciaAsaas,
  desativarAssinaturasConcorrentes,
  ativarAssinatura,
  atualizarPlanoNegocio,
  listarRecorrenciasSubstituidas,
  existeVinculoRecorrenciaAsaas
};
