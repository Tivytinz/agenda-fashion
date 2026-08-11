BEGIN;

ALTER TABLE marketing_usuario_atribuicoes
  ADD COLUMN IF NOT EXISTS google_consentido_em TIMESTAMPTZ;

ALTER TABLE marketing_usuario_atribuicoes
  ADD COLUMN IF NOT EXISTS google_client_id VARCHAR(120);

ALTER TABLE marketing_usuario_atribuicoes
  DROP CONSTRAINT IF EXISTS marketing_usuario_atribuicoes_google_client_id_valido;

ALTER TABLE marketing_usuario_atribuicoes
  ADD CONSTRAINT marketing_usuario_atribuicoes_google_client_id_valido
  CHECK (
    google_client_id IS NULL
    OR google_client_id ~ '^[A-Za-z0-9._-]{4,120}$'
  );

COMMENT ON COLUMN marketing_usuario_atribuicoes.google_consentido_em IS
  'Momento em que o usuário autorizou a medição opcional do Google Analytics e Google Ads.';

COMMENT ON COLUMN marketing_usuario_atribuicoes.google_client_id IS
  'Identificador pseudônimo client_id do GA4, persistido apenas enquanto houver consentimento de marketing.';

COMMIT;
