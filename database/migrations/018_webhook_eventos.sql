BEGIN;

CREATE TABLE IF NOT EXISTS webhook_eventos (
  id BIGSERIAL PRIMARY KEY,

  provedor VARCHAR(30) NOT NULL,

  evento_id VARCHAR(160) NOT NULL,

  tipo_evento VARCHAR(100) NOT NULL,

  recurso_id VARCHAR(160),

  status VARCHAR(30) NOT NULL
    DEFAULT 'PROCESSING',

  tentativas INTEGER NOT NULL
    DEFAULT 1,

  erro TEXT,

  recebido_em TIMESTAMPTZ NOT NULL
    DEFAULT NOW(),

  ultima_tentativa_em TIMESTAMPTZ
    NOT NULL DEFAULT NOW(),

  processado_em TIMESTAMPTZ,

  CONSTRAINT
    webhook_eventos_status_valido
  CHECK (
    status IN (
      'PROCESSING',
      'PROCESSED',
      'IGNORED',
      'FAILED'
    )
  ),

  CONSTRAINT
    webhook_eventos_tentativas_validas
  CHECK (tentativas > 0),

  CONSTRAINT
    webhook_eventos_provedor_evento_unique
  UNIQUE (
    provedor,
    evento_id
  )
);

CREATE INDEX IF NOT EXISTS
  webhook_eventos_status_idx
ON webhook_eventos(status);

CREATE INDEX IF NOT EXISTS
  webhook_eventos_tipo_evento_idx
ON webhook_eventos(tipo_evento);

CREATE INDEX IF NOT EXISTS
  webhook_eventos_recurso_id_idx
ON webhook_eventos(recurso_id);

COMMIT;
