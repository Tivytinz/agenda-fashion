BEGIN;

-- =========================================================
-- ÁREAS ATENDIDAS PELO NEGÓCIO
-- Ex.: Cabelo, Unha, Estética, Massagem
-- =========================================================

ALTER TABLE negocios
  ADD COLUMN IF NOT EXISTS
    areas TEXT[];

UPDATE negocios
SET areas = ARRAY[]::TEXT[]
WHERE areas IS NULL;

ALTER TABLE negocios
  ALTER COLUMN areas
  SET DEFAULT ARRAY[]::TEXT[];

ALTER TABLE negocios
  ALTER COLUMN areas
  SET NOT NULL;

-- Evita listas excessivamente grandes.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname =
      'negocios_areas_quantidade_check'
  ) THEN
    ALTER TABLE negocios
      ADD CONSTRAINT
        negocios_areas_quantidade_check
      CHECK (
        CARDINALITY(areas) <= 30
      );
  END IF;
END;
$$;

-- Permite pesquisas eficientes por área.

CREATE INDEX IF NOT EXISTS
  negocios_areas_gin_idx
ON negocios
USING GIN (
  areas
);

COMMENT ON COLUMN negocios.areas IS
  'Lista das áreas e especialidades atendidas pelo negócio.';

COMMIT;