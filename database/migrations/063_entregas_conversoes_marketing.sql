BEGIN;

CREATE TABLE IF NOT EXISTS marketing_conversoes_entregas (
  id BIGSERIAL PRIMARY KEY,
  provedor VARCHAR(20) NOT NULL,
  tipo_evento VARCHAR(60) NOT NULL,
  chave_evento VARCHAR(160) NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
  tentativas INTEGER NOT NULL DEFAULT 0,
  proxima_tentativa_em TIMESTAMPTZ,
  bloqueado_em TIMESTAMPTZ,
  enviado_em TIMESTAMPTZ,
  ultimo_erro TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT marketing_conversoes_provedor_valido
    CHECK (provedor IN ('meta', 'google')),

  CONSTRAINT marketing_conversoes_status_valido
    CHECK (
      status IN (
        'PENDING',
        'PROCESSING',
        'SENT',
        'IGNORED',
        'FAILED'
      )
    ),

  CONSTRAINT marketing_conversoes_tentativas_validas
    CHECK (tentativas >= 0),

  CONSTRAINT marketing_conversoes_evento_unique
    UNIQUE (
      provedor,
      tipo_evento,
      chave_evento
    )
);

CREATE INDEX IF NOT EXISTS
  marketing_conversoes_fila_idx
ON marketing_conversoes_entregas (
  status,
  proxima_tentativa_em,
  created_at
);

CREATE INDEX IF NOT EXISTS
  marketing_conversoes_criado_idx
ON marketing_conversoes_entregas (
  created_at DESC
);

COMMIT;
