BEGIN;

ALTER TABLE negocios
  ADD COLUMN IF NOT EXISTS arquivado_em TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS arquivado_por BIGINT,
  ADD COLUMN IF NOT EXISTS motivo_arquivamento VARCHAR(40);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'negocios_arquivado_por_fk'
  ) THEN
    ALTER TABLE negocios
      ADD CONSTRAINT negocios_arquivado_por_fk
      FOREIGN KEY (arquivado_por)
      REFERENCES usuarios(id)
      ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'negocios_estado_arquivado_consistente'
  ) THEN
    ALTER TABLE negocios
      ADD CONSTRAINT negocios_estado_arquivado_consistente
      CHECK (
        arquivado_em IS NULL
        OR (
          ativo = FALSE
          AND publicado = FALSE
          AND motivo_arquivamento IN (
            'encerramento_voluntario',
            'exclusao_proprietaria',
            'administrativo'
          )
        )
      );
  END IF;
END
$$;

ALTER TABLE usuarios
  ADD COLUMN IF NOT EXISTS desativado_em TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS encerrado_definitivo_em TIMESTAMPTZ;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'usuarios_desativacao_consistente'
  ) THEN
    ALTER TABLE usuarios
      ADD CONSTRAINT usuarios_desativacao_consistente
      CHECK (
        desativado_em IS NULL
        OR ativo = FALSE
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'usuarios_encerramento_consistente'
  ) THEN
    ALTER TABLE usuarios
      ADD CONSTRAINT usuarios_encerramento_consistente
      CHECK (
        encerrado_definitivo_em IS NULL
        OR (
          ativo = FALSE
          AND desativado_em IS NOT NULL
        )
      );
  END IF;
END
$$;

CREATE INDEX IF NOT EXISTS negocios_arquivados_idx
  ON negocios (arquivado_em DESC)
  WHERE arquivado_em IS NOT NULL;

CREATE INDEX IF NOT EXISTS usuarios_desativados_idx
  ON usuarios (desativado_em DESC)
  WHERE desativado_em IS NOT NULL;

COMMENT ON COLUMN negocios.arquivado_em IS
  'Marca o encerramento operacional terminal do negócio no fluxo normal.';
COMMENT ON COLUMN negocios.motivo_arquivamento IS
  'Motivo auditável do arquivamento: encerramento_voluntario, exclusao_proprietaria ou administrativo.';
COMMENT ON COLUMN usuarios.desativado_em IS
  'Momento em que a conta perdeu acesso operacional sem apagar históricos necessários.';
COMMENT ON COLUMN usuarios.encerrado_definitivo_em IS
  'Marca encerramento definitivo da identidade operacional; dados sujeitos a retenção permanecem preservados.';

COMMIT;
