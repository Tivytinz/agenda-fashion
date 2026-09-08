BEGIN;

ALTER TABLE marketing_campanha_vinculos
  DROP CONSTRAINT IF EXISTS marketing_campanha_vinculos_provedor_valido;

ALTER TABLE marketing_campanha_vinculos
  ADD CONSTRAINT marketing_campanha_vinculos_provedor_valido
  CHECK (provedor IN ('google_ads', 'meta_ads', 'tiktok_ads'));

ALTER TABLE marketing_custo_sincronizacoes
  DROP CONSTRAINT IF EXISTS marketing_custo_sincronizacoes_provedor_valido;

ALTER TABLE marketing_custo_sincronizacoes
  ADD CONSTRAINT marketing_custo_sincronizacoes_provedor_valido
  CHECK (provedor IN ('google_ads', 'meta_ads', 'tiktok_ads'));

CREATE TABLE marketing_tiktok_oauth_states (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  state_hash CHAR(64) NOT NULL UNIQUE,
  usuario_id BIGINT NOT NULL
    REFERENCES usuarios(id)
    ON DELETE CASCADE,
  expires_at TIMESTAMPTZ NOT NULL,
  consumed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT marketing_tiktok_oauth_states_hash_valido
    CHECK (state_hash ~ '^[a-f0-9]{64}$'),
  CONSTRAINT marketing_tiktok_oauth_states_expiracao_valida
    CHECK (expires_at > created_at)
);

CREATE INDEX marketing_tiktok_oauth_states_expiracao_idx
  ON marketing_tiktok_oauth_states (expires_at)
  WHERE consumed_at IS NULL;

CREATE TABLE marketing_tiktok_oauth_credenciais (
  id SMALLINT PRIMARY KEY DEFAULT 1,
  advertiser_id VARCHAR(120) NOT NULL,
  access_token_ciphertext TEXT NOT NULL,
  scope JSONB NOT NULL DEFAULT '[]'::jsonb,
  authorized_advertiser_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
  autorizado_por_usuario_id BIGINT
    REFERENCES usuarios(id)
    ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT marketing_tiktok_oauth_credenciais_singleton
    CHECK (id = 1),
  CONSTRAINT marketing_tiktok_oauth_credenciais_advertiser_valido
    CHECK (advertiser_id ~ '^[0-9]+$'),
  CONSTRAINT marketing_tiktok_oauth_credenciais_scope_array
    CHECK (jsonb_typeof(scope) = 'array'),
  CONSTRAINT marketing_tiktok_oauth_credenciais_advertisers_array
    CHECK (jsonb_typeof(authorized_advertiser_ids) = 'array')
);

COMMENT ON TABLE marketing_tiktok_oauth_states IS
  'States SHA-256 de uso único para o OAuth da Marketing API do TikTok Ads.';

COMMENT ON TABLE marketing_tiktok_oauth_credenciais IS
  'Credencial TikTok Ads criptografada no backend. O access token nunca é exposto ao React.';

COMMENT ON COLUMN marketing_tiktok_oauth_credenciais.access_token_ciphertext IS
  'Access token de longo prazo do TikTok Marketing API protegido com AES-256-GCM.';

COMMIT;
