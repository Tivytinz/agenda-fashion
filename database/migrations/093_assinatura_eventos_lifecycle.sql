BEGIN;

CREATE TABLE IF NOT EXISTS assinatura_eventos (
  id BIGSERIAL PRIMARY KEY,
  negocio_id INTEGER NOT NULL,
  assinatura_id INTEGER,
  pagamento_id INTEGER,
  tipo VARCHAR(60) NOT NULL,
  motivo VARCHAR(60),
  plano_anterior_id INTEGER,
  plano_novo_id INTEGER,
  origem VARCHAR(30) NOT NULL,
  detalhes JSONB NOT NULL DEFAULT '{}'::jsonb,
  ocorrido_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  chave_idempotencia VARCHAR(180) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT assinatura_eventos_negocio_fk
    FOREIGN KEY (negocio_id)
    REFERENCES negocios(id)
    ON UPDATE CASCADE
    ON DELETE CASCADE,

  CONSTRAINT assinatura_eventos_assinatura_fk
    FOREIGN KEY (assinatura_id)
    REFERENCES assinaturas(id)
    ON UPDATE CASCADE
    ON DELETE SET NULL,

  CONSTRAINT assinatura_eventos_pagamento_fk
    FOREIGN KEY (pagamento_id)
    REFERENCES pagamentos(id)
    ON UPDATE CASCADE
    ON DELETE SET NULL,

  CONSTRAINT assinatura_eventos_plano_anterior_fk
    FOREIGN KEY (plano_anterior_id)
    REFERENCES planos(id)
    ON UPDATE CASCADE
    ON DELETE SET NULL,

  CONSTRAINT assinatura_eventos_plano_novo_fk
    FOREIGN KEY (plano_novo_id)
    REFERENCES planos(id)
    ON UPDATE CASCADE
    ON DELETE SET NULL,

  CONSTRAINT assinatura_eventos_tipo_valido
    CHECK (
      tipo IN (
        'CONVERSAO_INICIAL',
        'RENOVACAO_CONFIRMADA',
        'PAGAMENTO_ATRASADO',
        'PAGAMENTO_RECUPERADO',
        'REVERSAO_FINANCEIRA',
        'RENOVACAO_CANCELADA',
        'ACESSO_PAGO_ENCERRADO',
        'REATIVACAO_PAGA',
        'PLANO_ALTERADO'
      )
    ),

  CONSTRAINT assinatura_eventos_origem_valida
    CHECK (
      origem IN (
        'webhook',
        'conta',
        'sistema'
      )
    ),

  CONSTRAINT assinatura_eventos_chave_unique
    UNIQUE (chave_idempotencia)
);

CREATE INDEX IF NOT EXISTS
  assinatura_eventos_negocio_ocorrido_idx
ON assinatura_eventos(
  negocio_id,
  ocorrido_em DESC
);

CREATE INDEX IF NOT EXISTS
  assinatura_eventos_assinatura_ocorrido_idx
ON assinatura_eventos(
  assinatura_id,
  ocorrido_em DESC
)
WHERE assinatura_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS
  assinatura_eventos_tipo_ocorrido_idx
ON assinatura_eventos(
  tipo,
  ocorrido_em DESC
);

CREATE INDEX IF NOT EXISTS
  assinatura_eventos_pagamento_tipo_idx
ON assinatura_eventos(
  pagamento_id,
  tipo
)
WHERE pagamento_id IS NOT NULL;

COMMIT;
