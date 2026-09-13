BEGIN;

ALTER TABLE webhook_eventos
  ADD COLUMN IF NOT EXISTS evento_criado_em
    TIMESTAMP WITHOUT TIME ZONE;

COMMENT ON COLUMN webhook_eventos.evento_criado_em IS
  'Data/hora de criação do evento no provedor. No Asaas, corresponde ao dateCreated do envelope.';

ALTER TABLE pagamentos
  ADD COLUMN IF NOT EXISTS asaas_ultimo_evento_em
    TIMESTAMP WITHOUT TIME ZONE;

ALTER TABLE pagamentos
  ADD COLUMN IF NOT EXISTS asaas_ultimo_evento_id
    VARCHAR(160);

COMMENT ON COLUMN pagamentos.asaas_ultimo_evento_em IS
  'dateCreated do último webhook Asaas efetivamente aplicado a esta cobrança.';

COMMENT ON COLUMN pagamentos.asaas_ultimo_evento_id IS
  'ID do último webhook Asaas efetivamente aplicado a esta cobrança.';

ALTER TABLE assinaturas
  ADD COLUMN IF NOT EXISTS asaas_ultimo_evento_em
    TIMESTAMP WITHOUT TIME ZONE;

ALTER TABLE assinaturas
  ADD COLUMN IF NOT EXISTS asaas_ultimo_evento_id
    VARCHAR(160);

COMMENT ON COLUMN assinaturas.asaas_ultimo_evento_em IS
  'dateCreated do último webhook Asaas efetivamente aplicado a esta assinatura.';

COMMENT ON COLUMN assinaturas.asaas_ultimo_evento_id IS
  'ID do último webhook Asaas efetivamente aplicado a esta assinatura.';

CREATE INDEX IF NOT EXISTS
  webhook_eventos_recurso_ordem_idx
ON webhook_eventos (
  provedor,
  recurso_id,
  evento_criado_em DESC,
  id DESC
)
WHERE recurso_id IS NOT NULL
  AND evento_criado_em IS NOT NULL;

COMMIT;
