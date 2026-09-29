BEGIN;

-- Compatibilidade de rollout/rollback da política de cancelamento.
--
-- A fonte canônica continua em negocios.antecedencia_cancelamento. Enquanto
-- versões anteriores ainda puderem escrever agenda_configuracoes diretamente,
-- este trigger impede divergência:
--   - escrita legada da dona atualiza a política canônica e espelha o negócio;
--   - escrita legada de profissional é normalizada para a política do negócio;
--   - espelhamentos feitos pelo runtime novo usam uma flag transacional para
--     não serem reinterpretados como intenção de produto;
--   - a ordem de lock evita o ciclo negócio -> agenda / agenda -> negócio
--     durante rollout misto.
CREATE OR REPLACE FUNCTION sincronizar_antecedencia_cancelamento_legado()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  politica_canonica INTEGER;
  eh_dona BOOLEAN;
  sincronizacao_interna BOOLEAN;
BEGIN
  SELECT
    COALESCE(
      n.antecedencia_cancelamento,
      2
    )
  INTO politica_canonica
  FROM negocios n
  WHERE n.id = NEW.negocio_id;

  IF NOT FOUND THEN
    RETURN NEW;
  END IF;

  sincronizacao_interna :=
    COALESCE(
      current_setting(
        'agenda_fashion.sincronizando_cancelamento',
        TRUE
      ),
      '0'
    ) = '1';

  IF sincronizacao_interna THEN
    NEW.antecedencia_cancelamento :=
      politica_canonica;
    RETURN NEW;
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM usuarios_negocios un
    WHERE un.negocio_id =
      NEW.negocio_id
      AND un.usuario_id =
        NEW.profissional_id
      AND un.papel = 'dono'
      AND un.ativo = TRUE
  )
  INTO eh_dona;

  IF NOT eh_dona THEN
    /*
     * A escrita de profissional não tenta bloquear o negócio. Ela apenas
     * normaliza o espelho legado para o último valor canônico confirmado.
     * Assim uma atualização concorrente da dona nunca cria o ciclo
     * profissional -> negócio; a dona e o runtime novo usam a mesma ordem
     * agenda da dona -> negócio -> equipe.
     */
    NEW.antecedencia_cancelamento :=
      politica_canonica;
    RETURN NEW;
  END IF;

  IF
    NEW.antecedencia_cancelamento IS NULL
    OR NEW.antecedencia_cancelamento < 0
    OR NEW.antecedencia_cancelamento > 168
  THEN
    RAISE EXCEPTION
      'Antecedência de cancelamento deve estar entre 0 e 168 horas.'
      USING ERRCODE = '23514';
  END IF;

  UPDATE negocios
  SET
    antecedencia_cancelamento =
      NEW.antecedencia_cancelamento,
    updated_at = NOW()
  WHERE id = NEW.negocio_id;

  politica_canonica :=
    NEW.antecedencia_cancelamento;

  PERFORM set_config(
    'agenda_fashion.sincronizando_cancelamento',
    '1',
    TRUE
  );

  UPDATE agenda_configuracoes
  SET
    antecedencia_cancelamento =
      politica_canonica,
    updated_at = NOW()
  WHERE negocio_id =
      NEW.negocio_id
    AND profissional_id <>
      NEW.profissional_id
    AND antecedencia_cancelamento
      IS DISTINCT FROM
      politica_canonica;

  PERFORM set_config(
    'agenda_fashion.sincronizando_cancelamento',
    '0',
    TRUE
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS
  agenda_configuracoes_cancelamento_compat_trigger
ON agenda_configuracoes;

CREATE TRIGGER
  agenda_configuracoes_cancelamento_compat_trigger
BEFORE INSERT OR UPDATE OF
  antecedencia_cancelamento
ON agenda_configuracoes
FOR EACH ROW
EXECUTE FUNCTION
  sincronizar_antecedencia_cancelamento_legado();

COMMENT ON FUNCTION sincronizar_antecedencia_cancelamento_legado() IS
  'Compatibilidade temporária: mantém agenda_configuracoes sincronizada com negocios.antecedencia_cancelamento durante rollout/rollback de versões antigas.';

COMMIT;
