BEGIN;

ALTER TABLE agendamentos
ADD COLUMN IF NOT EXISTS valor_servico NUMERIC(12, 2);

UPDATE agendamentos a
SET valor_servico = s.valor
FROM servicos_negocio s
WHERE a.servico_id = s.id
  AND a.valor_servico IS NULL;

ALTER TABLE agendamentos
ALTER COLUMN valor_servico SET NOT NULL;

ALTER TABLE agendamentos
DROP CONSTRAINT IF EXISTS agendamentos_valor_servico_check;

ALTER TABLE agendamentos
ADD CONSTRAINT agendamentos_valor_servico_check
CHECK (valor_servico >= 0);

CREATE OR REPLACE FUNCTION preencher_valor_servico_agendamento()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.valor_servico IS NULL
    OR (
      TG_OP = 'UPDATE'
      AND NEW.servico_id IS DISTINCT FROM OLD.servico_id
    )
  THEN
    SELECT valor
    INTO NEW.valor_servico
    FROM servicos_negocio
    WHERE id = NEW.servico_id;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS agendamentos_valor_servico_trigger
ON agendamentos;

CREATE TRIGGER agendamentos_valor_servico_trigger
BEFORE INSERT OR UPDATE OF servico_id
ON agendamentos
FOR EACH ROW
EXECUTE FUNCTION preencher_valor_servico_agendamento();

COMMENT ON COLUMN agendamentos.valor_servico IS
'Preço do serviço congelado no momento em que o agendamento foi criado.';

COMMIT;
