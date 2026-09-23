BEGIN;

INSERT INTO financeiro_marcos (
  chave,
  detalhes
)
VALUES (
  'margem_contribuicao_v1_inicio',
  jsonb_build_object(
    'regra', 'margem_contribuicao_observada_v1',
    'unidade', 'negocio',
    'receita_base', 'liquida_gateway',
    'custos', 'variaveis_observados',
    'janelas_dias', jsonb_build_array(30, 60, 90),
    'historico_anterior', 'nao_inferido',
    'fontes_iniciais', 0,
    'lucro_disponivel', false,
    'payback_economico_disponivel', false
  )
)
ON CONFLICT (chave)
DO NOTHING;

CREATE TABLE contribuicao_fontes (
  id BIGINT
    GENERATED ALWAYS AS IDENTITY
    PRIMARY KEY,

  codigo VARCHAR(80)
    NOT NULL
    UNIQUE,

  nome VARCHAR(140)
    NOT NULL,

  categoria VARCHAR(80)
    NOT NULL,

  ativa BOOLEAN
    NOT NULL
    DEFAULT TRUE,

  obrigatoria_para_margem BOOLEAN
    NOT NULL
    DEFAULT TRUE,

  created_at TIMESTAMPTZ
    NOT NULL
    DEFAULT NOW(),

  updated_at TIMESTAMPTZ
    NOT NULL
    DEFAULT NOW(),

  CONSTRAINT contribuicao_fontes_codigo_valido
    CHECK (
      codigo ~ '^[a-z0-9][a-z0-9_-]{1,79}$'
    ),

  CONSTRAINT contribuicao_fontes_categoria_valida
    CHECK (
      LENGTH(TRIM(categoria)) >= 2
    )
);

CREATE TABLE contribuicao_custos (
  id BIGINT
    GENERATED ALWAYS AS IDENTITY
    PRIMARY KEY,

  fonte_id BIGINT
    NOT NULL
    REFERENCES contribuicao_fontes(id)
    ON DELETE RESTRICT,

  negocio_id BIGINT
    NOT NULL
    REFERENCES negocios(id)
    ON DELETE RESTRICT,

  chave_origem VARCHAR(160)
    NOT NULL,

  tipo VARCHAR(20)
    NOT NULL,

  valor NUMERIC(14, 2)
    NOT NULL,

  ocorrido_em TIMESTAMPTZ
    NOT NULL,

  custo_referenciado_id BIGINT
    REFERENCES contribuicao_custos(id)
    ON DELETE RESTRICT,

  detalhes JSONB
    NOT NULL
    DEFAULT '{}'::jsonb,

  created_at TIMESTAMPTZ
    NOT NULL
    DEFAULT NOW(),

  CONSTRAINT contribuicao_custos_tipo_valido
    CHECK (
      tipo IN (
        'DEBITO',
        'CREDITO'
      )
    ),

  CONSTRAINT contribuicao_custos_valor_valido
    CHECK (valor >= 0),

  CONSTRAINT contribuicao_custos_chave_valida
    CHECK (
      LENGTH(TRIM(chave_origem)) >= 1
    ),

  CONSTRAINT contribuicao_custos_origem_unica
    UNIQUE (
      fonte_id,
      chave_origem
    )
);

CREATE INDEX
  contribuicao_custos_negocio_data_idx
ON contribuicao_custos (
  negocio_id,
  ocorrido_em,
  id
);

CREATE INDEX
  contribuicao_custos_fonte_data_idx
ON contribuicao_custos (
  fonte_id,
  ocorrido_em,
  id
);

CREATE TABLE contribuicao_cobertura (
  fonte_id BIGINT
    PRIMARY KEY
    REFERENCES contribuicao_fontes(id)
    ON DELETE RESTRICT,

  inicio_cobertura DATE
    NOT NULL,

  coberto_ate DATE,

  status VARCHAR(20)
    NOT NULL,

  sincronizado_em TIMESTAMPTZ
    NOT NULL
    DEFAULT NOW(),

  updated_at TIMESTAMPTZ
    NOT NULL
    DEFAULT NOW(),

  CONSTRAINT contribuicao_cobertura_status_valido
    CHECK (
      status IN (
        'COMPLETA',
        'INCOMPLETA'
      )
    ),

  CONSTRAINT contribuicao_cobertura_intervalo_valido
    CHECK (
      coberto_ate IS NULL
      OR coberto_ate >= inicio_cobertura
    )
);

COMMENT ON TABLE contribuicao_fontes IS
  'Registro de fontes factuais de custos variaveis atribuiveis. A migration 100 nao cadastra fonte por suposicao.';

COMMENT ON TABLE contribuicao_custos IS
  'Ledger append-only e idempotente de custos variaveis observados por negocio. Midia de aquisicao permanece fora desta camada.';

COMMENT ON COLUMN contribuicao_custos.tipo IS
  'DEBITO aumenta custo de contribuicao; CREDITO corrige ou devolve custo sem apagar o fato anterior.';

COMMENT ON TABLE contribuicao_cobertura IS
  'Watermark continuo por fonte. Ausencia de lancamento so pode significar custo zero dentro de cobertura completa declarada pela propria fonte.';

COMMIT;
