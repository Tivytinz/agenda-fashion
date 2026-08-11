BEGIN;

CREATE TABLE marketing_campanhas (
  id BIGINT
    GENERATED ALWAYS AS IDENTITY
    PRIMARY KEY,

  nome VARCHAR(140)
    NOT NULL,

  canal VARCHAR(40)
    NOT NULL,

  utm_source VARCHAR(80)
    NOT NULL,

  utm_medium VARCHAR(80)
    NOT NULL
    DEFAULT 'cpc',

  utm_campaign VARCHAR(140)
    NOT NULL,

  utm_content VARCHAR(140),

  utm_term VARCHAR(140),

  destino_path VARCHAR(500)
    NOT NULL
    DEFAULT '/',

  ativo BOOLEAN
    NOT NULL
    DEFAULT TRUE,

  criado_por_usuario_id BIGINT
    REFERENCES usuarios(id)
    ON DELETE SET NULL,

  created_at TIMESTAMPTZ
    NOT NULL
    DEFAULT NOW(),

  updated_at TIMESTAMPTZ
    NOT NULL
    DEFAULT NOW(),

  CONSTRAINT marketing_campanhas_nome_valido
    CHECK (
      LENGTH(BTRIM(nome)) BETWEEN 2 AND 140
    ),

  CONSTRAINT marketing_campanhas_canal_valido
    CHECK (
      canal ~ '^[a-z0-9]+([_-][a-z0-9]+)*$'
    ),

  CONSTRAINT marketing_campanhas_source_valido
    CHECK (
      utm_source ~ '^[a-z0-9]+([_-][a-z0-9]+)*$'
    ),

  CONSTRAINT marketing_campanhas_medium_valido
    CHECK (
      utm_medium ~ '^[a-z0-9]+([_-][a-z0-9]+)*$'
    ),

  CONSTRAINT marketing_campanhas_campaign_valido
    CHECK (
      utm_campaign ~ '^[a-z0-9]+([_-][a-z0-9]+)*$'
    ),

  CONSTRAINT marketing_campanhas_content_valido
    CHECK (
      utm_content IS NULL
      OR utm_content ~ '^[a-z0-9]+([_-][a-z0-9]+)*$'
    ),

  CONSTRAINT marketing_campanhas_term_valido
    CHECK (
      utm_term IS NULL
      OR utm_term ~ '^[a-z0-9]+([_-][a-z0-9]+)*$'
    ),

  CONSTRAINT marketing_campanhas_destino_interno
    CHECK (
      LEFT(destino_path, 1) = '/'
      AND LEFT(destino_path, 2) <> '//'
      AND POSITION(E'\\' IN destino_path) = 0
    ),

  CONSTRAINT marketing_campanhas_identidade_unique
    UNIQUE (
      utm_source,
      utm_medium,
      utm_campaign
    )
);

CREATE INDEX marketing_campanhas_ativas_idx
  ON marketing_campanhas (
    ativo,
    created_at DESC
  );

COMMENT ON TABLE marketing_campanhas IS
  'Campanhas de aquisição criadas pelos administradores do Agenda Fashion para gerar links rastreáveis e preservar a identidade de atribuição.';

COMMENT ON COLUMN marketing_campanhas.destino_path IS
  'Caminho interno do Agenda Fashion. URLs externas não são aceitas para evitar redirecionamentos abertos.';

COMMIT;
