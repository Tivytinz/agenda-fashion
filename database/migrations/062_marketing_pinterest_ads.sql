BEGIN;

ALTER TABLE marketing_campanha_vinculos
  DROP CONSTRAINT IF EXISTS marketing_campanha_vinculos_provedor_valido;

ALTER TABLE marketing_campanha_vinculos
  ADD CONSTRAINT marketing_campanha_vinculos_provedor_valido
  CHECK (provedor IN ('google_ads', 'meta_ads', 'tiktok_ads', 'pinterest_ads'));

ALTER TABLE marketing_custo_sincronizacoes
  DROP CONSTRAINT IF EXISTS marketing_custo_sincronizacoes_provedor_valido;

ALTER TABLE marketing_custo_sincronizacoes
  ADD CONSTRAINT marketing_custo_sincronizacoes_provedor_valido
  CHECK (provedor IN ('google_ads', 'meta_ads', 'tiktok_ads', 'pinterest_ads'));

CREATE TABLE marketing_pinterest_oauth_states (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  state_hash CHAR(64) NOT NULL UNIQUE,
  usuario_id BIGINT NOT NULL
    REFERENCES usuarios(id)
    ON DELETE CASCADE,
  expires_at TIMESTAMPTZ NOT NULL,
  consumed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT marketing_pinterest_oauth_states_hash_valido
    CHECK (state_hash ~ '^[a-f0-9]{64}$'),
  CONSTRAINT marketing_pinterest_oauth_states_expiracao_valida
    CHECK (expires_at > created_at)
);

CREATE INDEX marketing_pinterest_oauth_states_expiracao_idx
  ON marketing_pinterest_oauth_states (expires_at)
  WHERE consumed_at IS NULL;

CREATE TABLE marketing_pinterest_oauth_credenciais (
  id SMALLINT PRIMARY KEY DEFAULT 1,
  ad_account_id VARCHAR(120) NOT NULL,
  access_token_ciphertext TEXT NOT NULL,
  refresh_token_ciphertext TEXT NOT NULL,
  scope JSONB NOT NULL DEFAULT '[]'::jsonb,
  access_token_expires_at TIMESTAMPTZ,
  refresh_token_expires_at TIMESTAMPTZ,
  autorizado_por_usuario_id BIGINT
    REFERENCES usuarios(id)
    ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT marketing_pinterest_oauth_credenciais_singleton
    CHECK (id = 1),
  CONSTRAINT marketing_pinterest_oauth_credenciais_conta_valida
    CHECK (ad_account_id ~ '^[0-9]+$'),
  CONSTRAINT marketing_pinterest_oauth_credenciais_scope_array
    CHECK (jsonb_typeof(scope) = 'array')
);

COMMENT ON TABLE marketing_pinterest_oauth_states IS
  'States SHA-256 de uso único para o OAuth da API v5 do Pinterest Ads.';

COMMENT ON TABLE marketing_pinterest_oauth_credenciais IS
  'Credenciais OAuth do Pinterest Ads criptografadas no backend. Tokens nunca são expostos ao React.';

COMMENT ON COLUMN marketing_pinterest_oauth_credenciais.access_token_ciphertext IS
  'Access token Pinterest protegido com AES-256-GCM.';

COMMENT ON COLUMN marketing_pinterest_oauth_credenciais.refresh_token_ciphertext IS
  'Refresh token contínuo do Pinterest protegido com AES-256-GCM.';

COMMIT;
