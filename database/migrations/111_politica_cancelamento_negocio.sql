BEGIN;

-- RF57: a antecedência de cancelamento é uma política do negócio e somente a
-- proprietária pode alterá-la. A coluna antiga em agenda_configuracoes permanece
-- temporariamente por compatibilidade de rollout, mas deixa de ser fonte de
-- verdade para novas reservas.
ALTER TABLE negocios
  ADD COLUMN IF NOT EXISTS antecedencia_cancelamento INTEGER;

-- Preserva, quando existir, a política válida já escolhida pela dona. Valores
-- configurados apenas por profissionais não são promovidos para o negócio.
UPDATE negocios n
SET antecedencia_cancelamento = COALESCE(
  (
    SELECT ac.antecedencia_cancelamento
    FROM usuarios_negocios un
    INNER JOIN agenda_configuracoes ac
      ON ac.profissional_id = un.usuario_id
      AND ac.negocio_id = un.negocio_id
    WHERE un.negocio_id = n.id
      AND un.papel = 'dono'
      AND ac.antecedencia_cancelamento BETWEEN 0 AND 168
    ORDER BY
      un.ativo DESC,
      un.created_at ASC,
      un.id ASC
    LIMIT 1
  ),
  2
)
WHERE n.antecedencia_cancelamento IS NULL;

UPDATE negocios
SET antecedencia_cancelamento = CASE
  WHEN antecedencia_cancelamento IS NULL THEN 2
  WHEN antecedencia_cancelamento < 0 THEN 2
  WHEN antecedencia_cancelamento > 168 THEN 168
  ELSE antecedencia_cancelamento
END
WHERE antecedencia_cancelamento IS NULL
   OR antecedencia_cancelamento < 0
   OR antecedencia_cancelamento > 168;

ALTER TABLE negocios
  ALTER COLUMN antecedencia_cancelamento SET DEFAULT 2,
  ALTER COLUMN antecedencia_cancelamento SET NOT NULL;

ALTER TABLE negocios
  DROP CONSTRAINT IF EXISTS negocios_antecedencia_cancelamento_check;

ALTER TABLE negocios
  ADD CONSTRAINT negocios_antecedencia_cancelamento_check
  CHECK (
    antecedencia_cancelamento >= 0
    AND antecedencia_cancelamento <= 168
  ) NOT VALID;

ALTER TABLE negocios
  VALIDATE CONSTRAINT negocios_antecedencia_cancelamento_check;

COMMENT ON COLUMN negocios.antecedencia_cancelamento IS
  'Antecedência de cancelamento do cliente, em horas, configurada exclusivamente pela proprietária do negócio.';

-- Compatibilidade: alinha os registros legados existentes à política canônica
-- do negócio. Snapshots já gravados em agendamentos não são reescritos.
UPDATE agenda_configuracoes ac
SET
  antecedencia_cancelamento = n.antecedencia_cancelamento,
  updated_at = NOW()
FROM negocios n
WHERE ac.negocio_id = n.id
  AND ac.antecedencia_cancelamento IS DISTINCT FROM n.antecedencia_cancelamento;

-- Novos bookings congelam a política do negócio, independentemente da
-- profissional escolhida.
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
    SELECT n.antecedencia_cancelamento
      INTO antecedencia_atual
    FROM negocios n
    WHERE n.id = NEW.negocio_id
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

-- Novos vínculos continuam recebendo a disponibilidade sugerida, mas a coluna
-- legada de cancelamento é inicializada com a política atual do negócio.
CREATE OR REPLACE FUNCTION garantir_agenda_contextual_vinculo()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  antecedencia_negocio INTEGER;
BEGIN
  IF NEW.ativo = TRUE
    AND NEW.papel IN ('dono', 'profissional')
  THEN
    SELECT COALESCE(
      n.antecedencia_cancelamento,
      2
    )
      INTO antecedencia_negocio
    FROM negocios n
    WHERE n.id = NEW.negocio_id
    LIMIT 1;

    antecedencia_negocio :=
      COALESCE(
        antecedencia_negocio,
        2
      );

    INSERT INTO agenda_configuracoes (
      profissional_id,
      negocio_id,
      duracao_padrao,
      intervalo_minutos,
      antecedencia_agendamento,
      antecedencia_cancelamento,
      configurado_em,
      origem_horarios
    )
    VALUES (
      NEW.usuario_id,
      NEW.negocio_id,
      60,
      0,
      0,
      antecedencia_negocio,
      NOW(),
      'padrao_af'
    )
    ON CONFLICT (profissional_id, negocio_id)
    DO NOTHING;

    INSERT INTO agenda_horarios (
      profissional_id,
      negocio_id,
      dia_semana,
      trabalha,
      hora_inicio,
      hora_fim,
      intervalo_inicio,
      intervalo_fim
    )
    SELECT
      NEW.usuario_id,
      NEW.negocio_id,
      d.dia_semana,
      d.trabalha,
      d.hora_inicio,
      d.hora_fim,
      d.intervalo_inicio,
      d.intervalo_fim
    FROM (
      VALUES
        (0::SMALLINT, FALSE, NULL::TIME, NULL::TIME, NULL::TIME, NULL::TIME),
        (1::SMALLINT, TRUE,  TIME '08:00', TIME '18:00', TIME '12:00', TIME '13:00'),
        (2::SMALLINT, TRUE,  TIME '08:00', TIME '18:00', TIME '12:00', TIME '13:00'),
        (3::SMALLINT, TRUE,  TIME '08:00', TIME '18:00', TIME '12:00', TIME '13:00'),
        (4::SMALLINT, TRUE,  TIME '08:00', TIME '18:00', TIME '12:00', TIME '13:00'),
        (5::SMALLINT, TRUE,  TIME '08:00', TIME '18:00', TIME '12:00', TIME '13:00'),
        (6::SMALLINT, TRUE,  TIME '08:00', TIME '13:00', NULL::TIME, NULL::TIME)
    ) AS d(
      dia_semana,
      trabalha,
      hora_inicio,
      hora_fim,
      intervalo_inicio,
      intervalo_fim
    )
    ON CONFLICT (
      profissional_id,
      negocio_id,
      dia_semana
    )
    DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$;

COMMIT;
