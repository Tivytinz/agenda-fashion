BEGIN;

ALTER TABLE usuarios
  ADD COLUMN IF NOT EXISTS
    whatsapp_operacional_consentido_em TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS
    whatsapp_operacional_cancelado_em TIMESTAMPTZ;

COMMENT ON COLUMN usuarios.whatsapp_operacional_consentido_em IS
  'Consentimento explícito para avisos operacionais de agendamentos enviados pelo Agenda Fashion no WhatsApp.';

COMMENT ON COLUMN usuarios.whatsapp_operacional_cancelado_em IS
  'Data em que a conta interrompeu os avisos operacionais de agendamentos pelo WhatsApp.';

CREATE TABLE IF NOT EXISTS whatsapp_consentimentos (
  id BIGINT
    GENERATED ALWAYS AS IDENTITY
    PRIMARY KEY,

  usuario_id BIGINT,
  agendamento_id BIGINT,

  telefone VARCHAR(13)
    NOT NULL,

  escopo VARCHAR(40)
    NOT NULL,

  acao VARCHAR(20)
    NOT NULL,

  origem VARCHAR(30)
    NOT NULL,

  texto_versao VARCHAR(60)
    NOT NULL,

  created_at TIMESTAMPTZ
    NOT NULL
    DEFAULT NOW(),

  CONSTRAINT whatsapp_consentimentos_usuario_fk
    FOREIGN KEY (usuario_id)
    REFERENCES usuarios(id)
    ON DELETE CASCADE,

  CONSTRAINT whatsapp_consentimentos_agendamento_fk
    FOREIGN KEY (agendamento_id)
    REFERENCES agendamentos(id)
    ON DELETE CASCADE,

  CONSTRAINT whatsapp_consentimentos_sujeito_check
    CHECK (
      usuario_id IS NOT NULL
      OR agendamento_id IS NOT NULL
    ),

  CONSTRAINT whatsapp_consentimentos_telefone_check
    CHECK (
      telefone ~ '^[0-9]{10,13}$'
    ),

  CONSTRAINT whatsapp_consentimentos_escopo_check
    CHECK (
      escopo IN (
        'OPERACIONAL_PROFISSIONAL',
        'OPERACIONAL_CLIENTE',
        'MARKETING_PROFISSIONAL'
      )
    ),

  CONSTRAINT whatsapp_consentimentos_acao_check
    CHECK (
      acao IN (
        'CONSENTIDO',
        'CANCELADO'
      )
    ),

  CONSTRAINT whatsapp_consentimentos_origem_check
    CHECK (
      origem IN (
        'CADASTRO',
        'MINHA_CONTA',
        'PAINEL',
        'AGENDAMENTO',
        'WHATSAPP'
      )
    )
);

CREATE INDEX IF NOT EXISTS
  whatsapp_consentimentos_usuario_idx
ON whatsapp_consentimentos (
  usuario_id,
  escopo,
  created_at DESC
)
WHERE usuario_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS
  whatsapp_consentimentos_agendamento_idx
ON whatsapp_consentimentos (
  agendamento_id,
  created_at DESC
)
WHERE agendamento_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS
  whatsapp_consentimentos_telefone_idx
ON whatsapp_consentimentos (
  telefone,
  escopo,
  created_at DESC
);

COMMIT;
