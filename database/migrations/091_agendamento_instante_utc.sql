BEGIN;

ALTER TABLE agendamentos
  ADD COLUMN IF NOT EXISTS inicio_previsto_em TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS fuso_horario_snapshot TEXT;

UPDATE agendamentos a
SET
  fuso_horario_snapshot = COALESCE(
    NULLIF(BTRIM(n.fuso_horario), ''),
    'America/Sao_Paulo'
  ),
  inicio_previsto_em = (
    a.data::date +
    a.horario::time
  ) AT TIME ZONE COALESCE(
    NULLIF(BTRIM(n.fuso_horario), ''),
    'America/Sao_Paulo'
  )
FROM negocios n
WHERE n.id = a.negocio_id
  AND (
    a.inicio_previsto_em IS NULL
    OR a.fuso_horario_snapshot IS NULL
    OR BTRIM(a.fuso_horario_snapshot) = ''
  );

ALTER TABLE agendamentos
  ALTER COLUMN inicio_previsto_em SET NOT NULL,
  ALTER COLUMN fuso_horario_snapshot SET NOT NULL;

ALTER TABLE agendamentos
  DROP CONSTRAINT IF EXISTS
    agendamentos_fuso_horario_snapshot_preenchido;

ALTER TABLE agendamentos
  ADD CONSTRAINT
    agendamentos_fuso_horario_snapshot_preenchido
  CHECK (
    BTRIM(fuso_horario_snapshot) <> ''
  );

CREATE INDEX IF NOT EXISTS
  agendamentos_profissional_inicio_ativo_idx
ON agendamentos (
  profissional_id,
  inicio_previsto_em
)
WHERE status IN (
  'agendado',
  'confirmado'
);

CREATE OR REPLACE FUNCTION
  sincronizar_instante_previsto_agendamento()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  fuso_negocio TEXT;
BEGIN
  SELECT COALESCE(
    NULLIF(BTRIM(n.fuso_horario), ''),
    'America/Sao_Paulo'
  )
  INTO fuso_negocio
  FROM negocios n
  WHERE n.id = NEW.negocio_id
  LIMIT 1;

  IF fuso_negocio IS NULL THEN
    RAISE EXCEPTION
      'Negócio % não encontrado para normalizar o agendamento.',
      NEW.negocio_id;
  END IF;

  NEW.fuso_horario_snapshot :=
    fuso_negocio;

  NEW.inicio_previsto_em := (
    NEW.data::date +
    NEW.horario::time
  ) AT TIME ZONE fuso_negocio;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS
  trg_sincronizar_instante_previsto_agendamento
ON agendamentos;

CREATE TRIGGER
  trg_sincronizar_instante_previsto_agendamento
BEFORE INSERT OR UPDATE OF
  data,
  horario,
  negocio_id
ON agendamentos
FOR EACH ROW
EXECUTE FUNCTION
  sincronizar_instante_previsto_agendamento();

COMMENT ON COLUMN
  agendamentos.inicio_previsto_em
IS
  'Instante absoluto do início previsto, normalizado como TIMESTAMPTZ para comparação e ordenação.';

COMMENT ON COLUMN
  agendamentos.fuso_horario_snapshot
IS
  'Identificador IANA usado para interpretar data/horário local quando o booking foi criado ou reagendado.';

COMMIT;
