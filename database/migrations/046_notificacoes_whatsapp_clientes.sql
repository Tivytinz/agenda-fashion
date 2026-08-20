BEGIN;

ALTER TABLE usuarios
  ADD COLUMN IF NOT EXISTS
    whatsapp_notificacoes_consentido_em TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS
    whatsapp_notificacoes_cancelado_em TIMESTAMPTZ;

COMMENT ON COLUMN usuarios.whatsapp_notificacoes_consentido_em IS
  'Autorizacao para confirmacoes, lembretes e atualizacoes operacionais de agendamentos pelo WhatsApp.';

COMMENT ON COLUMN usuarios.whatsapp_notificacoes_cancelado_em IS
  'Data em que a conta desativou as notificacoes operacionais de agendamentos pelo WhatsApp.';

/*
 * Mantem a compatibilidade solicitada para contas ja existentes.
 * A condicao preserva quem desativar a preferencia se a migration
 * for executada novamente.
 */
UPDATE usuarios
SET
  whatsapp_notificacoes_consentido_em =
    COALESCE(created_at, NOW()),
  whatsapp_notificacoes_cancelado_em = NULL
WHERE whatsapp_notificacoes_consentido_em IS NULL
  AND whatsapp_notificacoes_cancelado_em IS NULL;

COMMIT;
