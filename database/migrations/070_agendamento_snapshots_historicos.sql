-- Preserva no próprio agendamento os dados que não podem mudar retroativamente.
-- O backfill usa o melhor estado disponível no momento desta migration; ele não
-- reconstrói com precisão histórica regras que já tenham mudado no passado.

ALTER TABLE agendamentos
  ADD COLUMN IF NOT EXISTS servico_nome TEXT,
  ADD COLUMN IF NOT EXISTS antecedencia_cancelamento_horas INTEGER;

UPDATE agendamentos a
SET servico_nome = COALESCE(
  (
    SELECT NULLIF(BTRIM(s.nome), '')
    FROM servicos_negocio s
    WHERE s.id = a.servico_id
    LIMIT 1
  ),
  'Serviço'
)
WHERE a.servico_nome IS NULL
   OR BTRIM(a.servico_nome) = '';

UPDATE agendamentos a
SET antecedencia_cancelamento_horas = COALESCE(
  (
    SELECT CASE
      WHEN ac.antecedencia_cancelamento >= 0
        THEN ac.antecedencia_cancelamento
      ELSE 24
    END
    FROM agenda_configuracoes ac
    WHERE ac.profissional_id = a.profissional_id
    LIMIT 1
  ),
  24
)
WHERE a.antecedencia_cancelamento_horas IS NULL;

ALTER TABLE agendamentos
  ALTER COLUMN servico_nome SET NOT NULL,
  ALTER COLUMN antecedencia_cancelamento_horas SET NOT NULL;

ALTER TABLE agendamentos
  DROP CONSTRAINT IF EXISTS agendamentos_antecedencia_cancelamento_horas_check;

ALTER TABLE agendamentos
  ADD CONSTRAINT agendamentos_antecedencia_cancelamento_horas_check
  CHECK (antecedencia_cancelamento_horas >= 0);

-- Compatibilidade durante rollout: se uma instância antiga ainda inserir um
-- booking sem os novos campos, o banco deriva os snapshots de fontes internas.
CREATE OR REPLACE FUNCTION preencher_snapshots_agendamento()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  nome_servico_atual TEXT;
  antecedencia_atual INTEGER;
BEGIN
  IF NEW.servico_nome IS NULL OR BTRIM(NEW.servico_nome) = '' THEN
    SELECT NULLIF(BTRIM(s.nome), '')
      INTO nome_servico_atual
    FROM servicos_negocio s
    WHERE s.id = NEW.servico_id
    LIMIT 1;

    NEW.servico_nome := COALESCE(nome_servico_atual, 'Serviço');
  END IF;

  IF NEW.antecedencia_cancelamento_horas IS NULL THEN
    SELECT ac.antecedencia_cancelamento
      INTO antecedencia_atual
    FROM agenda_configuracoes ac
    WHERE ac.profissional_id = NEW.profissional_id
    LIMIT 1;

    NEW.antecedencia_cancelamento_horas := CASE
      WHEN antecedencia_atual IS NOT NULL
        AND antecedencia_atual >= 0
        THEN antecedencia_atual
      ELSE 24
    END;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_preencher_snapshots_agendamento
  ON agendamentos;

CREATE TRIGGER trg_preencher_snapshots_agendamento
BEFORE INSERT ON agendamentos
FOR EACH ROW
EXECUTE FUNCTION preencher_snapshots_agendamento();
