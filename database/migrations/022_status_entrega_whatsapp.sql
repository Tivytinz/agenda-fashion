BEGIN;

ALTER TABLE whatsapp_mensagens
  ADD COLUMN IF NOT EXISTS
    status_entrega VARCHAR(20),
  ADD COLUMN IF NOT EXISTS
    status_entrega_em TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS
    entregue_em TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS
    lida_em TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS
    falhou_em TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS
    meta_codigo_erro VARCHAR(50),
  ADD COLUMN IF NOT EXISTS
    falha_retentavel BOOLEAN;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname =
      'whatsapp_mensagens_status_entrega_check'
  ) THEN
    ALTER TABLE whatsapp_mensagens
      ADD CONSTRAINT
        whatsapp_mensagens_status_entrega_check
      CHECK (
        status_entrega IS NULL
        OR status_entrega IN (
          'ACCEPTED',
          'SENT',
          'DELIVERED',
          'READ',
          'FAILED'
        )
      );
  END IF;
END
$$;

CREATE UNIQUE INDEX IF NOT EXISTS
  whatsapp_mensagens_meta_message_id_idx
ON whatsapp_mensagens (
  meta_message_id
)
WHERE meta_message_id IS NOT NULL;

COMMIT;
