const db = require("../db/db");

async function garantirOperacaoLegada(negocioId, executor = db) {
  await executor.query(`
    INSERT INTO assinatura_renovacao_operacoes (
      assinatura_id, tentativa, referencia_externa, inicio_cobranca, recorrencia_anterior_id,
      execucao_versao, lease_ate, criado_em, atualizado_em
    )
    SELECT id, reativacao_tentativa,
      'assinatura-reativada:' || id || ';tentativa:' || reativacao_tentativa ||
        ';inicio:' || TO_CHAR(COALESCE(reativacao_inicio_cobranca, acesso_pago_ate, data_proxima_cobranca), 'YYYY-MM-DD'),
      COALESCE(reativacao_inicio_cobranca, acesso_pago_ate, data_proxima_cobranca),
      asaas_subscription_id,
      0, updated_at + INTERVAL '2 minutes', updated_at, updated_at
    FROM assinaturas
    WHERE negocio_id = $1 AND UPPER(status) = 'REACTIVATING'
      AND reativacao_tentativa > 0
      AND COALESCE(reativacao_inicio_cobranca, acesso_pago_ate, data_proxima_cobranca) IS NOT NULL
    ON CONFLICT (assinatura_id, tentativa) DO NOTHING
  `, [negocioId]);
}

async function buscarPendente(negocioId, executor = db) {
  const result = await executor.query(`
    SELECT a.*, o.tentativa AS operacao_tentativa, o.referencia_externa,
      o.inicio_cobranca, o.asaas_subscription_id AS recorrencia_preparada_id,
      o.estado AS operacao_estado, o.execucao_versao
    FROM assinatura_renovacao_operacoes o
    INNER JOIN assinaturas a ON a.id = o.assinatura_id
    WHERE a.negocio_id = $1 AND o.estado IN ('PENDING', 'REMOVING')
      AND (o.lease_ate IS NULL OR o.lease_ate <= NOW())
    ORDER BY o.atualizado_em, o.assinatura_id, o.tentativa
    LIMIT 1
  `, [negocioId]);
  return result.rows[0] || null;
}

async function reservarExecucao(client, assinaturaId, tentativa) {
  const result = await client.query(`
    UPDATE assinatura_renovacao_operacoes
    SET execucao_versao = execucao_versao + 1,
      lease_ate = NOW() + INTERVAL '2 minutes', ultima_tentativa_em = NOW(), atualizado_em = NOW()
    WHERE assinatura_id = $1 AND tentativa = $2
      AND estado IN ('PENDING', 'REMOVING')
      AND (lease_ate IS NULL OR lease_ate <= NOW())
    RETURNING *
  `, [assinaturaId, tentativa]);
  return result.rows[0] || null;
}

async function registrarRecorrencia(assinaturaId, tentativa, subscriptionId) {
  // Uma resposta antiga ainda deixa uma obrigação de remoção durável. Ela não
  // pode vincular uma geração nova nem apagar uma finalização já confirmada.
  const result = await db.query(`
    UPDATE assinatura_renovacao_operacoes
    SET asaas_subscription_id = $3,
      estado = CASE WHEN estado = 'CANCELED' THEN 'REMOVING' ELSE estado END,
      lease_ate = CASE WHEN estado = 'CANCELED' THEN NULL ELSE lease_ate END,
      atualizado_em = NOW()
    WHERE assinatura_id = $1 AND tentativa = $2
      AND (asaas_subscription_id IS NULL OR asaas_subscription_id = $3)
    RETURNING *
  `, [assinaturaId, tentativa, subscriptionId]);
  return result.rows[0] || null;
}

async function registrarRecorrenciaRecebida(client, { externalReference, customerId, subscriptionId }) {
  const result = await client.query(`
    UPDATE assinatura_renovacao_operacoes o
    SET asaas_subscription_id = $3,
      estado = CASE WHEN o.estado = 'CANCELED' THEN 'REMOVING' ELSE o.estado END,
      lease_ate = CASE WHEN o.estado = 'CANCELED' THEN NULL ELSE o.lease_ate END,
      atualizado_em = NOW()
    FROM assinaturas a
    WHERE a.id = o.assinatura_id AND o.referencia_externa = $1
      AND a.asaas_customer_id = $2 AND o.estado IN ('PENDING', 'REMOVING', 'CANCELED')
      AND (o.asaas_subscription_id IS NULL OR o.asaas_subscription_id = $3)
    RETURNING o.*
  `, [externalReference || null, customerId || null, subscriptionId]);
  return result.rows[0] || null;
}

async function reabrirRemocao(client, assinatura) {
  const result = await client.query(`
    UPDATE assinatura_renovacao_operacoes
    SET estado = 'REMOVING', lease_ate = NULL, execucao_versao = execucao_versao + 1, atualizado_em = NOW()
    WHERE assinatura_id = $1 AND tentativa = $2 AND asaas_subscription_id = $3 AND estado = 'COMPLETED'
    RETURNING *
  `, [assinatura.id, assinatura.reativacao_tentativa, assinatura.asaas_subscription_id]);
  return result.rows[0] || null;
}

async function bloquearContexto(client, assinaturaId, tentativa) {
  // Ordem comum com confirmação, cancelamento e suspensão financeira.
  await client.query(`
    SELECT n.id FROM negocios n
    INNER JOIN assinaturas a ON a.negocio_id = n.id
    WHERE a.id = $1 FOR UPDATE OF n
  `, [assinaturaId]);
  const result = await client.query(`
    SELECT a.*,
      COALESCE(a.acesso_pago_ate, a.data_proxima_cobranca) > CURRENT_DATE AS periodo_pago_valido,
      EXISTS (SELECT 1 FROM assinaturas nova WHERE nova.negocio_id = a.negocio_id
        AND nova.id > a.id AND nova.ativo = TRUE) AS possui_assinatura_mais_nova
    FROM assinaturas a WHERE a.id = $1 FOR UPDATE OF a
  `, [assinaturaId]);
  const operacao = await client.query(`
    SELECT * FROM assinatura_renovacao_operacoes
    WHERE assinatura_id = $1 AND tentativa = $2 FOR UPDATE
  `, [assinaturaId, tentativa]);
  return { assinatura: result.rows[0] || null, operacao: operacao.rows[0] || null };
}

async function marcarRemocao(client, operacao) {
  const result = await client.query(`
    UPDATE assinatura_renovacao_operacoes
    SET estado = 'REMOVING', atualizado_em = NOW()
    WHERE assinatura_id = $1 AND tentativa = $2 AND execucao_versao = $3
      AND estado IN ('PENDING', 'REMOVING')
    RETURNING *
  `, [operacao.assinatura_id, operacao.tentativa, operacao.execucao_versao]);
  return result.rows[0] || null;
}

async function concluir(client, operacao, estado) {
  const result = await client.query(`
    UPDATE assinatura_renovacao_operacoes
    SET estado = $4, lease_ate = NULL, atualizado_em = NOW()
    WHERE assinatura_id = $1 AND tentativa = $2 AND execucao_versao = $3
      AND estado IN ('PENDING', 'REMOVING')
    RETURNING *
  `, [operacao.assinatura_id, operacao.tentativa, operacao.execucao_versao, estado]);
  return result.rows[0] || null;
}

async function registrarFalha(operacao, codigo) {
  const result = await db.query(`
    UPDATE assinatura_renovacao_operacoes
    SET ultima_falha_em = NOW(), ultimo_erro_codigo = $4, atualizado_em = NOW(),
      proxima_tentativa_em = CASE WHEN $4 = 'CONTEXTO_INDISPONIVEL' THEN NOW() + INTERVAL '15 minutes'
        ELSE NOW() + INTERVAL '2 minutes' END
    WHERE assinatura_id = $1 AND tentativa = $2 AND execucao_versao = $3
      AND estado IN ('PENDING', 'REMOVING')
    RETURNING assinatura_id
  `, [operacao.assinatura_id, operacao.tentativa, operacao.execucao_versao, codigo]);
  return result.rows[0] || null;
}

async function possuiPendente(negocioId, executor = db) {
  const result = await executor.query(`
    SELECT EXISTS (
      SELECT 1 FROM assinatura_renovacao_operacoes o
      INNER JOIN assinaturas a ON a.id = o.assinatura_id
      WHERE a.negocio_id = $1 AND o.estado IN ('PENDING', 'REMOVING')
    ) OR EXISTS (
      SELECT 1 FROM assinatura_checkout_operacoes o JOIN assinaturas a ON a.id = o.assinatura_id
      WHERE a.negocio_id = $1 AND o.estado IN ('PENDING', 'REMOVING')
    ) OR EXISTS (
      SELECT 1 FROM assinaturas a
      WHERE a.negocio_id = $1 AND UPPER(a.status) = 'REACTIVATING'
    ) AS pendente
  `, [negocioId]);
  return result.rows[0]?.pendente === true;
}

async function possuiPendenteDaAssinatura(assinaturaId, executor = db) {
  const result = await executor.query(`
    SELECT EXISTS (SELECT 1 FROM assinatura_renovacao_operacoes
      WHERE assinatura_id = $1 AND estado IN ('PENDING', 'REMOVING')) AS pendente
  `, [assinaturaId]);
  return result.rows[0]?.pendente === true;
}

async function listarNegociosPendentes(limite = 100) {
  const result = await db.query(`
    SELECT a.negocio_id
    FROM assinaturas a
    LEFT JOIN assinatura_renovacao_operacoes o ON o.assinatura_id = a.id
    WHERE (o.estado IN ('PENDING', 'REMOVING') AND (o.lease_ate IS NULL OR o.lease_ate <= NOW())
        AND (o.proxima_tentativa_em IS NULL OR o.proxima_tentativa_em <= NOW()))
      OR (UPPER(a.status) = 'REACTIVATING' AND a.updated_at < NOW() - INTERVAL '2 minutes'
        AND o.assinatura_id IS NULL)
    GROUP BY a.negocio_id
    ORDER BY MIN(COALESCE(o.ultima_tentativa_em, '-infinity'::timestamptz)), a.negocio_id LIMIT $1
  `, [Math.min(500, Math.max(1, Number(limite) || 100))]);
  return result.rows;
}

module.exports = {
  garantirOperacaoLegada, buscarPendente, reservarExecucao, registrarRecorrencia,
  registrarRecorrenciaRecebida, reabrirRemocao,
  bloquearContexto, marcarRemocao, concluir, registrarFalha, possuiPendente, possuiPendenteDaAssinatura, listarNegociosPendentes,
};
