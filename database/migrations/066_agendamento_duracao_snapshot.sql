BEGIN;

ALTER TABLE agendamentos
  ADD COLUMN IF NOT EXISTS duracao_minutos INTEGER;

UPDATE agendamentos a
SET duracao_minutos = COALESCE(s.duracao_minutos, 60)
FROM servicos_negocio s
WHERE s.id = a.servico_id
  AND a.duracao_minutos IS NULL;

UPDATE agendamentos
SET duracao_minutos = 60
WHERE duracao_minutos IS NULL;

ALTER TABLE agendamentos
  ALTER COLUMN duracao_minutos SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'agendamentos_duracao_minutos_positiva'
      AND conrelid = 'agendamentos'::regclass
  ) THEN
    ALTER TABLE agendamentos
      ADD CONSTRAINT agendamentos_duracao_minutos_positiva
      CHECK (duracao_minutos > 0);
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION preencher_duracao_agendamento()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.duracao_minutos IS NULL THEN
    SELECT COALESCE(s.duracao_minutos, 60)
    INTO NEW.duracao_minutos
    FROM servicos_negocio s
    WHERE s.id = NEW.servico_id;

    NEW.duracao_minutos := COALESCE(NEW.duracao_minutos, 60);
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_preencher_duracao_agendamento
  ON agendamentos;

CREATE TRIGGER trg_preencher_duracao_agendamento
BEFORE INSERT ON agendamentos
FOR EACH ROW
EXECUTE FUNCTION preencher_duracao_agendamento();

COMMENT ON COLUMN agendamentos.duracao_minutos IS
  'Duração do serviço congelada no momento da criação do agendamento.';

COMMIT;
