BEGIN;

-- A política padrão vigente para novas reservas é de 2 horas. Configurações
-- ainda identificadas como sugestão automática podem ser normalizadas com
-- segurança porque não representam uma personalização explícita da profissional.
UPDATE agenda_configuracoes
SET
  antecedencia_cancelamento = 2,
  updated_at = NOW()
WHERE origem_horarios = 'padrao_af'
  AND antecedencia_cancelamento IS DISTINCT FROM 2;

-- Mantém o trigger de criação contextual alinhado ao mesmo default. A função já
-- existe desde a migration 075; CREATE OR REPLACE preserva o trigger instalado.
CREATE OR REPLACE FUNCTION garantir_agenda_contextual_vinculo()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.ativo = TRUE
    AND NEW.papel IN ('dono', 'profissional')
  THEN
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
      2,
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
