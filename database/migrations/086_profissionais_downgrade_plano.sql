BEGIN;

ALTER TABLE usuarios_negocios
  ADD COLUMN IF NOT EXISTS ativado_em TIMESTAMPTZ;

UPDATE usuarios_negocios
SET ativado_em = COALESCE(ativado_em, created_at)
WHERE ativo = TRUE
  AND ativado_em IS NULL;

ALTER TABLE usuarios_negocios
  DROP CONSTRAINT IF EXISTS usuarios_negocios_motivo_inatividade_valido;

ALTER TABLE usuarios_negocios
  ADD CONSTRAINT usuarios_negocios_motivo_inatividade_valido
  CHECK (
    motivo_inatividade IS NULL
    OR (
      ativo = FALSE
      AND papel = 'profissional'
      AND motivo_inatividade IN (
        'aguardando_vaga_plano',
        'excedente_limite_plano'
      )
    )
  );

CREATE INDEX IF NOT EXISTS
  usuarios_negocios_excedente_plano_idx
ON usuarios_negocios (
  negocio_id,
  ativado_em DESC,
  id DESC
)
WHERE
  ativo = FALSE
  AND papel = 'profissional'
  AND motivo_inatividade = 'excedente_limite_plano';

COMMENT ON COLUMN usuarios_negocios.ativado_em IS
'Instante da ativação mais recente do vínculo. Usado para aplicar downgrade preservando a proprietária e inativando primeiro profissionais ativadas mais recentemente.';

COMMENT ON COLUMN usuarios_negocios.motivo_inatividade IS
'Motivo explícito de vínculo profissional inativo: aguardando_vaga_plano ou excedente_limite_plano.';

COMMIT;
