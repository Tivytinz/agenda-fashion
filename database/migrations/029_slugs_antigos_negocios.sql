BEGIN;

CREATE TABLE negocios_slugs_antigos (
  id BIGINT
    GENERATED ALWAYS AS IDENTITY
    PRIMARY KEY,

  negocio_id BIGINT
    NOT NULL
    REFERENCES negocios(id)
    ON DELETE CASCADE,

  slug VARCHAR(160)
    NOT NULL,

  created_at TIMESTAMPTZ
    NOT NULL
    DEFAULT NOW(),

  CONSTRAINT negocios_slugs_antigos_slug_valido
    CHECK (
      slug = LOWER(slug)
      AND slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'
    ),

  CONSTRAINT negocios_slugs_antigos_slug_unique
    UNIQUE (slug)
);

CREATE INDEX negocios_slugs_antigos_negocio_idx
  ON negocios_slugs_antigos (negocio_id);

COMMENT ON TABLE negocios_slugs_antigos IS
  'Endereços públicos antigos preservados para localizar o negócio após uma troca de slug.';

/*
 * Corrige o negócio que motivou esta migration sem atingir
 * registros de outras contas. Se o novo endereço já estiver
 * ocupado, a alteração fica disponível pela tela de edição.
 */
WITH negocio_alvo AS (
  SELECT id, slug
  FROM negocios
  WHERE slug = 'victor'
    AND LOWER(BTRIM(nome)) = 'beauty vanessa'
    AND NOT EXISTS (
      SELECT 1
      FROM negocios
      WHERE slug = 'beauty-vanessa'
    )
  LIMIT 1
),
alias_inserido AS (
  INSERT INTO negocios_slugs_antigos (
    negocio_id,
    slug
  )
  SELECT id, slug
  FROM negocio_alvo
  ON CONFLICT (slug) DO NOTHING
  RETURNING negocio_id
)
UPDATE negocios
SET
  slug = 'beauty-vanessa',
  updated_at = NOW()
WHERE id IN (
  SELECT negocio_id
  FROM alias_inserido
);

COMMIT;
