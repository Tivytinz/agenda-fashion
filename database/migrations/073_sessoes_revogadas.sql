BEGIN;

CREATE TABLE sessoes_revogadas (
  id BIGINT
    GENERATED ALWAYS AS IDENTITY
    PRIMARY KEY,

  usuario_id BIGINT
    NOT NULL,

  token_hash VARCHAR(64)
    NOT NULL,

  expira_em TIMESTAMPTZ
    NOT NULL,

  revogado_em TIMESTAMPTZ
    NOT NULL
    DEFAULT NOW(),

  CONSTRAINT sessoes_revogadas_usuario_fk
    FOREIGN KEY (usuario_id)
    REFERENCES usuarios(id)
    ON UPDATE CASCADE
    ON DELETE CASCADE,

  CONSTRAINT sessoes_revogadas_token_hash_unique
    UNIQUE (token_hash),

  CONSTRAINT sessoes_revogadas_token_hash_formato
    CHECK (
      token_hash ~ '^[0-9a-f]{64}$'
    )
);

CREATE INDEX sessoes_revogadas_usuario_idx
  ON sessoes_revogadas(usuario_id);

CREATE INDEX sessoes_revogadas_expira_em_idx
  ON sessoes_revogadas(expira_em);

COMMIT;
