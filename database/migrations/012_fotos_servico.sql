BEGIN;

CREATE TABLE IF NOT EXISTS fotos_servico (
  id SERIAL PRIMARY KEY,

  servico_id INTEGER NOT NULL,

  foto_url TEXT NOT NULL,

  foto_public_id VARCHAR(255),

  created_at TIMESTAMP NOT NULL DEFAULT NOW(),

  CONSTRAINT fotos_servico_servico_fk
    FOREIGN KEY (servico_id)
    REFERENCES servicos_negocio(id)
    ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS
  fotos_servico_servico_id_idx
ON fotos_servico(servico_id);

COMMIT;