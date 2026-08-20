BEGIN;

ALTER TABLE usuarios
  ADD COLUMN IF NOT EXISTS
    whatsapp_marketing_consentido_em TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS
    whatsapp_marketing_cancelado_em TIMESTAMPTZ;

COMMENT ON COLUMN usuarios.whatsapp_marketing_consentido_em IS
  'Consentimento explícito para lembretes diários de ativação e divulgação pelo WhatsApp.';

COMMENT ON COLUMN usuarios.whatsapp_marketing_cancelado_em IS
  'Data em que a conta interrompeu os lembretes de marketing pelo WhatsApp.';

ALTER TABLE whatsapp_mensagens
  ALTER COLUMN agendamento_id
    DROP NOT NULL,
  ADD COLUMN IF NOT EXISTS
    negocio_id BIGINT,
  ADD COLUMN IF NOT EXISTS
    data_referencia DATE;

ALTER TABLE whatsapp_mensagens
  DROP CONSTRAINT IF EXISTS
    whatsapp_mensagens_negocio_fk;

ALTER TABLE whatsapp_mensagens
  ADD CONSTRAINT
    whatsapp_mensagens_negocio_fk
  FOREIGN KEY (negocio_id)
  REFERENCES negocios(id)
  ON DELETE CASCADE;

ALTER TABLE whatsapp_mensagens
  DROP CONSTRAINT IF EXISTS
    whatsapp_mensagens_tipo_check;

ALTER TABLE whatsapp_mensagens
  ADD CONSTRAINT whatsapp_mensagens_tipo_check
  CHECK (
    tipo IN (
      'NOVO_AGENDAMENTO_PROFISSIONAL',
      'CONFIRMACAO_AGENDAMENTO_CLIENTE',
      'LEMBRETE_AGENDAMENTO_CLIENTE',
      'LEMBRETE_AGENDAMENTO_PROFISSIONAL',
      'CANCELAMENTO_AGENDAMENTO_PROFISSIONAL',
      'CANCELAMENTO_AGENDAMENTO_CLIENTE',
      'LEMBRETE_PRIMEIRO_SERVICO_NEGOCIO',
      'LEMBRETE_DIVULGAR_NEGOCIO'
    )
  );

ALTER TABLE whatsapp_mensagens
  DROP CONSTRAINT IF EXISTS
    whatsapp_mensagens_origem_check;

ALTER TABLE whatsapp_mensagens
  ADD CONSTRAINT whatsapp_mensagens_origem_check
  CHECK (
    (
      agendamento_id IS NOT NULL
      AND negocio_id IS NULL
      AND data_referencia IS NULL
      AND tipo NOT IN (
        'LEMBRETE_PRIMEIRO_SERVICO_NEGOCIO',
        'LEMBRETE_DIVULGAR_NEGOCIO'
      )
    )
    OR
    (
      agendamento_id IS NULL
      AND negocio_id IS NOT NULL
      AND data_referencia IS NOT NULL
      AND tipo IN (
        'LEMBRETE_PRIMEIRO_SERVICO_NEGOCIO',
        'LEMBRETE_DIVULGAR_NEGOCIO'
      )
    )
  );

CREATE INDEX IF NOT EXISTS
  whatsapp_mensagens_negocio_idx
ON whatsapp_mensagens (
  negocio_id,
  created_at DESC
)
WHERE negocio_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS
  whatsapp_mensagens_negocio_dia_unique
ON whatsapp_mensagens (
  negocio_id,
  data_referencia
)
WHERE negocio_id IS NOT NULL;

COMMIT;
