BEGIN;

ALTER TABLE marketing_usuario_atribuicoes
  ADD COLUMN IF NOT EXISTS last_utm_source VARCHAR(80),
  ADD COLUMN IF NOT EXISTS last_utm_medium VARCHAR(80),
  ADD COLUMN IF NOT EXISTS last_utm_campaign VARCHAR(140),
  ADD COLUMN IF NOT EXISTS last_utm_content VARCHAR(140),
  ADD COLUMN IF NOT EXISTS last_utm_term VARCHAR(140),
  ADD COLUMN IF NOT EXISTS last_gclid VARCHAR(160),
  ADD COLUMN IF NOT EXISTS last_fbclid VARCHAR(160),
  ADD COLUMN IF NOT EXISTS last_landing_page VARCHAR(500);

UPDATE marketing_usuario_atribuicoes
SET
  last_utm_source = COALESCE(last_utm_source, utm_source),
  last_utm_medium = COALESCE(last_utm_medium, utm_medium),
  last_utm_campaign = COALESCE(last_utm_campaign, utm_campaign),
  last_utm_content = COALESCE(last_utm_content, utm_content),
  last_utm_term = COALESCE(last_utm_term, utm_term),
  last_gclid = COALESCE(last_gclid, gclid),
  last_fbclid = COALESCE(last_fbclid, fbclid),
  last_landing_page = COALESCE(last_landing_page, landing_page)
WHERE
  last_utm_source IS NULL
  OR last_utm_medium IS NULL
  OR last_utm_campaign IS NULL
  OR last_utm_content IS NULL
  OR last_utm_term IS NULL
  OR last_gclid IS NULL
  OR last_fbclid IS NULL
  OR last_landing_page IS NULL;

ALTER TABLE marketing_usuario_atribuicoes
  DROP CONSTRAINT IF EXISTS marketing_usuario_atribuicoes_last_landing_interna;

ALTER TABLE marketing_usuario_atribuicoes
  ADD CONSTRAINT marketing_usuario_atribuicoes_last_landing_interna
    CHECK (
      last_landing_page IS NULL
      OR (
        LEFT(last_landing_page, 1) = '/'
        AND LEFT(last_landing_page, 2) <> '//'
        AND POSITION(E'\\' IN last_landing_page) = 0
      )
    );

CREATE INDEX IF NOT EXISTS marketing_usuario_atribuicoes_last_campanha_idx
  ON marketing_usuario_atribuicoes (
    last_utm_source,
    last_utm_medium,
    last_utm_campaign
  );

COMMIT;
