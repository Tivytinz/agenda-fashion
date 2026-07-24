BEGIN;

/* =========================================================
   ASSINATURAS
========================================================= */

CREATE TABLE IF NOT EXISTS assinaturas (
  id SERIAL PRIMARY KEY,

  negocio_id INTEGER NOT NULL,

  plano_id INTEGER NOT NULL,

  asaas_customer_id VARCHAR(120),

  asaas_subscription_id VARCHAR(120),

  status VARCHAR(40) NOT NULL DEFAULT 'PENDING',

  forma_pagamento VARCHAR(40),

  periodicidade VARCHAR(30) NOT NULL DEFAULT 'MONTHLY',

  valor NUMERIC(10, 2) NOT NULL DEFAULT 0,

  data_proxima_cobranca DATE,

  ativo BOOLEAN NOT NULL DEFAULT FALSE,

  observacoes TEXT,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT assinaturas_negocio_fk
    FOREIGN KEY (negocio_id)
    REFERENCES negocios(id)
    ON UPDATE CASCADE
    ON DELETE CASCADE,

  CONSTRAINT assinaturas_plano_fk
    FOREIGN KEY (plano_id)
    REFERENCES planos(id)
    ON UPDATE CASCADE
    ON DELETE RESTRICT,

  CONSTRAINT assinaturas_valor_valido
    CHECK (valor >= 0)
);

/*
 * Um identificador de assinatura do Asaas
 * não pode pertencer a duas assinaturas.
 */
CREATE UNIQUE INDEX IF NOT EXISTS
  assinaturas_asaas_subscription_unique
ON assinaturas(asaas_subscription_id)
WHERE asaas_subscription_id IS NOT NULL;

/*
 * Mantém somente uma assinatura ativa
 * por negócio.
 */
CREATE UNIQUE INDEX IF NOT EXISTS
  assinaturas_negocio_ativa_unique
ON assinaturas(negocio_id)
WHERE ativo = TRUE;

CREATE INDEX IF NOT EXISTS
  assinaturas_negocio_id_idx
ON assinaturas(negocio_id);

CREATE INDEX IF NOT EXISTS
  assinaturas_plano_id_idx
ON assinaturas(plano_id);

CREATE INDEX IF NOT EXISTS
  assinaturas_status_idx
ON assinaturas(status);

/* =========================================================
   PAGAMENTOS
========================================================= */

CREATE TABLE IF NOT EXISTS pagamentos (
  id SERIAL PRIMARY KEY,

  assinatura_id INTEGER NOT NULL,

  asaas_payment_id VARCHAR(120),

  valor NUMERIC(10, 2) NOT NULL DEFAULT 0,

  forma_pagamento VARCHAR(40),

  status VARCHAR(40) NOT NULL DEFAULT 'PENDING',

  data_vencimento DATE,

  data_pagamento DATE,

  invoice_url TEXT,

  external_reference VARCHAR(255),

  observacoes TEXT,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT pagamentos_assinatura_fk
    FOREIGN KEY (assinatura_id)
    REFERENCES assinaturas(id)
    ON UPDATE CASCADE
    ON DELETE CASCADE,

  CONSTRAINT pagamentos_valor_valido
    CHECK (valor >= 0)
);

CREATE UNIQUE INDEX IF NOT EXISTS
  pagamentos_asaas_payment_unique
ON pagamentos(asaas_payment_id)
WHERE asaas_payment_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS
  pagamentos_assinatura_id_idx
ON pagamentos(assinatura_id);

CREATE INDEX IF NOT EXISTS
  pagamentos_status_idx
ON pagamentos(status);

CREATE INDEX IF NOT EXISTS
  pagamentos_vencimento_idx
ON pagamentos(data_vencimento);

COMMIT;