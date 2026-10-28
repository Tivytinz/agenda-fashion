BEGIN;

CREATE TABLE negocio_criacao_tentativas (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  usuario_id BIGINT NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  chave_idempotencia VARCHAR(120) NOT NULL,
  request_hash CHAR(64) NOT NULL,
  negocio_id BIGINT REFERENCES negocios(id) ON DELETE SET NULL,
  concluida_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT negocio_criacao_tentativa_unique UNIQUE (usuario_id, chave_idempotencia),
  CONSTRAINT negocio_criacao_chave_check CHECK (
    char_length(chave_idempotencia) BETWEEN 16 AND 120
    AND chave_idempotencia ~ '^[A-Za-z0-9._:-]+$'
  ),
  CONSTRAINT negocio_criacao_hash_check CHECK (request_hash ~ '^[a-f0-9]{64}$')
);

CREATE INDEX negocio_criacao_alvo_idx ON negocio_criacao_tentativas(negocio_id);

COMMIT;
