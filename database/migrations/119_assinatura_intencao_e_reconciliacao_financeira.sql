BEGIN;

ALTER TABLE assinaturas
  ADD COLUMN renovacao_cancelada BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN acesso_pago_reconciliado BOOLEAN NOT NULL DEFAULT FALSE;

-- A intenção sobrevive ao status de cobrança. Só recuperar fatos identificáveis
-- do ciclo atual; um cancelamento de geração anterior não cancela a seguinte.
UPDATE assinaturas a SET renovacao_cancelada = TRUE
WHERE (a.asaas_subscription_id IS NOT NULL
    AND UPPER(a.status) IN ('CANCELED', 'CANCELLED', 'REACTIVATING', 'INACTIVE', 'DELETED'))
  OR UPPER(a.status) = 'REACTIVATING'
  OR EXISTS (
    SELECT 1 FROM assinatura_eventos e
    WHERE e.assinatura_id = a.id AND e.tipo = 'RENOVACAO_CANCELADA'
      AND ((e.detalhes->>'asaas_subscription_id' = a.asaas_subscription_id
          AND e.detalhes->>'reativacao_tentativa' = a.reativacao_tentativa::text)
        OR (a.reativacao_tentativa = 0 AND a.renovacao_chave_versao = 0
          AND NOT (e.detalhes ? 'reativacao_tentativa')))
  );

UPDATE assinaturas SET status = 'CANCELED'
WHERE renovacao_cancelada = TRUE AND UPPER(status) = 'ACTIVE';

-- Após falha financeira, o máximo histórico não comprova cobertura. O próximo
-- processamento deve usar os pagamentos atualmente válidos, sem inventar fatos
-- ou alterar benefícios/histórico durante o rollout.
UPDATE assinaturas SET acesso_pago_reconciliado = TRUE
WHERE UPPER(status) IN ('REFUNDED', 'RECEIVED_IN_CASH_UNDONE', 'CHARGEBACK_REQUESTED',
  'CHARGEBACK_DISPUTE', 'AWAITING_CHARGEBACK_REVERSAL', 'OVERDUE', 'PAST_DUE',
  'PAYMENT_FAILED', 'CREDIT_CARD_CAPTURE_REFUSED')
  OR (ativo = FALSE AND acesso_pago_ate IS NULL AND UPPER(status) IN ('PENDING', 'PENDING_PAYMENT'));

ALTER TABLE assinatura_renovacao_operacoes
  ADD COLUMN ultima_falha_em TIMESTAMPTZ,
  ADD COLUMN ultimo_erro_codigo TEXT
    CHECK (ultimo_erro_codigo IN ('CONTEXTO_INDISPONIVEL', 'CONSULTA_ASAAS_FALHOU',
      'REMOCAO_ASAAS_FALHOU', 'PERSISTENCIA_FALHOU'));

COMMENT ON COLUMN assinaturas.renovacao_cancelada IS
  'Intenção de não renovar, independente de suspensão/expiração; só a reativação conferida a limpa.';
COMMENT ON COLUMN assinaturas.acesso_pago_reconciliado IS
  'Após reconciliação financeira, calcular cobertura pelos pagamentos válidos, sem reutilizar máximo histórico invalidado.';

COMMIT;
