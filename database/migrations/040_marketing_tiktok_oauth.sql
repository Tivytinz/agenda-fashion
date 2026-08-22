BEGIN;

CREATE TABLE marketing_tiktok_oauth_states (
  state_hash CHAR(64) PRIMARY KEY,
  usuario_id BIGINT NOT NULL
    REFERENCES usuarios(id)
    ON DELETE CASCADE,
  redirect_uri VARCHAR(500) NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  consumed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT marketing_tiktok_oauth_states_redirect_valido
    CHECK (CHAR_LENGTH(BTRIM(redirect_uri)) BETWEEN 1 AND 500)
);

CREATE INDEX marketing_tiktok_oauth_states_expires_idx
  ON marketing_tiktok_oauth_states (expires_at);

CREATE TABLE marketing_tiktok_oauth_credenciais (
  id SMALLINT PRIMARY KEY DEFAULT 1,
  advertiser_id VARCHAR(64) NOT NULL,
  access_token_encrypted TEXT NOT NULL,
  refresh_token_encrypted TEXT NOT NULL,
  access_token_expires_at TIMESTAMPTZ NOT NULL,
  refresh_token_expires_at TIMESTAMPTZ NOT NULL,
  scope TEXT,
  open_id VARCHAR(255),
  autorizado_por_usuario_id BIGINT
    REFERENCES usuarios(id)
    ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT marketing_tiktok_oauth_credencial_unica
    CHECK (id = 1),
  CONSTRAINT marketing_tiktok_oauth_advertiser_valido
    CHECK (advertiser_id ~ '^[0-9]+$')
);

COMMENT ON TABLE marketing_tiktok_oauth_states IS
  'States OAuth TikTok de uso único e curta duração. O valor original nunca é persistido.';

COMMENT ON TABLE marketing_tiktok_oauth_credenciais IS
  'Credencial OAuth TikTok criptografada no backend. Tokens nunca são enviados ao frontend.';

COMMIT;
