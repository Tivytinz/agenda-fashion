BEGIN;

CREATE TABLE IF NOT EXISTS checkout_tentativas (
  id BIGSERIAL PRIMARY KEY,
  negocio_id INTEGER NOT NULL,
  chave_idempotencia VARCHAR(120) NOT NULL,
  request_hash VARCHAR(64) NOT NULL,
  status VARCHAR(30) NOT NULL DEFAULT 'PROCESSING',
  assinatura_id INTEGER,
  resposta JSONB,
  erro TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT checkout_tentativas_negocio_fk
    FOREIGN KEY (negocio_id)
    REFERENCES negocios(id)
    ON UPDATE CASCADE
    ON DELETE CASCADE,

  CONSTRAINT checkout_tentativas_assinatura_fk
    FOREIGN KEY (assinatura_id)
    REFERENCES assinaturas(id)
    ON UPDATE CASCADE
    ON DELETE SET NULL,

  CONSTRAINT checkout_tentativas_status_valido
    CHECK (status IN ('PROCESSING', 'COMPLETED', 'FAILED')),

  CONSTRAINT checkout_tentativas_negocio_chave_unique
    UNIQUE (negocio_id, chave_idempotencia)
);

CREATE INDEX IF NOT EXISTS checkout_tentativas_status_idx
  ON checkout_tentativas(status);

ALTER TABLE webhook_eventos
  ADD COLUMN IF NOT EXISTS payload JSONB;

ALTER TABLE webhook_eventos
  ADD COLUMN IF NOT EXISTS proxima_tentativa_em TIMESTAMPTZ;

ALTER TABLE webhook_eventos
  DROP CONSTRAINT IF EXISTS webhook_eventos_status_valido;

ALTER TABLE webhook_eventos
  ALTER COLUMN status SET DEFAULT 'PENDING';

ALTER TABLE webhook_eventos
  ALTER COLUMN tentativas SET DEFAULT 0;

ALTER TABLE webhook_eventos
  ADD CONSTRAINT webhook_eventos_status_valido
  CHECK (
    status IN (
      'PENDING',
      'PROCESSING',
      'PROCESSED',
      'IGNORED',
      'FAILED'
    )
  );

CREATE INDEX IF NOT EXISTS webhook_eventos_fila_idx
  ON webhook_eventos(status, proxima_tentativa_em, recebido_em);

COMMIT;
