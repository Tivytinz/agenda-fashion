BEGIN;

ALTER TABLE assinaturas ADD COLUMN acesso_pago_ate DATE;

-- Preserva o fim conhecido no rollout. Novas confirmações estendem este campo;
-- eventos de programação do provedor alteram apenas data_proxima_cobranca.
UPDATE assinaturas a SET acesso_pago_ate = a.data_proxima_cobranca
WHERE a.ativo = TRUE OR UPPER(a.status) IN ('CANCELED', 'CANCELLED', 'REACTIVATING')
  OR EXISTS (SELECT 1 FROM pagamentos p WHERE p.assinatura_id = a.id
    AND UPPER(p.status) IN ('CONFIRMED', 'RECEIVED', 'RECEIVED_IN_CASH')
    AND COALESCE(p.data_pagamento, p.data_vencimento) IS NOT NULL);

CREATE INDEX assinaturas_periodo_pago_vencido_idx
  ON assinaturas (COALESCE(acesso_pago_ate, data_proxima_cobranca), negocio_id)
  WHERE ativo = TRUE AND UPPER(status) IN ('CANCELED', 'CANCELLED', 'REACTIVATING');

CREATE TABLE assinatura_renovacao_operacoes (
  assinatura_id INTEGER NOT NULL REFERENCES assinaturas(id) ON DELETE CASCADE,
  tentativa INTEGER NOT NULL CHECK (tentativa > 0),
  referencia_externa TEXT NOT NULL UNIQUE,
  inicio_cobranca DATE NOT NULL,
  recorrencia_anterior_id TEXT,
  asaas_subscription_id TEXT,
  estado TEXT NOT NULL DEFAULT 'PENDING'
    CHECK (estado IN ('PENDING', 'REMOVING', 'COMPLETED', 'CANCELED')),
  execucao_versao INTEGER NOT NULL DEFAULT 1,
  lease_ate TIMESTAMPTZ,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (assinatura_id, tentativa)
);

-- A obrigação de resolver o provedor sobrevive à suspensão/expiração do acesso.
INSERT INTO assinatura_renovacao_operacoes (
  assinatura_id, tentativa, referencia_externa, inicio_cobranca, recorrencia_anterior_id,
  execucao_versao, lease_ate, criado_em, atualizado_em
)
SELECT id, reativacao_tentativa,
  'assinatura-reativada:' || id || ';tentativa:' || reativacao_tentativa ||
    ';inicio:' || TO_CHAR(COALESCE(reativacao_inicio_cobranca, data_proxima_cobranca), 'YYYY-MM-DD'),
  COALESCE(reativacao_inicio_cobranca, data_proxima_cobranca),
  asaas_subscription_id,
  0, updated_at + INTERVAL '2 minutes', updated_at, updated_at
FROM assinaturas
WHERE UPPER(status) = 'REACTIVATING'
  AND reativacao_tentativa > 0
  AND COALESCE(reativacao_inicio_cobranca, data_proxima_cobranca) IS NOT NULL;

CREATE INDEX assinatura_renovacao_operacoes_pendentes_idx
  ON assinatura_renovacao_operacoes (lease_ate, assinatura_id)
  WHERE estado IN ('PENDING', 'REMOVING');

COMMENT ON COLUMN assinaturas.acesso_pago_ate IS
  'Fim exclusivo do período quitado; não é alterado por eventos de programação da recorrência.';
COMMENT ON TABLE assinatura_renovacao_operacoes IS
  'Operações externas de reativação por geração, recuperáveis mesmo após suspensão ou expiração do acesso.';

COMMIT;
