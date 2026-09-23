BEGIN;

INSERT INTO financeiro_marcos (
  chave,
  detalhes
)
VALUES (
  'economia_liquida_v1_inicio',
  jsonb_build_object(
    'regra', 'economia_liquida_gateway_v1',
    'unidade', 'pagamento',
    'fonte', 'asaas',
    'janelas_dias', jsonb_build_array(30, 60, 90),
    'historico_anterior', 'nao_inferido',
    'margem_contribuicao_disponivel', false,
    'payback_economico_disponivel', false
  )
)
ON CONFLICT (chave)
DO NOTHING;

CREATE TABLE pagamento_economia (
  pagamento_id INTEGER
    PRIMARY KEY
    REFERENCES pagamentos(id)
    ON DELETE CASCADE,

  asaas_payment_id VARCHAR(120)
    NOT NULL,

  valor_bruto NUMERIC(12, 2)
    NOT NULL,

  valor_liquido_gateway NUMERIC(12, 2),

  data_credito DATE,

  status_pagamento_snapshot VARCHAR(40)
    NOT NULL,

  status_reconciliacao VARCHAR(40)
    NOT NULL,

  ultimo_evento_asaas_em TIMESTAMP
    WITHOUT TIME ZONE,

  ultimo_evento_asaas_id VARCHAR(160),

  proxima_reconciliacao_em TIMESTAMPTZ,

  sincronizado_em TIMESTAMPTZ
    NOT NULL
    DEFAULT NOW(),

  created_at TIMESTAMPTZ
    NOT NULL
    DEFAULT NOW(),

  updated_at TIMESTAMPTZ
    NOT NULL
    DEFAULT NOW(),

  CONSTRAINT pagamento_economia_valor_bruto_valido
    CHECK (valor_bruto >= 0),

  CONSTRAINT pagamento_economia_valor_liquido_valido
    CHECK (
      valor_liquido_gateway IS NULL
      OR valor_liquido_gateway >= 0
    ),

  CONSTRAINT pagamento_economia_status_valido
    CHECK (
      status_reconciliacao IN (
        'COMPLETO',
        'AGUARDANDO_LIQUIDACAO',
        'REFUND_EM_PROCESSAMENTO',
        'CHARGEBACK_EM_DISPUTA',
        'REVERSAO_NAO_RECONCILIADA',
        'DADOS_GATEWAY_INCOMPLETOS'
      )
    )
);

CREATE INDEX
  pagamento_economia_status_proxima_idx
ON pagamento_economia (
  status_reconciliacao,
  proxima_reconciliacao_em,
  pagamento_id
);

CREATE TABLE pagamento_estornos (
  id BIGINT
    GENERATED ALWAYS AS IDENTITY
    PRIMARY KEY,

  pagamento_id INTEGER
    NOT NULL
    REFERENCES pagamentos(id)
    ON DELETE CASCADE,

  chave_provedor VARCHAR(64)
    NOT NULL,

  valor NUMERIC(12, 2)
    NOT NULL,

  status_provedor VARCHAR(20)
    NOT NULL,

  ocorrido_em TIMESTAMP
    WITHOUT TIME ZONE,

  created_at TIMESTAMPTZ
    NOT NULL
    DEFAULT NOW(),

  updated_at TIMESTAMPTZ
    NOT NULL
    DEFAULT NOW(),

  CONSTRAINT pagamento_estornos_valor_valido
    CHECK (valor >= 0),

  CONSTRAINT pagamento_estornos_status_valido
    CHECK (
      status_provedor IN (
        'PENDING',
        'CANCELLED',
        'DONE',
        'UNKNOWN'
      )
    ),

  CONSTRAINT pagamento_estornos_chave_unica
    UNIQUE (
      pagamento_id,
      chave_provedor
    )
);

CREATE INDEX
  pagamento_estornos_pagamento_status_idx
ON pagamento_estornos (
  pagamento_id,
  status_provedor,
  ocorrido_em
);

COMMENT ON TABLE pagamento_economia IS
  'Snapshot econômico reconciliado da cobrança Asaas. Mantém valor bruto, netValue observado e cobertura sem alterar entitlement.';

COMMENT ON COLUMN pagamento_economia.valor_liquido_gateway IS
  'netValue retornado pelo Asaas. NULL significa dado econômico ainda não disponível; nunca deve ser interpretado como taxa zero.';

COMMENT ON TABLE pagamento_estornos IS
  'Ledger idempotente de estornos retornados pelo Asaas. Somente status DONE reduz receita líquida observada.';

COMMIT;
