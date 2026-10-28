BEGIN;

CREATE UNIQUE INDEX fotos_servico_id_servico_unique ON fotos_servico(id, servico_id);

CREATE TABLE servico_foto_upload_tentativas (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  negocio_id BIGINT NOT NULL REFERENCES negocios(id) ON DELETE CASCADE,
  usuario_id BIGINT NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  servico_id BIGINT NOT NULL,
  chave_idempotencia VARCHAR(120) NOT NULL,
  arquivo_hash CHAR(64) NOT NULL,
  foto_id BIGINT,
  concluida_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (negocio_id, usuario_id, servico_id, chave_idempotencia),
  CHECK (char_length(chave_idempotencia) BETWEEN 16 AND 120
    AND chave_idempotencia ~ '^[A-Za-z0-9._:-]+$'),
  CHECK (arquivo_hash ~ '^[a-f0-9]{64}$'),
  FOREIGN KEY (servico_id, negocio_id)
    REFERENCES servicos_negocio(id, negocio_id) ON DELETE CASCADE,
  FOREIGN KEY (foto_id, servico_id)
    REFERENCES fotos_servico(id, servico_id) ON DELETE SET NULL (foto_id)
);

CREATE INDEX servico_foto_upload_foto_idx ON servico_foto_upload_tentativas(foto_id);

COMMIT;
