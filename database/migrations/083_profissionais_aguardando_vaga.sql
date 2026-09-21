BEGIN;

ALTER TABLE usuarios_negocios
  ADD COLUMN IF NOT EXISTS motivo_inatividade VARCHAR(40);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'usuarios_negocios_motivo_inatividade_valido'
  ) THEN
    ALTER TABLE usuarios_negocios
      ADD CONSTRAINT usuarios_negocios_motivo_inatividade_valido
      CHECK (
        motivo_inatividade IS NULL
        OR (
          ativo = FALSE
          AND papel = 'profissional'
          AND motivo_inatividade = 'aguardando_vaga_plano'
        )
      );
  END IF;
END
$$;

CREATE INDEX IF NOT EXISTS
  usuarios_negocios_aguardando_vaga_idx
ON usuarios_negocios (
  negocio_id,
  usuario_id
)
WHERE
  ativo = FALSE
  AND papel = 'profissional'
  AND motivo_inatividade = 'aguardando_vaga_plano';

COMMENT ON COLUMN usuarios_negocios.motivo_inatividade IS
'Motivo explícito de vínculo profissional inativo. aguardando_vaga_plano representa convite aceito sem capacidade ativa no plano.';

COMMIT;
