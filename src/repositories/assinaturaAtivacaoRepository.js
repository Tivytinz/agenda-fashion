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
      p.status AS pagamento_status,
      p.confirmacao_observada_em,
      p.data_pagamento,
      p.data_vencimento,
      p.asaas_ultimo_evento_em AS pagamento_ultimo_evento_em,
      p.asaas_ultimo_evento_id AS pagamento_ultimo_evento_id,
      a.*,
      EXISTS (SELECT 1 FROM assinatura_renovacao_operacoes o
        WHERE o.assinatura_id = a.id AND o.tentativa = a.reativacao_tentativa
          AND o.estado IN ('PENDING', 'REMOVING')) AS renovacao_em_resolucao
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
  /*
   * A linha do negócio é a fronteira comum de serialização
   * entre ativações concorrentes. O lock dura somente durante
   * a transação local; nenhuma chamada ao Asaas é feita aqui.
   */
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

  const assinaturaVigenteId =
    resultado.rows[0]
      ?.assinatura_vigente_id;

  return assinaturaVigenteId
    ? {
        id: assinaturaVigenteId
      }
    : null;
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

async function atualizarPeriodoPagoSemRenovar(client, { assinaturaId, dataProximaCobranca }) {
  const result = await client.query(`
    UPDATE assinaturas
    SET status = CASE WHEN UPPER(status) = 'REACTIVATING' OR EXISTS (
          SELECT 1 FROM assinatura_renovacao_operacoes o
          WHERE o.assinatura_id = assinaturas.id AND o.tentativa = assinaturas.reativacao_tentativa
            AND o.estado IN ('PENDING', 'REMOVING')) THEN 'REACTIVATING' ELSE 'CANCELED' END,
        renovacao_cancelada = TRUE,
        reativacao_inicio_cobranca = CASE
          WHEN UPPER(status) = 'REACTIVATING'
            THEN COALESCE(reativacao_inicio_cobranca, acesso_pago_ate, data_proxima_cobranca)
          ELSE reativacao_inicio_cobranca END,
        acesso_pago_ate = $2::date,
        ativo = $2::date > CURRENT_DATE,
        updated_at = CASE WHEN UPPER(status) = 'REACTIVATING' THEN updated_at ELSE NOW() END
    WHERE id = $1 AND (renovacao_cancelada = TRUE OR UPPER(status) IN ('CANCELED', 'CANCELLED', 'REACTIVATING')
      OR EXISTS (SELECT 1 FROM assinatura_renovacao_operacoes o
        WHERE o.assinatura_id = assinaturas.id AND o.tentativa = assinaturas.reativacao_tentativa
          AND o.estado IN ('PENDING', 'REMOVING')))
    RETURNING *
  `, [assinaturaId, dataProximaCobranca]);
  return result.rows[0] || null;
}

async function ativarAssinatura(
  client,
  {
    assinaturaId,
    asaasSubscriptionId,
    dataProximaCobranca,
    acessoPagoAte,
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
      acesso_pago_ate = CASE WHEN acesso_pago_reconciliado THEN $5::date
        ELSE GREATEST(acesso_pago_ate, $5::date) END,
      ativo = TRUE,
      observacoes = $3,
      updated_at = NOW()
    WHERE id = $4
      AND UPPER(status) NOT IN ('CANCELED', 'CANCELLED', 'REACTIVATING')
      AND renovacao_cancelada = FALSE
    RETURNING *
    `,
    [
      asaasSubscriptionId || null,
      dataProximaCobranca || null,
      observacoes || null,
      assinaturaId,
      acessoPagoAte || null,
    ]
  );

  return resultado.rows[0] || null;
}

async function periodoPagoVigente(client, fimPago) {
  const result = await client.query('SELECT $1::date > CURRENT_DATE AS vigente', [fimPago]);
  return result.rows[0]?.vigente === true;
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
  /*
   * A obrigação externa é registrada em assinatura_checkout_operacoes.
   * O status financeiro pode mudar sem retirar esta identidade da limpeza.
   */
  const resultado = await client.query(
    `
    SELECT
      id,
      asaas_subscription_id
    FROM assinaturas
    WHERE negocio_id = $1
      AND id <> $2
      AND asaas_subscription_id IS NOT NULL
      AND COALESCE(observacoes, '') LIKE
        '%Recorrência substituída por uma nova assinatura.%'
    ORDER BY id ASC
    FOR UPDATE
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
  atualizarPeriodoPagoSemRenovar,
  ativarAssinatura,
  periodoPagoVigente,
  atualizarPlanoNegocio,
  listarRecorrenciasSubstituidas,
  existeVinculoRecorrenciaAsaas
};
