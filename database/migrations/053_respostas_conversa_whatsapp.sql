BEGIN;

CREATE TABLE IF NOT EXISTS whatsapp_interacoes_recebidas (
  id BIGINT
    GENERATED ALWAYS AS IDENTITY
    PRIMARY KEY,

  meta_message_id VARCHAR(255)
    NOT NULL
    UNIQUE,

  telefone VARCHAR(13)
    NOT NULL,

  intencao VARCHAR(50)
    NOT NULL,

  status VARCHAR(20)
    NOT NULL
    DEFAULT 'RECEBIDA',

  recebido_em TIMESTAMPTZ
    NOT NULL
    DEFAULT NOW(),

  respondido_em TIMESTAMPTZ,

  resposta_meta_message_id VARCHAR(255),

  ultimo_erro VARCHAR(2000),

  CONSTRAINT whatsapp_interacoes_telefone_check
    CHECK (
      telefone ~ '^[0-9]{10,13}$'
    ),

  CONSTRAINT whatsapp_interacoes_intencao_check
    CHECK (
      intencao IN (
        'COMO_FUNCIONA',
        'CRIAR_AGENDA',
        'PLANOS',
        'AJUDA',
        'MARKETING_OPTOUT'
      )
    ),

  CONSTRAINT whatsapp_interacoes_status_check
    CHECK (
      status IN (
        'RECEBIDA',
        'RESPONDIDA',
        'SEM_RESPOSTA',
        'FALHA'
      )
    )
);

CREATE INDEX IF NOT EXISTS
  whatsapp_interacoes_telefone_idx
ON whatsapp_interacoes_recebidas (
  telefone,
  recebido_em DESC
);

COMMENT ON TABLE whatsapp_interacoes_recebidas IS
  'Controle idempotente das interações reconhecidas pelo webhook do WhatsApp. Não armazena o conteúdo livre enviado pelas pessoas.';

COMMIT;
