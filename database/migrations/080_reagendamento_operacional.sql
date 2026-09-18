-- Wave 3 P0: suporte auditável ao início do atendimento e reagendamento.
-- O status principal continua CONFIRMADO/AGENDADO enquanto o atendimento está em curso.

ALTER TABLE agendamentos
  ADD COLUMN IF NOT EXISTS atendimento_iniciado_em TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS atendimento_iniciado_por BIGINT;

ALTER TABLE agendamentos
  DROP CONSTRAINT IF EXISTS agendamentos_atendimento_iniciado_por_fk;

ALTER TABLE agendamentos
  ADD CONSTRAINT agendamentos_atendimento_iniciado_por_fk
  FOREIGN KEY (atendimento_iniciado_por)
  REFERENCES usuarios(id)
  ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS
  agendamentos_atendimento_iniciado_por_idx
ON agendamentos (
  atendimento_iniciado_por
)
WHERE atendimento_iniciado_por IS NOT NULL;

CREATE TABLE IF NOT EXISTS agendamento_reagendamentos (
  id BIGINT
    GENERATED ALWAYS AS IDENTITY
    PRIMARY KEY,

  agendamento_id BIGINT
    NOT NULL,

  negocio_id BIGINT
    NOT NULL,

  actor_user_id BIGINT
    NOT NULL,

  actor_type VARCHAR(20)
    NOT NULL,

  previous_profissional_id BIGINT
    NOT NULL,

  new_profissional_id BIGINT
    NOT NULL,

  previous_data DATE
    NOT NULL,

  previous_horario TIME
    NOT NULL,

  new_data DATE
    NOT NULL,

  new_horario TIME
    NOT NULL,

  antecedencia_cancelamento_horas_snapshot INTEGER
    NOT NULL,

  created_at TIMESTAMPTZ
    NOT NULL
    DEFAULT NOW(),

  CONSTRAINT agendamento_reagendamentos_agendamento_fk
    FOREIGN KEY (agendamento_id)
    REFERENCES agendamentos(id)
    ON DELETE RESTRICT,

  CONSTRAINT agendamento_reagendamentos_negocio_fk
    FOREIGN KEY (negocio_id)
    REFERENCES negocios(id)
    ON DELETE RESTRICT,

  -- IDs de atores/profissionais são snapshots de auditoria.
  -- Não possuem FK para usuarios para que exclusão/anonymização futura
  -- da conta não torne o histórico de agendamento impossível de preservar.
  CONSTRAINT agendamento_reagendamentos_actor_type_check
    CHECK (
      actor_type IN ('OWNER', 'PROFESSIONAL')
    ),

  CONSTRAINT agendamento_reagendamentos_cutoff_check
    CHECK (
      antecedencia_cancelamento_horas_snapshot
      BETWEEN 0 AND 168
    )
);

CREATE INDEX IF NOT EXISTS
  agendamento_reagendamentos_agendamento_idx
ON agendamento_reagendamentos (
  agendamento_id,
  created_at DESC
);

CREATE INDEX IF NOT EXISTS
  agendamento_reagendamentos_negocio_idx
ON agendamento_reagendamentos (
  negocio_id,
  created_at DESC
);
