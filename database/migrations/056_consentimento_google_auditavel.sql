BEGIN;

ALTER TABLE marketing_usuario_atribuicoes
  ADD COLUMN IF NOT EXISTS
    google_consentimento_status BOOLEAN;

ALTER TABLE marketing_usuario_atribuicoes
  ADD COLUMN IF NOT EXISTS
    google_consentimento_atualizado_em TIMESTAMPTZ;

ALTER TABLE marketing_usuario_atribuicoes
  ADD COLUMN IF NOT EXISTS
    google_revogado_em TIMESTAMPTZ;

ALTER TABLE marketing_usuario_atribuicoes
  ADD CONSTRAINT marketing_usuario_atribuicoes_google_estado_coerente
  CHECK (
    google_consentimento_status IS NULL
    OR (
      google_consentimento_status = TRUE
      AND google_consentimento_atualizado_em IS NOT NULL
      AND google_consentido_em IS NOT NULL
      AND google_revogado_em IS NULL
    )
    OR (
      google_consentimento_status = FALSE
      AND google_consentimento_atualizado_em IS NOT NULL
      AND google_consentido_em IS NULL
      AND google_revogado_em IS NOT NULL
      AND google_client_id IS NULL
    )
  )
  NOT VALID;

UPDATE marketing_usuario_atribuicoes
SET
  google_consentimento_status = TRUE,
  google_consentimento_atualizado_em =
    google_consentido_em,
  google_revogado_em = NULL
WHERE google_consentido_em IS NOT NULL
  AND google_consentimento_status IS NULL;

CREATE TABLE IF NOT EXISTS
  marketing_google_consentimentos (
    id BIGSERIAL PRIMARY KEY,
    usuario_id BIGINT
      NOT NULL
      REFERENCES usuarios(id)
      ON DELETE CASCADE,
    consentido BOOLEAN
      NOT NULL,
    origem VARCHAR(40)
      NOT NULL,
    texto_versao VARCHAR(60)
      NOT NULL,
    created_at TIMESTAMPTZ
      NOT NULL
      DEFAULT NOW(),

    CONSTRAINT marketing_google_consentimentos_origem_valida
      CHECK (
        origem ~ '^[A-Z0-9_]{3,40}$'
      ),
    CONSTRAINT marketing_google_consentimentos_texto_versao_valida
      CHECK (
        texto_versao ~ '^[A-Za-z0-9._:-]{4,60}$'
      )
  );

INSERT INTO marketing_google_consentimentos (
  usuario_id,
  consentido,
  origem,
  texto_versao,
  created_at
)
SELECT
  mua.usuario_id,
  TRUE,
  'MIGRACAO',
  'legado-google-measurement-v1',
  mua.google_consentido_em
FROM marketing_usuario_atribuicoes mua
WHERE mua.google_consentido_em IS NOT NULL
  AND NOT EXISTS (
    SELECT 1
    FROM marketing_google_consentimentos mgc
    WHERE mgc.usuario_id = mua.usuario_id
  );

CREATE INDEX IF NOT EXISTS
  marketing_google_consentimentos_usuario_data_idx
ON marketing_google_consentimentos (
  usuario_id,
  created_at DESC,
  id DESC
);

ALTER TABLE marketing_usuario_atribuicoes
  VALIDATE CONSTRAINT
    marketing_usuario_atribuicoes_google_estado_coerente;

COMMENT ON COLUMN marketing_usuario_atribuicoes.google_consentimento_status IS
  'Última escolha explícita conhecida para Google Analytics e Google Ads; NULL representa ausência de escolha comprovada.';

COMMENT ON COLUMN marketing_usuario_atribuicoes.google_consentimento_atualizado_em IS
  'Momento em que a escolha atual de medição Google foi registrada no servidor.';

COMMENT ON COLUMN marketing_usuario_atribuicoes.google_revogado_em IS
  'Momento da última revogação explícita; eventos server-side exigem este campo nulo.';

COMMENT ON TABLE marketing_google_consentimentos IS
  'Histórico append-only das escolhas autenticadas de medição Google, com versão do texto apresentado.';

COMMIT;
