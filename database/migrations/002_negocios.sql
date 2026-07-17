BEGIN;

CREATE TABLE negocios (
  id BIGINT
    GENERATED ALWAYS AS IDENTITY
    PRIMARY KEY,

  nome VARCHAR(120)
    NOT NULL,

  slug VARCHAR(160)
    NOT NULL,

  descricao VARCHAR(1200),

  setor VARCHAR(80),

  whatsapp VARCHAR(11),

  foto_url TEXT,

  foto_public_id VARCHAR(255),

  cidade VARCHAR(100),

  estado VARCHAR(2),

  bairro VARCHAR(100),

  endereco VARCHAR(180),

  numero VARCHAR(20),

  complemento VARCHAR(120),

  cep VARCHAR(8),

  localizacao_url TEXT,

  latitude NUMERIC(9, 6),

  longitude NUMERIC(9, 6),

  fuso_horario VARCHAR(64)
    NOT NULL
    DEFAULT 'America/Sao_Paulo',

  ativo BOOLEAN
    NOT NULL
    DEFAULT TRUE,

  publicado BOOLEAN
    NOT NULL
    DEFAULT FALSE,

  created_at TIMESTAMPTZ
    NOT NULL
    DEFAULT NOW(),

  updated_at TIMESTAMPTZ
    NOT NULL
    DEFAULT NOW(),

  CONSTRAINT negocios_nome_valido
    CHECK (
      CHAR_LENGTH(
        BTRIM(nome)
      ) BETWEEN 2 AND 120
    ),

  CONSTRAINT negocios_slug_valido
    CHECK (
      slug = LOWER(slug)
      AND slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'
    ),

  CONSTRAINT negocios_descricao_valida
    CHECK (
      descricao IS NULL
      OR CHAR_LENGTH(descricao) <= 1200
    ),

  CONSTRAINT negocios_whatsapp_valido
    CHECK (
      whatsapp IS NULL
      OR whatsapp ~ '^[0-9]{10,11}$'
    ),

  CONSTRAINT negocios_estado_valido
    CHECK (
      estado IS NULL
      OR estado ~ '^[A-Z]{2}$'
    ),

  CONSTRAINT negocios_cep_valido
    CHECK (
      cep IS NULL
      OR cep ~ '^[0-9]{8}$'
    ),

  CONSTRAINT negocios_latitude_valida
    CHECK (
      latitude IS NULL
      OR latitude BETWEEN -90 AND 90
    ),

  CONSTRAINT negocios_longitude_valida
    CHECK (
      longitude IS NULL
      OR longitude BETWEEN -180 AND 180
    ),

  CONSTRAINT negocios_coordenadas_completas
    CHECK (
      (
        latitude IS NULL
        AND longitude IS NULL
      )
      OR
      (
        latitude IS NOT NULL
        AND longitude IS NOT NULL
      )
    ),

  CONSTRAINT negocios_fuso_horario_valido
    CHECK (
      CHAR_LENGTH(
        BTRIM(fuso_horario)
      ) BETWEEN 3 AND 64
    )
);

CREATE UNIQUE INDEX negocios_slug_unique
  ON negocios (slug);

CREATE INDEX negocios_publicos_idx
  ON negocios (
    ativo,
    publicado,
    created_at DESC
  );

CREATE INDEX negocios_cidade_idx
  ON negocios (
    LOWER(cidade)
  )
  WHERE cidade IS NOT NULL;

CREATE INDEX negocios_setor_idx
  ON negocios (
    LOWER(setor)
  )
  WHERE setor IS NOT NULL;

CREATE TRIGGER trigger_negocios_updated_at
  BEFORE UPDATE
  ON negocios
  FOR EACH ROW
  EXECUTE FUNCTION atualizar_updated_at();

COMMENT ON TABLE negocios IS
  'Estabelecimentos cadastrados na plataforma.';

COMMENT ON COLUMN negocios.slug IS
  'Identificador público utilizado na URL do perfil.';

COMMENT ON COLUMN negocios.ativo IS
  'Controla se o negócio pode operar na plataforma.';

COMMENT ON COLUMN negocios.publicado IS
  'Controla se o perfil pode aparecer publicamente.';

COMMENT ON COLUMN negocios.fuso_horario IS
  'Fuso usado no cálculo dos horários e agendamentos.';

COMMIT;