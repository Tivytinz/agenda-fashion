BEGIN;

CREATE TABLE servico_criacao_tentativas (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  negocio_id BIGINT NOT NULL REFERENCES negocios(id) ON DELETE CASCADE,
  usuario_id BIGINT NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  chave_idempotencia VARCHAR(120) NOT NULL,
  request_hash CHAR(64) NOT NULL,
  servico_id BIGINT,
  criada_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  concluida_em TIMESTAMPTZ,
  CONSTRAINT servico_criacao_tentativa_unique
    UNIQUE (negocio_id, usuario_id, chave_idempotencia),
  CONSTRAINT servico_criacao_chave_check
    CHECK (char_length(chave_idempotencia) BETWEEN 16 AND 120
      AND chave_idempotencia ~ '^[A-Za-z0-9._:-]+$'),
  CONSTRAINT servico_criacao_hash_check CHECK (request_hash ~ '^[a-f0-9]{64}$'),
  CONSTRAINT servico_criacao_servico_negocio_fk
    FOREIGN KEY (servico_id, negocio_id)
    REFERENCES servicos_negocio(id, negocio_id)
    ON DELETE SET NULL (servico_id)
);

CREATE INDEX servico_criacao_servico_idx ON servico_criacao_tentativas(servico_id);

COMMIT;
