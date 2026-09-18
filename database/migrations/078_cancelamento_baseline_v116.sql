-- Alinha a politica de cancelamento de novas reservas à baseline congelada v1.16.
-- IMPORTANTE: snapshots já persistidos em agendamentos NÃO são reescritos.

UPDATE agenda_configuracoes
SET antecedencia_cancelamento = CASE
  WHEN antecedencia_cancelamento IS NULL THEN 2
  WHEN antecedencia_cancelamento < 0 THEN 2
  WHEN antecedencia_cancelamento > 168 THEN 168
  ELSE antecedencia_cancelamento
END
WHERE antecedencia_cancelamento IS NULL
   OR antecedencia_cancelamento < 0
   OR antecedencia_cancelamento > 168;

ALTER TABLE agenda_configuracoes
  DROP CONSTRAINT IF EXISTS agenda_configuracoes_antecedencia_cancelamento_v116_check;

ALTER TABLE agenda_configuracoes
  ADD CONSTRAINT agenda_configuracoes_antecedencia_cancelamento_v116_check
  CHECK (
    antecedencia_cancelamento >= 0
    AND antecedencia_cancelamento <= 168
  ) NOT VALID;

ALTER TABLE agenda_configuracoes
  VALIDATE CONSTRAINT agenda_configuracoes_antecedencia_cancelamento_v116_check;

-- Compatibilidade durante rollout: instâncias antigas que ainda inserirem um booking
-- sem snapshot recebem o valor interno vigente. O fallback passa a ser 2 horas.
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
      AND ac.negocio_id = NEW.negocio_id
    LIMIT 1;

    NEW.antecedencia_cancelamento_horas := CASE
      WHEN antecedencia_atual IS NOT NULL
        AND antecedencia_atual BETWEEN 0 AND 168
        THEN antecedencia_atual
      ELSE 2
    END;
  END IF;

  RETURN NEW;
END;
$$;
