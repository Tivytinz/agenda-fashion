const db = require("../db/db");

async function garantirCriacao(client, assinatura, inicioCobranca) {
  const result = await client.query(`
    INSERT INTO assinatura_checkout_operacoes
      (assinatura_id, pagamento_id, tipo, referencia_externa, asaas_customer_id, inicio_cobranca)
    VALUES ($1, $2, 'CREATE', $3, $4, $5::date)
    ON CONFLICT (referencia_externa) DO UPDATE
      SET inicio_cobranca = COALESCE(assinatura_checkout_operacoes.inicio_cobranca, EXCLUDED.inicio_cobranca)
    RETURNING *
  `, [assinatura.id, assinatura.pagamento_id,
    `assinatura:${assinatura.id};negocio:${assinatura.negocio_id};plano:${assinatura.plano_id}`,
    assinatura.asaas_customer_id, inicioCobranca]);
  return result.rows[0];
}

async function garantirRemocoes(client, negocioId, assinaturaId) {
  await client.query(`
    INSERT INTO assinatura_checkout_operacoes
      (assinatura_id, tipo, referencia_externa, asaas_customer_id, asaas_subscription_id, estado)
    SELECT id, 'REMOVE', 'remover:' || asaas_subscription_id,
      asaas_customer_id, asaas_subscription_id, 'REMOVING'
    FROM assinaturas WHERE negocio_id = $1 AND id <> $2 AND asaas_subscription_id IS NOT NULL
      AND COALESCE(observacoes, '') LIKE '%Recorrência substituída por uma nova assinatura.%'
    ON CONFLICT (referencia_externa) DO NOTHING
  `, [negocioId, assinaturaId]);
}

async function reservar(id, { respeitarBackoff = false } = {}, executor = db) {
  const result = await executor.query(`
    UPDATE assinatura_checkout_operacoes SET execucao_versao = execucao_versao + 1,
      lease_ate = NOW() + INTERVAL '2 minutes', ultima_tentativa_em = NOW(), atualizado_em = NOW()
    WHERE id = $1 AND estado IN ('PENDING', 'REMOVING')
      AND (lease_ate IS NULL OR lease_ate <= NOW())
      AND (NOT $2::boolean OR proxima_tentativa_em IS NULL OR proxima_tentativa_em <= NOW())
    RETURNING *
  `, [id, respeitarBackoff]);
  return result.rows[0] || null;
}

async function registrarRecorrencia(operacao, subscriptionId, executor = db) {
  const result = await executor.query(`
    UPDATE assinatura_checkout_operacoes SET asaas_subscription_id = $2,
      estado = CASE WHEN estado = 'CANCELED' THEN 'REMOVING' ELSE estado END,
      lease_ate = CASE WHEN estado = 'CANCELED' THEN NULL ELSE lease_ate END, atualizado_em = NOW()
    WHERE id = $1 AND (asaas_subscription_id IS NULL OR asaas_subscription_id = $2)
    RETURNING *
  `, [operacao.id, subscriptionId]);
  if (!result.rows[0]) {
    // Resposta atrasada com outro ID nunca substitui a identidade já conhecida.
    // O ID adicional também precisa de uma obrigação externa própria.
    await executor.query(`INSERT INTO assinatura_checkout_operacoes
      (assinatura_id, tipo, referencia_externa, asaas_customer_id, asaas_subscription_id, estado)
      SELECT assinatura_id, 'REMOVE', 'remover:' || $2, asaas_customer_id, $2, 'REMOVING'
      FROM assinatura_checkout_operacoes WHERE id = $1
      ON CONFLICT (referencia_externa) DO NOTHING`, [operacao.id, subscriptionId]);
  }
  return result.rows[0] || null;
}

async function registrarWebhook(client, { externalReference, customerId, subscriptionId }) {
  const result = await client.query(`
    SELECT * FROM assinatura_checkout_operacoes WHERE tipo = 'CREATE'
      AND referencia_externa = $1 AND asaas_customer_id = $2 FOR UPDATE
  `, [externalReference, customerId]);
  if (!result.rows[0]) return null;
  return registrarRecorrencia(result.rows[0], subscriptionId, client);
}

async function bloquear(client, operacao) {
  const result = await client.query(`SELECT * FROM assinatura_checkout_operacoes
    WHERE id = $1 AND execucao_versao = $2 FOR UPDATE`, [operacao.id, operacao.execucao_versao]);
  return result.rows[0] || null;
}

async function mudarEstado(client, operacao, estado) {
  const result = await client.query(`
    UPDATE assinatura_checkout_operacoes SET estado = $3,
      lease_ate = CASE WHEN $3 IN ('COMPLETED', 'CANCELED') THEN NULL ELSE lease_ate END,
      proxima_tentativa_em = NULL, atualizado_em = NOW()
    WHERE id = $1 AND execucao_versao = $2 AND estado IN ('PENDING', 'REMOVING')
      AND ($3 <> 'CANCELED' OR asaas_subscription_id IS NOT DISTINCT FROM $4::text) RETURNING *
  `, [operacao.id, operacao.execucao_versao, estado, operacao.asaas_subscription_id || null]);
  return result.rows[0] || null;
}

async function registrarFalha(operacao, codigo) {
  await db.query(`UPDATE assinatura_checkout_operacoes SET ultima_falha_em = NOW(), ultimo_erro_codigo = $3,
    lease_ate = NULL, proxima_tentativa_em = NOW() + INTERVAL '2 minutes', atualizado_em = NOW()
    WHERE id = $1 AND execucao_versao = $2 AND estado IN ('PENDING', 'REMOVING')`,
  [operacao.id, operacao.execucao_versao, codigo]);
}

async function adiarConsulta(operacao) {
  await db.query(`UPDATE assinatura_checkout_operacoes
    SET lease_ate = NULL, proxima_tentativa_em = NOW() + INTERVAL '2 minutes', atualizado_em = NOW()
    WHERE id = $1 AND execucao_versao = $2 AND estado = 'PENDING'`, [operacao.id, operacao.execucao_versao]);
}

async function listarPendentes(negocioId, { respeitarBackoff = false } = {}) {
  const result = await db.query(`SELECT o.*, p.asaas_payment_id FROM assinatura_checkout_operacoes o
    JOIN assinaturas a ON a.id = o.assinatura_id LEFT JOIN pagamentos p ON p.id = o.pagamento_id
    WHERE a.negocio_id = $1 AND o.estado IN ('PENDING', 'REMOVING')
      AND (o.lease_ate IS NULL OR o.lease_ate <= NOW())
      AND (NOT $2::boolean OR o.proxima_tentativa_em IS NULL OR o.proxima_tentativa_em <= NOW())
    ORDER BY o.ultima_tentativa_em NULLS FIRST, o.id LIMIT 100`, [negocioId, respeitarBackoff]);
  return result.rows;
}

async function listarNegociosPendentes(limite = 100) {
  const result = await db.query(`SELECT a.negocio_id, MIN(o.ultima_tentativa_em) AS ultima_tentativa_em
    FROM assinatura_checkout_operacoes o JOIN assinaturas a ON a.id = o.assinatura_id
    WHERE o.estado IN ('PENDING', 'REMOVING') AND (o.lease_ate IS NULL OR o.lease_ate <= NOW())
      AND (o.proxima_tentativa_em IS NULL OR o.proxima_tentativa_em <= NOW())
    GROUP BY a.negocio_id ORDER BY MIN(COALESCE(o.ultima_tentativa_em, '-infinity'::timestamptz)), a.negocio_id LIMIT $1`,
  [Math.min(500, Math.max(1, Number(limite) || 100))]);
  return result.rows;
}

module.exports = { garantirCriacao, garantirRemocoes, reservar, registrarRecorrencia, registrarWebhook,
  bloquear, mudarEstado, registrarFalha, adiarConsulta, listarPendentes, listarNegociosPendentes };
