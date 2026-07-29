BEGIN;

ALTER TABLE agendamentos
  ADD COLUMN IF NOT EXISTS
    whatsapp_consentido_em
      TIMESTAMPTZ;

CREATE TABLE IF NOT EXISTS whatsapp_mensagens (
  id BIGINT
    GENERATED ALWAYS AS IDENTITY
    PRIMARY KEY,

  agendamento_id BIGINT
    NOT NULL,

  tipo VARCHAR(60)
    NOT NULL,

  destinatario VARCHAR(15)
    NOT NULL,

  parametros_corpo JSONB
    NOT NULL
    DEFAULT '[]'::JSONB,

  agendado_para TIMESTAMPTZ
    NOT NULL
    DEFAULT NOW(),

  expira_em TIMESTAMPTZ
    NOT NULL,

  status VARCHAR(20)
    NOT NULL
    DEFAULT 'PENDING',

  tentativas INTEGER
    NOT NULL
    DEFAULT 0,

  max_tentativas INTEGER
    NOT NULL
    DEFAULT 5,

  proxima_tentativa_em TIMESTAMPTZ
    NOT NULL
    DEFAULT NOW(),

  bloqueado_em TIMESTAMPTZ,

  enviado_em TIMESTAMPTZ,

  meta_message_id VARCHAR(255),

  ultimo_erro TEXT,

  created_at TIMESTAMPTZ
    NOT NULL
    DEFAULT NOW(),

  updated_at TIMESTAMPTZ
    NOT NULL
    DEFAULT NOW(),

  CONSTRAINT whatsapp_mensagens_agendamento_fk
    FOREIGN KEY (agendamento_id)
    REFERENCES agendamentos(id)
    ON DELETE CASCADE,

  CONSTRAINT whatsapp_mensagens_tipo_check
    CHECK (
      tipo IN (
        'NOVO_AGENDAMENTO_PROFISSIONAL',
        'CONFIRMACAO_AGENDAMENTO_CLIENTE',
        'LEMBRETE_AGENDAMENTO_CLIENTE',
        'CANCELAMENTO_AGENDAMENTO_PROFISSIONAL',
        'CANCELAMENTO_AGENDAMENTO_CLIENTE'
      )
    ),

  CONSTRAINT whatsapp_mensagens_status_check
    CHECK (
      status IN (
        'PENDING',
        'PROCESSING',
        'SENT',
        'FAILED',
        'CANCELED'
      )
    ),

  CONSTRAINT whatsapp_mensagens_destinatario_check
    CHECK (
      destinatario ~ '^[0-9]{10,13}$'
    ),

  CONSTRAINT whatsapp_mensagens_parametros_check
    CHECK (
      jsonb_typeof(parametros_corpo) = 'array'
    ),

  CONSTRAINT whatsapp_mensagens_tentativas_check
    CHECK (
      tentativas >= 0
      AND max_tentativas BETWEEN 1 AND 20
    ),

  CONSTRAINT whatsapp_mensagens_evento_unique
    UNIQUE (
      agendamento_id,
      tipo,
      destinatario
    )
);

CREATE INDEX IF NOT EXISTS
  whatsapp_mensagens_fila_idx
ON whatsapp_mensagens (
  agendado_para,
  proxima_tentativa_em,
  expira_em,
  id
)
WHERE status IN (
  'PENDING',
  'FAILED',
  'PROCESSING'
);

CREATE INDEX IF NOT EXISTS
  whatsapp_mensagens_agendamento_idx
ON whatsapp_mensagens (
  agendamento_id
);

DROP TRIGGER IF EXISTS
  whatsapp_mensagens_updated_at_trigger
ON whatsapp_mensagens;

CREATE TRIGGER
  whatsapp_mensagens_updated_at_trigger
BEFORE UPDATE
ON whatsapp_mensagens
FOR EACH ROW
EXECUTE FUNCTION atualizar_updated_at();

COMMIT;
