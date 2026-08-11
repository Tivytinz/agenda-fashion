BEGIN;

CREATE TABLE marketing_campanha_gastos (
  id BIGINT
    GENERATED ALWAYS AS IDENTITY
    PRIMARY KEY,

  campanha_id BIGINT
    NOT NULL
    REFERENCES marketing_campanhas(id)
    ON DELETE RESTRICT,

  data_gasto DATE
    NOT NULL,

  valor_centavos BIGINT
    NOT NULL,

  moeda CHAR(3)
    NOT NULL
    DEFAULT 'BRL',

  fonte VARCHAR(32)
    NOT NULL
    DEFAULT 'manual',

  observacao VARCHAR(240),

  criado_por_usuario_id BIGINT
    REFERENCES usuarios(id)
    ON DELETE SET NULL,

  atualizado_por_usuario_id BIGINT
    REFERENCES usuarios(id)
    ON DELETE SET NULL,

  created_at TIMESTAMPTZ
    NOT NULL
    DEFAULT NOW(),

  updated_at TIMESTAMPTZ
    NOT NULL
    DEFAULT NOW(),

  CONSTRAINT marketing_campanha_gastos_valor_positivo
    CHECK (valor_centavos > 0),

  CONSTRAINT marketing_campanha_gastos_moeda_valida
    CHECK (moeda ~ '^[A-Z]{3}$'),

  CONSTRAINT marketing_campanha_gastos_fonte_valida
    CHECK (
      fonte ~ '^[a-z0-9]+([_-][a-z0-9]+)*$'
    ),

  CONSTRAINT marketing_campanha_gastos_dia_fonte_unique
    UNIQUE (
      campanha_id,
      data_gasto,
      fonte
    )
);

CREATE INDEX marketing_campanha_gastos_campanha_data_idx
  ON marketing_campanha_gastos (
    campanha_id,
    data_gasto DESC
  );

CREATE INDEX marketing_campanha_gastos_data_idx
  ON marketing_campanha_gastos (
    data_gasto DESC
  );

COMMENT ON TABLE marketing_campanha_gastos IS
  'Gasto diário por campanha de aquisição. O registro manual do mesmo dia é atualizado para evitar soma duplicada e preservar CPA por período.';

COMMENT ON COLUMN marketing_campanha_gastos.valor_centavos IS
  'Valor monetário armazenado em centavos para evitar erro de ponto flutuante.';

COMMENT ON COLUMN marketing_campanha_gastos.fonte IS
  'Origem do dado de custo. A fase inicial usa manual e permite integrações futuras sem alterar o modelo.';

COMMIT;
