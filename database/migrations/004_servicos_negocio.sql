BEGIN;

CREATE TABLE IF NOT EXISTS servicos_negocio (
  id BIGINT
    GENERATED ALWAYS AS IDENTITY
    PRIMARY KEY,

  negocio_id BIGINT NOT NULL,

  nome VARCHAR(120) NOT NULL,

  descricao VARCHAR(1200),

  valor NUMERIC(12, 2)
    NOT NULL
    DEFAULT 0,

  duracao_minutos INTEGER
    NOT NULL
    DEFAULT 60,

  foto_url TEXT,

  foto_public_id VARCHAR(255),

  ativo BOOLEAN
    NOT NULL
    DEFAULT TRUE,

  created_at TIMESTAMPTZ
    NOT NULL
    DEFAULT NOW(),

  updated_at TIMESTAMPTZ
    NOT NULL
    DEFAULT NOW(),

  CONSTRAINT servicos_negocio_negocio_fk
    FOREIGN KEY (negocio_id)
    REFERENCES negocios(id)
    ON DELETE CASCADE,

  CONSTRAINT servicos_negocio_nome_check
    CHECK (
      CHAR_LENGTH(
        BTRIM(nome)
      ) BETWEEN 2 AND 120
    ),

  CONSTRAINT servicos_negocio_valor_check
    CHECK (
      valor >= 0
    ),

  CONSTRAINT servicos_negocio_duracao_check
    CHECK (
      duracao_minutos BETWEEN 5 AND 1440
    )
);

CREATE INDEX IF NOT EXISTS
  servicos_negocio_negocio_id_idx
ON servicos_negocio (
  negocio_id
);

CREATE INDEX IF NOT EXISTS
  servicos_negocio_ativos_idx
ON servicos_negocio (
  negocio_id,
  ativo
);

CREATE UNIQUE INDEX IF NOT EXISTS
  servicos_negocio_nome_ativo_unique
ON servicos_negocio (
  negocio_id,
  LOWER(nome)
)
WHERE ativo = TRUE;

CREATE OR REPLACE FUNCTION
  atualizar_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS
  servicos_negocio_updated_at_trigger
ON servicos_negocio;

CREATE TRIGGER
  servicos_negocio_updated_at_trigger
BEFORE UPDATE
ON servicos_negocio
FOR EACH ROW
EXECUTE FUNCTION
  atualizar_updated_at();

COMMIT;