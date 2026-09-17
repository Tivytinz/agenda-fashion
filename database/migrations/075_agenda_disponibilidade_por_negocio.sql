BEGIN;

-- A disponibilidade recorrente passa a pertencer ao vínculo entre a pessoa
-- profissional e o negócio. A ocupação real (agendamentos/bloqueios) continua
-- global por profissional para impedir dupla reserva entre negócios.

ALTER TABLE agenda_configuracoes
  ADD COLUMN IF NOT EXISTS negocio_id BIGINT;

ALTER TABLE agenda_horarios
  ADD COLUMN IF NOT EXISTS negocio_id BIGINT;

-- O modelo legado possuía uma única agenda por usuário. Para preservar a agenda
-- já personalizada, associamos esse estado ao mesmo contexto que o backend
-- legado escolhia: dono primeiro e, depois, profissional; em empate, o vínculo
-- mais antigo vence de forma determinística.
WITH contexto_legado AS (
  SELECT DISTINCT ON (un.usuario_id)
    un.usuario_id,
    un.negocio_id
  FROM usuarios_negocios un
  INNER JOIN usuarios u
    ON u.id = un.usuario_id
  INNER JOIN negocios n
    ON n.id = un.negocio_id
  WHERE un.ativo = TRUE
    AND u.ativo = TRUE
    AND n.ativo = TRUE
    AND un.papel IN ('dono', 'profissional')
  ORDER BY
    un.usuario_id,
    CASE un.papel
      WHEN 'dono' THEN 1
      ELSE 2
    END,
    un.id
)
UPDATE agenda_configuracoes ac
SET negocio_id = contexto_legado.negocio_id
FROM contexto_legado
WHERE ac.profissional_id = contexto_legado.usuario_id
  AND ac.negocio_id IS NULL;

UPDATE agenda_horarios ah
SET negocio_id = ac.negocio_id
FROM agenda_configuracoes ac
WHERE ah.profissional_id = ac.profissional_id
  AND ah.negocio_id IS NULL
  AND ac.negocio_id IS NOT NULL;

-- Não apagamos silenciosamente qualquer configuração legada que não possa ser
-- contextualizada. Se existir anomalia histórica, a migration falha inteira e
-- preserva os dados para investigação/recuperação.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM agenda_configuracoes
    WHERE negocio_id IS NULL
  ) OR EXISTS (
    SELECT 1
    FROM agenda_horarios
    WHERE negocio_id IS NULL
  ) THEN
    RAISE EXCEPTION
      'Não foi possível contextualizar todas as configurações legadas da agenda.';
  END IF;
END;
$$;

ALTER TABLE agenda_configuracoes
  DROP CONSTRAINT IF EXISTS agenda_configuracoes_profissional_unique;

ALTER TABLE agenda_horarios
  DROP CONSTRAINT IF EXISTS agenda_horarios_profissional_dia_unique;

ALTER TABLE agenda_configuracoes
  ADD CONSTRAINT agenda_configuracoes_negocio_fk
  FOREIGN KEY (negocio_id)
  REFERENCES negocios(id)
  ON DELETE CASCADE;

ALTER TABLE agenda_horarios
  ADD CONSTRAINT agenda_horarios_negocio_fk
  FOREIGN KEY (negocio_id)
  REFERENCES negocios(id)
  ON DELETE CASCADE;

ALTER TABLE agenda_configuracoes
  ALTER COLUMN negocio_id SET NOT NULL;

ALTER TABLE agenda_horarios
  ALTER COLUMN negocio_id SET NOT NULL;

ALTER TABLE agenda_configuracoes
  ADD CONSTRAINT agenda_configuracoes_profissional_negocio_unique
  UNIQUE (profissional_id, negocio_id);

ALTER TABLE agenda_horarios
  ADD CONSTRAINT agenda_horarios_profissional_negocio_dia_unique
  UNIQUE (profissional_id, negocio_id, dia_semana);

CREATE INDEX IF NOT EXISTS
  agenda_configuracoes_negocio_profissional_idx
ON agenda_configuracoes (
  negocio_id,
  profissional_id
);

CREATE INDEX IF NOT EXISTS
  agenda_horarios_negocio_profissional_dia_idx
ON agenda_horarios (
  negocio_id,
  profissional_id,
  dia_semana
);

-- Todo vínculo ativo recebe configuração própria. Contextos adicionais que não
-- existiam no modelo legado começam com os padrões oficiais do AF.
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
SELECT
  un.usuario_id,
  un.negocio_id,
  60,
  0,
  0,
  24,
  NOW(),
  'padrao_af'
FROM usuarios_negocios un
INNER JOIN usuarios u
  ON u.id = un.usuario_id
INNER JOIN negocios n
  ON n.id = un.negocio_id
WHERE un.ativo = TRUE
  AND u.ativo = TRUE
  AND n.ativo = TRUE
  AND un.papel IN ('dono', 'profissional')
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
  ac.profissional_id,
  ac.negocio_id,
  d.dia_semana,
  d.trabalha,
  d.hora_inicio,
  d.hora_fim,
  d.intervalo_inicio,
  d.intervalo_fim
FROM agenda_configuracoes ac
CROSS JOIN (
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
ON CONFLICT (profissional_id, negocio_id, dia_semana)
DO NOTHING;

-- O vínculo é a origem do contexto. Isso cobre criação de negócio, aceite de
-- convite e reativação sem depender de cada fluxo lembrar de criar a agenda.
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
      24,
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
    ON CONFLICT (profissional_id, negocio_id, dia_semana)
    DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS
  usuarios_negocios_agenda_contextual_trigger
ON usuarios_negocios;

CREATE TRIGGER
  usuarios_negocios_agenda_contextual_trigger
AFTER INSERT OR UPDATE OF usuario_id, negocio_id, papel, ativo
ON usuarios_negocios
FOR EACH ROW
EXECUTE FUNCTION garantir_agenda_contextual_vinculo();

COMMENT ON COLUMN agenda_configuracoes.negocio_id IS
  'Negócio ao qual pertence a configuração recorrente de disponibilidade.';

COMMENT ON COLUMN agenda_horarios.negocio_id IS
  'Negócio ao qual pertence o horário recorrente do profissional.';

COMMIT;
