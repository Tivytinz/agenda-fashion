BEGIN;

CREATE TABLE assinatura_checkout_operacoes (
  id BIGSERIAL PRIMARY KEY,
  assinatura_id INTEGER NOT NULL REFERENCES assinaturas(id) ON DELETE CASCADE,
  pagamento_id INTEGER REFERENCES pagamentos(id) ON DELETE SET NULL,
  tipo TEXT NOT NULL CHECK (tipo IN ('CREATE', 'REMOVE')),
  referencia_externa TEXT NOT NULL UNIQUE,
  asaas_customer_id TEXT,
  asaas_subscription_id TEXT,
  inicio_cobranca DATE,
  estado TEXT NOT NULL DEFAULT 'PENDING'
    CHECK (estado IN ('PENDING', 'REMOVING', 'COMPLETED', 'CANCELED')),
  execucao_versao INTEGER NOT NULL DEFAULT 0,
  lease_ate TIMESTAMPTZ,
  proxima_tentativa_em TIMESTAMPTZ,
  ultima_tentativa_em TIMESTAMPTZ,
  ultima_falha_em TIMESTAMPTZ,
  ultimo_erro_codigo TEXT CHECK (ultimo_erro_codigo IN
    ('CONTEXTO_INDISPONIVEL', 'CONSULTA_ASAAS_FALHOU', 'REMOCAO_ASAAS_FALHOU', 'CRIACAO_ASAAS_FALHOU', 'PERSISTENCIA_FALHOU')),
  criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Só recupera identidades demonstráveis. Consulta por referência não cria cobrança
-- e não concede acesso a partir de dados históricos incompletos.
INSERT INTO assinatura_checkout_operacoes
  (assinatura_id, pagamento_id, tipo, referencia_externa, asaas_customer_id, inicio_cobranca)
SELECT a.id, p.id, 'CREATE',
  'assinatura:' || a.id || ';negocio:' || a.negocio_id || ';plano:' || a.plano_id,
  a.asaas_customer_id, NULL
FROM assinaturas a
JOIN LATERAL (SELECT id FROM pagamentos WHERE assinatura_id = a.id
  AND data_pagamento IS NOT NULL ORDER BY id LIMIT 1) p ON TRUE
WHERE a.asaas_subscription_id IS NULL AND a.forma_pagamento = 'pix'
  AND a.asaas_customer_id IS NOT NULL;

INSERT INTO assinatura_checkout_operacoes
  (assinatura_id, tipo, referencia_externa, asaas_customer_id, asaas_subscription_id, estado)
SELECT id, 'REMOVE', 'remover:' || asaas_subscription_id,
  asaas_customer_id, asaas_subscription_id, 'REMOVING'
FROM assinaturas
WHERE asaas_subscription_id IS NOT NULL
  AND COALESCE(observacoes, '') LIKE '%Recorrência substituída por uma nova assinatura.%'
ON CONFLICT (referencia_externa) DO NOTHING;

ALTER TABLE assinatura_renovacao_operacoes
  ADD COLUMN ultima_tentativa_em TIMESTAMPTZ,
  ADD COLUMN proxima_tentativa_em TIMESTAMPTZ;

CREATE INDEX assinatura_checkout_operacoes_pendentes_idx
  ON assinatura_checkout_operacoes (ultima_tentativa_em NULLS FIRST, assinatura_id)
  WHERE estado IN ('PENDING', 'REMOVING');

COMMENT ON TABLE assinatura_checkout_operacoes IS
  'Criação inicial incerta e remoções de recorrências substituídas; obrigação externa independente do status financeiro.';
COMMIT;
