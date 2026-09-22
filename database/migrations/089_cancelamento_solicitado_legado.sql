BEGIN;

-- CA-AG-24 / baseline v1.16:
-- CANCELAMENTO_SOLICITADO é legado. A migration preserva o valor original
-- e a evidência usada para cada decisão, sem inventar resultado para o passado.

ALTER TABLE agendamentos
  DROP CONSTRAINT IF EXISTS agendamentos_status_check;

-- O trigger de avaliação criado na migration 069 referencia explicitamente
-- a coluna status. PostgreSQL não permite alterar o tipo da coluna enquanto
-- esse trigger existir, então ele é removido e recriado na mesma transação.
DROP TRIGGER IF EXISTS
  agendamentos_avaliacao_status_trigger
ON agendamentos;

-- O estado legado possui 23 caracteres. Algumas instalações atuais já
-- restringem a coluna a VARCHAR(20), portanto ampliamos o domínio antes de
-- normalizar qualquer registro histórico.
ALTER TABLE agendamentos
  ALTER COLUMN status TYPE VARCHAR(32);

CREATE TRIGGER
  agendamentos_avaliacao_status_trigger
BEFORE INSERT OR UPDATE OF avaliacao, status
ON agendamentos
FOR EACH ROW
EXECUTE FUNCTION validar_avaliacao_agendamento_realizado();

UPDATE agendamentos
SET status = 'cancelamento_solicitado'
WHERE UPPER(status) = 'CANCELAMENTO_SOLICITADO';

CREATE TABLE IF NOT EXISTS
  agendamento_cancelamento_legado_revisoes (
    id BIGINT
      GENERATED ALWAYS AS IDENTITY
      PRIMARY KEY,

    agendamento_id BIGINT
      NOT NULL
      UNIQUE,

    status_legado VARCHAR(40)
      NOT NULL,

    decisao VARCHAR(20)
      NOT NULL,

    evidencia JSONB
      NOT NULL
      DEFAULT '{}'::JSONB,

    migrado_em TIMESTAMPTZ
      NOT NULL
      DEFAULT NOW(),

    resolvido_em TIMESTAMPTZ,

    resolvido_por BIGINT,

    CONSTRAINT
      agendamento_cancelamento_legado_agendamento_fk
    FOREIGN KEY (agendamento_id)
      REFERENCES agendamentos(id)
      ON DELETE RESTRICT,

    CONSTRAINT
      agendamento_cancelamento_legado_resolvido_por_fk
    FOREIGN KEY (resolvido_por)
      REFERENCES usuarios(id)
      ON DELETE SET NULL,

    CONSTRAINT
      agendamento_cancelamento_legado_decisao_check
    CHECK (
      decisao IN (
        'cancelado',
        'realizado',
        'falta',
        'revisao'
      )
    )
  );

INSERT INTO agendamento_cancelamento_legado_revisoes (
  agendamento_id,
  status_legado,
  decisao,
  evidencia
)
SELECT
  a.id,
  a.status,
  CASE
    WHEN (
      a.data + a.horario::TIME
    ) AT TIME ZONE COALESCE(
      NULLIF(n.fuso_horario, ''),
      'America/Sao_Paulo'
    ) > NOW()
      THEN 'cancelado'

    WHEN a.avaliacao IS NOT NULL
      THEN 'realizado'

    ELSE 'revisao'
  END,
  JSONB_BUILD_OBJECT(
    'data', a.data,
    'horario', a.horario,
    'fuso_horario', COALESCE(
      NULLIF(n.fuso_horario, ''),
      'America/Sao_Paulo'
    ),
    'avaliacao_presente',
      a.avaliacao IS NOT NULL,
    'atendimento_iniciado_em',
      a.atendimento_iniciado_em,
    'status_atendimento_em',
      a.status_atendimento_em
  )
FROM agendamentos a
INNER JOIN negocios n
  ON n.id = a.negocio_id
WHERE LOWER(a.status) =
  'cancelamento_solicitado'
ON CONFLICT (agendamento_id)
DO NOTHING;

-- Solicitação futura: a baseline determina CANCELADO.
UPDATE agendamentos a
SET
  status = 'cancelado',
  cancelado_em =
    COALESCE(a.cancelado_em, NOW()),
  motivo_cancelamento =
    COALESCE(
      a.motivo_cancelamento,
      'Migração do estado legado CANCELAMENTO_SOLICITADO'
    )
FROM negocios n
WHERE n.id = a.negocio_id
  AND LOWER(a.status) =
    'cancelamento_solicitado'
  AND (
    a.data + a.horario::TIME
  ) AT TIME ZONE COALESCE(
    NULLIF(n.fuso_horario, ''),
    'America/Sao_Paulo'
  ) > NOW();

UPDATE
  agendamento_cancelamento_legado_revisoes r
SET
  resolvido_em = NOW()
WHERE r.decisao = 'cancelado'
  AND r.resolvido_em IS NULL
  AND EXISTS (
    SELECT 1
    FROM agendamentos a
    WHERE a.id = r.agendamento_id
      AND a.status = 'cancelado'
  );

-- Avaliação persistida é evidência forte de atendimento concluído.
UPDATE agendamentos a
SET status = 'realizado'
WHERE LOWER(a.status) =
    'cancelamento_solicitado'
  AND a.avaliacao IS NOT NULL;

UPDATE
  agendamento_cancelamento_legado_revisoes r
SET
  resolvido_em = NOW()
WHERE r.decisao = 'realizado'
  AND r.resolvido_em IS NULL
  AND EXISTS (
    SELECT 1
    FROM agendamentos a
    WHERE a.id = r.agendamento_id
      AND a.status = 'realizado'
  );

-- Sem evidência suficiente, o status legado permanece apenas para revisão.
-- Novos fluxos ficam impedidos de voltar a produzir esse estado.
ALTER TABLE agendamentos
  ADD CONSTRAINT agendamentos_status_check
  CHECK (
    status IN (
      'agendado',
      'confirmado',
      'cancelado',
      'realizado',
      'falta',
      'cancelamento_solicitado'
    )
  );

CREATE OR REPLACE FUNCTION
  impedir_novo_cancelamento_solicitado()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF LOWER(NEW.status) =
      'cancelamento_solicitado'
    AND (
      TG_OP = 'INSERT'
      OR LOWER(
        COALESCE(OLD.status, '')
      ) <>
        'cancelamento_solicitado'
    )
  THEN
    RAISE EXCEPTION
      'CANCELAMENTO_SOLICITADO é estado legado e não pode ser criado por novos fluxos.'
      USING
        ERRCODE = '23514',
        CONSTRAINT =
          'agendamentos_cancelamento_solicitado_legado_only';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS
  agendamentos_bloquear_cancelamento_solicitado
ON agendamentos;

CREATE TRIGGER
  agendamentos_bloquear_cancelamento_solicitado
BEFORE INSERT OR UPDATE OF status
ON agendamentos
FOR EACH ROW
EXECUTE FUNCTION
  impedir_novo_cancelamento_solicitado();

CREATE OR REPLACE FUNCTION
  resolver_cancelamento_solicitado_legado(
    p_agendamento_id BIGINT,
    p_resultado VARCHAR,
    p_evidencia JSONB,
    p_resolvido_por BIGINT DEFAULT NULL
  )
RETURNS VARCHAR
LANGUAGE plpgsql
AS $$
DECLARE
  v_resultado VARCHAR;
BEGIN
  v_resultado :=
    LOWER(BTRIM(p_resultado));

  IF v_resultado NOT IN (
    'cancelado',
    'realizado',
    'falta'
  ) THEN
    RAISE EXCEPTION
      'Resultado legado inválido.';
  END IF;

  IF p_evidencia IS NULL
    OR p_evidencia = '{}'::JSONB
  THEN
    RAISE EXCEPTION
      'A resolução administrativa exige evidência registrada.';
  END IF;

  PERFORM 1
  FROM agendamentos
  WHERE id = p_agendamento_id
    AND status =
      'cancelamento_solicitado'
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION
      'Agendamento legado não encontrado ou já resolvido.';
  END IF;

  UPDATE agendamentos
  SET
    status = v_resultado,
    cancelado_em =
      CASE
        WHEN v_resultado = 'cancelado'
          THEN COALESCE(cancelado_em, NOW())
        ELSE cancelado_em
      END,
    status_atendimento_em =
      CASE
        WHEN v_resultado IN (
          'realizado',
          'falta'
        )
          THEN COALESCE(
            status_atendimento_em,
            NOW()
          )
        ELSE status_atendimento_em
      END,
    status_atendimento_por =
      CASE
        WHEN v_resultado IN (
          'realizado',
          'falta'
        )
          THEN COALESCE(
            p_resolvido_por,
            status_atendimento_por
          )
        ELSE status_atendimento_por
      END
  WHERE id = p_agendamento_id;

  UPDATE
    agendamento_cancelamento_legado_revisoes
  SET
    decisao = v_resultado,
    evidencia =
      evidencia ||
      p_evidencia,
    resolvido_em = NOW(),
    resolvido_por =
      p_resolvido_por
  WHERE agendamento_id =
    p_agendamento_id;

  RETURN v_resultado;
END;
$$;

CREATE INDEX IF NOT EXISTS
  agendamento_cancelamento_legado_revisao_idx
ON agendamento_cancelamento_legado_revisoes (
  decisao,
  migrado_em
)
WHERE resolvido_em IS NULL;

COMMIT;
