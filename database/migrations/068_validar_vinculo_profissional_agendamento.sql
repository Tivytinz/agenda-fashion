BEGIN;

CREATE OR REPLACE FUNCTION validar_vinculo_profissional_agendamento()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  vinculo_id BIGINT;
BEGIN
  SELECT un.id
  INTO vinculo_id
  FROM usuarios_negocios un
  INNER JOIN usuarios u
    ON u.id = un.usuario_id
  INNER JOIN negocios n
    ON n.id = un.negocio_id
  WHERE un.usuario_id = NEW.profissional_id
    AND un.negocio_id = NEW.negocio_id
    AND un.ativo = TRUE
    AND un.papel IN ('dono', 'profissional')
    AND u.ativo = TRUE
    AND n.ativo = TRUE
  LIMIT 1
  FOR UPDATE OF un;

  IF vinculo_id IS NULL THEN
    RAISE EXCEPTION
      'Profissional não possui vínculo ativo com o negócio.'
      USING
        ERRCODE = '23503',
        CONSTRAINT = 'agendamentos_profissional_negocio_vinculo';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS
  trg_validar_vinculo_profissional_agendamento
ON agendamentos;

CREATE TRIGGER
  trg_validar_vinculo_profissional_agendamento
BEFORE INSERT OR UPDATE OF profissional_id, negocio_id
ON agendamentos
FOR EACH ROW
EXECUTE FUNCTION validar_vinculo_profissional_agendamento();

COMMENT ON FUNCTION validar_vinculo_profissional_agendamento() IS
'Garante e bloqueia o vínculo ativo profissional-negócio antes de criar ou mover um agendamento, serializando a operação com o offboarding da equipe.';

COMMIT;
