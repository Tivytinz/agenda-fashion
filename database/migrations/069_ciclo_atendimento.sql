BEGIN;

ALTER TABLE agendamentos
  DROP CONSTRAINT IF EXISTS agendamentos_status_check;

ALTER TABLE agendamentos
  ADD CONSTRAINT agendamentos_status_check
  CHECK (
    status IN (
      'agendado',
      'confirmado',
      'cancelado',
      'realizado',
      'falta'
    )
  );

ALTER TABLE agendamentos
  ADD COLUMN IF NOT EXISTS status_atendimento_em TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS status_atendimento_por BIGINT;

ALTER TABLE agendamentos
  DROP CONSTRAINT IF EXISTS agendamentos_status_atendimento_por_fk;

ALTER TABLE agendamentos
  ADD CONSTRAINT agendamentos_status_atendimento_por_fk
  FOREIGN KEY (status_atendimento_por)
  REFERENCES usuarios(id)
  ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS
  agendamentos_status_atendimento_por_idx
ON agendamentos (
  status_atendimento_por
);

CREATE OR REPLACE FUNCTION validar_avaliacao_agendamento_realizado()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.avaliacao IS NOT NULL
    AND NEW.status <> 'realizado'
  THEN
    RAISE EXCEPTION
      'A avaliação só pode ser registrada em atendimento realizado.'
      USING
        ERRCODE = '23514',
        CONSTRAINT = 'agendamentos_avaliacao_status_check';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS
  agendamentos_avaliacao_status_trigger
ON agendamentos;

CREATE TRIGGER
  agendamentos_avaliacao_status_trigger
BEFORE INSERT OR UPDATE OF avaliacao, status
ON agendamentos
FOR EACH ROW
EXECUTE FUNCTION validar_avaliacao_agendamento_realizado();

COMMIT;
