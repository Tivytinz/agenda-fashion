BEGIN;

CREATE INDEX IF NOT EXISTS
  whatsapp_mensagens_metricas_admin_idx
ON whatsapp_mensagens (
  created_at DESC,
  tipo
);

COMMIT;
