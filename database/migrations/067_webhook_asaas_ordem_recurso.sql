BEGIN;

ALTER TABLE webhook_eventos
  ADD COLUMN IF NOT EXISTS evento_criado_em
    TIMESTAMP WITHOUT TIME ZONE;

COMMENT ON COLUMN webhook_eventos.evento_criado_em IS
  'Data/hora de criação do evento no provedor. No Asaas, corresponde ao dateCreated do envelope e é usada apenas para ordenar eventos do mesmo recurso.';

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
