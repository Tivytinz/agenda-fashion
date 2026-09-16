-- Registra quem cancelou um compromisso e em qual contexto, sem inventar
-- autoria para cancelamentos históricos anteriores a esta migration.

ALTER TABLE agendamentos
  ADD COLUMN IF NOT EXISTS cancelado_por BIGINT,
  ADD COLUMN IF NOT EXISTS cancelamento_origem VARCHAR(24),
  ADD COLUMN IF NOT EXISTS motivo_cancelamento VARCHAR(300);

ALTER TABLE agendamentos
  DROP CONSTRAINT IF EXISTS agendamentos_cancelado_por_fk;

ALTER TABLE agendamentos
  ADD CONSTRAINT agendamentos_cancelado_por_fk
  FOREIGN KEY (cancelado_por)
  REFERENCES usuarios(id)
  ON DELETE SET NULL;

ALTER TABLE agendamentos
  DROP CONSTRAINT IF EXISTS agendamentos_cancelamento_origem_check;

ALTER TABLE agendamentos
  ADD CONSTRAINT agendamentos_cancelamento_origem_check
  CHECK (
    cancelamento_origem IS NULL
    OR cancelamento_origem IN ('cliente', 'visitante', 'negocio')
  );

ALTER TABLE agendamentos
  DROP CONSTRAINT IF EXISTS agendamentos_motivo_cancelamento_check;

ALTER TABLE agendamentos
  ADD CONSTRAINT agendamentos_motivo_cancelamento_check
  CHECK (
    motivo_cancelamento IS NULL
    OR CHAR_LENGTH(BTRIM(motivo_cancelamento)) BETWEEN 1 AND 300
  );

CREATE INDEX IF NOT EXISTS agendamentos_cancelado_por_idx
  ON agendamentos(cancelado_por)
  WHERE cancelado_por IS NOT NULL;
