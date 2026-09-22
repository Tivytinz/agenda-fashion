BEGIN;

ALTER TABLE bloqueios_horarios
  ADD COLUMN IF NOT EXISTS negocio_id BIGINT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'bloqueios_horarios_negocio_fk'
      AND conrelid = 'public.bloqueios_horarios'::regclass
  ) THEN
    ALTER TABLE bloqueios_horarios
      ADD CONSTRAINT bloqueios_horarios_negocio_fk
      FOREIGN KEY (negocio_id)
      REFERENCES negocios(id)
      ON DELETE CASCADE;
  END IF;
END;
$$;

ALTER TABLE bloqueios_horarios
  DROP CONSTRAINT IF EXISTS
    bloqueios_horarios_profissional_data_hora_unique;

CREATE UNIQUE INDEX IF NOT EXISTS
  bloqueios_horarios_global_legado_unique
ON bloqueios_horarios (
  profissional_id,
  data_bloqueio,
  hora_bloqueio
)
WHERE negocio_id IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS
  bloqueios_horarios_vinculo_unique
ON bloqueios_horarios (
  negocio_id,
  profissional_id,
  data_bloqueio,
  hora_bloqueio
)
WHERE negocio_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS
  bloqueios_horarios_vinculo_periodo_idx
ON bloqueios_horarios (
  negocio_id,
  profissional_id,
  data_bloqueio
);

COMMENT ON COLUMN bloqueios_horarios.negocio_id IS
'Negócio do vínculo ao qual o bloqueio pertence. NULL é reservado a registros legados globais anteriores à RN52.';

COMMIT;
