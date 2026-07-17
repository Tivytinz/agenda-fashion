BEGIN;

-- =========================================================
-- CONFIGURAÇÕES GERAIS DA AGENDA
-- Uma configuração por profissional
-- =========================================================

CREATE TABLE IF NOT EXISTS agenda_configuracoes (
  id BIGINT
    GENERATED ALWAYS AS IDENTITY
    PRIMARY KEY,

  profissional_id BIGINT
    NOT NULL,

  duracao_padrao INTEGER
    NOT NULL
    DEFAULT 60,

  intervalo_minutos INTEGER
    NOT NULL
    DEFAULT 0,

  antecedencia_agendamento INTEGER
    NOT NULL
    DEFAULT 0,

  antecedencia_cancelamento INTEGER
    NOT NULL
    DEFAULT 0,

  created_at TIMESTAMPTZ
    NOT NULL
    DEFAULT NOW(),

  updated_at TIMESTAMPTZ
    NOT NULL
    DEFAULT NOW(),

  CONSTRAINT agenda_configuracoes_profissional_fk
    FOREIGN KEY (profissional_id)
    REFERENCES usuarios(id)
    ON DELETE CASCADE,

  CONSTRAINT agenda_configuracoes_profissional_unique
    UNIQUE (profissional_id),

  CONSTRAINT agenda_configuracoes_duracao_check
    CHECK (
      duracao_padrao BETWEEN 5 AND 1440
    ),

  CONSTRAINT agenda_configuracoes_intervalo_check
    CHECK (
      intervalo_minutos BETWEEN 0 AND 1440
    ),

  CONSTRAINT agenda_configuracoes_antecedencia_agendamento_check
    CHECK (
      antecedencia_agendamento BETWEEN 0 AND 8760
    ),

  CONSTRAINT agenda_configuracoes_antecedencia_cancelamento_check
    CHECK (
      antecedencia_cancelamento BETWEEN 0 AND 8760
    )
);

CREATE INDEX IF NOT EXISTS
  agenda_configuracoes_profissional_idx
ON agenda_configuracoes (
  profissional_id
);

-- =========================================================
-- HORÁRIOS DE TRABALHO POR DIA DA SEMANA
--
-- 0 = domingo
-- 1 = segunda-feira
-- 2 = terça-feira
-- 3 = quarta-feira
-- 4 = quinta-feira
-- 5 = sexta-feira
-- 6 = sábado
-- =========================================================

CREATE TABLE IF NOT EXISTS agenda_horarios (
  id BIGINT
    GENERATED ALWAYS AS IDENTITY
    PRIMARY KEY,

  profissional_id BIGINT
    NOT NULL,

  dia_semana SMALLINT
    NOT NULL,

  trabalha BOOLEAN
    NOT NULL
    DEFAULT TRUE,

  hora_inicio TIME,

  hora_fim TIME,

  intervalo_inicio TIME,

  intervalo_fim TIME,

  created_at TIMESTAMPTZ
    NOT NULL
    DEFAULT NOW(),

  updated_at TIMESTAMPTZ
    NOT NULL
    DEFAULT NOW(),

  CONSTRAINT agenda_horarios_profissional_fk
    FOREIGN KEY (profissional_id)
    REFERENCES usuarios(id)
    ON DELETE CASCADE,

  CONSTRAINT agenda_horarios_profissional_dia_unique
    UNIQUE (
      profissional_id,
      dia_semana
    ),

  CONSTRAINT agenda_horarios_dia_semana_check
    CHECK (
      dia_semana BETWEEN 0 AND 6
    ),

  CONSTRAINT agenda_horarios_expediente_check
    CHECK (
      trabalha = FALSE
      OR (
        hora_inicio IS NOT NULL
        AND hora_fim IS NOT NULL
        AND hora_inicio < hora_fim
      )
    ),

  CONSTRAINT agenda_horarios_intervalo_par_check
    CHECK (
      (
        intervalo_inicio IS NULL
        AND intervalo_fim IS NULL
      )
      OR (
        intervalo_inicio IS NOT NULL
        AND intervalo_fim IS NOT NULL
        AND intervalo_inicio < intervalo_fim
      )
    ),

  CONSTRAINT agenda_horarios_intervalo_expediente_check
    CHECK (
      intervalo_inicio IS NULL
      OR trabalha = FALSE
      OR (
        hora_inicio IS NOT NULL
        AND hora_fim IS NOT NULL
        AND intervalo_inicio >= hora_inicio
        AND intervalo_fim <= hora_fim
      )
    )
);

CREATE INDEX IF NOT EXISTS
  agenda_horarios_profissional_idx
ON agenda_horarios (
  profissional_id
);

CREATE INDEX IF NOT EXISTS
  agenda_horarios_profissional_dia_idx
ON agenda_horarios (
  profissional_id,
  dia_semana
);

-- =========================================================
-- FUNÇÃO DE UPDATED_AT
-- =========================================================

CREATE OR REPLACE FUNCTION atualizar_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS
  agenda_configuracoes_updated_at_trigger
ON agenda_configuracoes;

CREATE TRIGGER
  agenda_configuracoes_updated_at_trigger
BEFORE UPDATE
ON agenda_configuracoes
FOR EACH ROW
EXECUTE FUNCTION atualizar_updated_at();

DROP TRIGGER IF EXISTS
  agenda_horarios_updated_at_trigger
ON agenda_horarios;

CREATE TRIGGER
  agenda_horarios_updated_at_trigger
BEFORE UPDATE
ON agenda_horarios
FOR EACH ROW
EXECUTE FUNCTION atualizar_updated_at();

-- =========================================================
-- CONFIGURAÇÃO PADRÃO PARA DONOS E PROFISSIONAIS EXISTENTES
-- =========================================================

INSERT INTO agenda_configuracoes (
  profissional_id,
  duracao_padrao,
  intervalo_minutos,
  antecedencia_agendamento,
  antecedencia_cancelamento
)
SELECT DISTINCT
  un.usuario_id,
  60,
  0,
  0,
  0
FROM usuarios_negocios un
INNER JOIN usuarios u
  ON u.id = un.usuario_id
WHERE un.ativo = TRUE
  AND u.ativo = TRUE
  AND un.papel IN (
    'dono',
    'profissional'
  )
ON CONFLICT (
  profissional_id
)
DO NOTHING;

-- =========================================================
-- HORÁRIOS PADRÃO:
-- todos os dias, das 08:00 às 20:00
--
-- Depois poderão ser alterados pelo painel.
-- =========================================================

INSERT INTO agenda_horarios (
  profissional_id,
  dia_semana,
  trabalha,
  hora_inicio,
  hora_fim,
  intervalo_inicio,
  intervalo_fim
)
SELECT
  un.usuario_id,
  dias.dia_semana,
  TRUE,
  TIME '08:00',
  TIME '20:00',
  NULL,
  NULL
FROM (
  SELECT DISTINCT usuario_id
  FROM usuarios_negocios
  WHERE ativo = TRUE
    AND papel IN (
      'dono',
      'profissional'
    )
) un
CROSS JOIN (
  VALUES
    (0),
    (1),
    (2),
    (3),
    (4),
    (5),
    (6)
) AS dias(dia_semana)
ON CONFLICT (
  profissional_id,
  dia_semana
)
DO NOTHING;

COMMIT;