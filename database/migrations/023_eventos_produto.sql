BEGIN;

CREATE TABLE IF NOT EXISTS eventos_produto (
  id BIGSERIAL PRIMARY KEY,

  nome VARCHAR(60) NOT NULL,
  pagina VARCHAR(60) NOT NULL,
  missao VARCHAR(60),

  sessao_id VARCHAR(64) NOT NULL,

  usuario_id INTEGER
    REFERENCES usuarios(id)
    ON DELETE SET NULL,

  negocio_id INTEGER
    REFERENCES negocios(id)
    ON DELETE SET NULL,

  propriedades JSONB
    NOT NULL
    DEFAULT '{}'::JSONB,

  created_at TIMESTAMPTZ
    NOT NULL
    DEFAULT NOW(),

  CONSTRAINT
    eventos_produto_nome_formato_check
  CHECK (
    nome ~ '^[a-z0-9_]{3,60}$'
  ),

  CONSTRAINT
    eventos_produto_pagina_formato_check
  CHECK (
    pagina ~ '^[a-z0-9_]{2,60}$'
  ),

  CONSTRAINT
    eventos_produto_sessao_formato_check
  CHECK (
    sessao_id ~ '^[A-Za-z0-9_-]{8,64}$'
  )
);

CREATE INDEX IF NOT EXISTS
  eventos_produto_nome_data_idx
ON eventos_produto (
  nome,
  created_at DESC
);

CREATE INDEX IF NOT EXISTS
  eventos_produto_sessao_data_idx
ON eventos_produto (
  sessao_id,
  created_at DESC
);

CREATE INDEX IF NOT EXISTS
  eventos_produto_negocio_data_idx
ON eventos_produto (
  negocio_id,
  created_at DESC
)
WHERE negocio_id IS NOT NULL;

COMMIT;
