BEGIN;

-- =========================================================
-- AGENDAMENTOS
-- =========================================================

CREATE TABLE IF NOT EXISTS agendamentos (
  id BIGINT
    GENERATED ALWAYS AS IDENTITY
    PRIMARY KEY,

  negocio_id BIGINT
    NOT NULL,

  servico_id BIGINT
    NOT NULL,

  profissional_id BIGINT
    NOT NULL,

  cliente_id BIGINT
    NOT NULL,

  data DATE
    NOT NULL,

  horario TIME
    NOT NULL,

  status VARCHAR(20)
    NOT NULL
    DEFAULT 'agendado',

  avaliacao SMALLINT,

  observacoes TEXT,

  confirmado_em TIMESTAMPTZ,

  cancelado_em TIMESTAMPTZ,

  created_at TIMESTAMPTZ
    NOT NULL
    DEFAULT NOW(),

  updated_at TIMESTAMPTZ
    NOT NULL
    DEFAULT NOW(),

  CONSTRAINT agendamentos_negocio_fk
    FOREIGN KEY (negocio_id)
    REFERENCES negocios(id)
    ON DELETE RESTRICT,

  CONSTRAINT agendamentos_servico_fk
    FOREIGN KEY (servico_id)
    REFERENCES servicos_negocio(id)
    ON DELETE RESTRICT,

  CONSTRAINT agendamentos_profissional_fk
    FOREIGN KEY (profissional_id)
    REFERENCES usuarios(id)
    ON DELETE RESTRICT,

  CONSTRAINT agendamentos_cliente_fk
    FOREIGN KEY (cliente_id)
    REFERENCES usuarios(id)
    ON DELETE RESTRICT,

  CONSTRAINT agendamentos_status_check
    CHECK (
      status IN (
        'agendado',
        'confirmado',
        'cancelado',
        'realizado'
      )
    ),

  CONSTRAINT agendamentos_avaliacao_check
    CHECK (
      avaliacao IS NULL
      OR avaliacao BETWEEN 1 AND 5
    )
);

CREATE INDEX IF NOT EXISTS
  agendamentos_negocio_idx
ON agendamentos (
  negocio_id
);

CREATE INDEX IF NOT EXISTS
  agendamentos_servico_idx
ON agendamentos (
  servico_id
);

CREATE INDEX IF NOT EXISTS
  agendamentos_cliente_idx
ON agendamentos (
  cliente_id
);

CREATE INDEX IF NOT EXISTS
  agendamentos_profissional_data_idx
ON agendamentos (
  profissional_id,
  data
);

CREATE INDEX IF NOT EXISTS
  agendamentos_negocio_data_idx
ON agendamentos (
  negocio_id,
  data
);

CREATE INDEX IF NOT EXISTS
  agendamentos_status_idx
ON agendamentos (
  status
);

/*
 * Impede dois agendamentos ativos começando
 * exatamente no mesmo horário.
 *
 * Conflitos por duração continuam sendo
 * tratados pelo service com transação.
 */
CREATE UNIQUE INDEX IF NOT EXISTS
  agendamentos_horario_ativo_unique
ON agendamentos (
  profissional_id,
  data,
  horario
)
WHERE status IN (
  'agendado',
  'confirmado'
);

-- =========================================================
-- BLOQUEIOS MANUAIS DA AGENDA
-- =========================================================

CREATE TABLE IF NOT EXISTS bloqueios_horarios (
  id BIGINT
    GENERATED ALWAYS AS IDENTITY
    PRIMARY KEY,

  profissional_id BIGINT
    NOT NULL,

  data_bloqueio DATE
    NOT NULL,

  hora_bloqueio TIME
    NOT NULL,

  motivo VARCHAR(255),

  created_at TIMESTAMPTZ
    NOT NULL
    DEFAULT NOW(),

  updated_at TIMESTAMPTZ
    NOT NULL
    DEFAULT NOW(),

  CONSTRAINT bloqueios_horarios_profissional_fk
    FOREIGN KEY (profissional_id)
    REFERENCES usuarios(id)
    ON DELETE CASCADE,

  CONSTRAINT bloqueios_horarios_profissional_data_hora_unique
    UNIQUE (
      profissional_id,
      data_bloqueio,
      hora_bloqueio
    )
);

CREATE INDEX IF NOT EXISTS
  bloqueios_horarios_profissional_idx
ON bloqueios_horarios (
  profissional_id
);

CREATE INDEX IF NOT EXISTS
  bloqueios_horarios_profissional_data_idx
ON bloqueios_horarios (
  profissional_id,
  data_bloqueio
);

-- =========================================================
-- NOTIFICAÇÕES
-- =========================================================

CREATE TABLE IF NOT EXISTS notificacoes (
  id BIGINT
    GENERATED ALWAYS AS IDENTITY
    PRIMARY KEY,

  usuario_id BIGINT
    NOT NULL,

  negocio_id BIGINT,

  agendamento_id BIGINT,

  titulo VARCHAR(160)
    NOT NULL,

  mensagem TEXT
    NOT NULL,

  lida BOOLEAN
    NOT NULL
    DEFAULT FALSE,

  lida_em TIMESTAMPTZ,

  created_at TIMESTAMPTZ
    NOT NULL
    DEFAULT NOW(),

  updated_at TIMESTAMPTZ
    NOT NULL
    DEFAULT NOW(),

  CONSTRAINT notificacoes_usuario_fk
    FOREIGN KEY (usuario_id)
    REFERENCES usuarios(id)
    ON DELETE CASCADE,

  CONSTRAINT notificacoes_negocio_fk
    FOREIGN KEY (negocio_id)
    REFERENCES negocios(id)
    ON DELETE CASCADE,

  CONSTRAINT notificacoes_agendamento_fk
    FOREIGN KEY (agendamento_id)
    REFERENCES agendamentos(id)
    ON DELETE CASCADE,

  CONSTRAINT notificacoes_titulo_check
    CHECK (
      CHAR_LENGTH(
        BTRIM(titulo)
      ) BETWEEN 2 AND 160
    ),

  CONSTRAINT notificacoes_mensagem_check
    CHECK (
      CHAR_LENGTH(
        BTRIM(mensagem)
      ) >= 2
    )
);

CREATE INDEX IF NOT EXISTS
  notificacoes_usuario_idx
ON notificacoes (
  usuario_id
);

CREATE INDEX IF NOT EXISTS
  notificacoes_usuario_lida_idx
ON notificacoes (
  usuario_id,
  lida
);

CREATE INDEX IF NOT EXISTS
  notificacoes_negocio_idx
ON notificacoes (
  negocio_id
);

CREATE INDEX IF NOT EXISTS
  notificacoes_agendamento_idx
ON notificacoes (
  agendamento_id
);

-- =========================================================
-- UPDATED_AT
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
  agendamentos_updated_at_trigger
ON agendamentos;

CREATE TRIGGER
  agendamentos_updated_at_trigger
BEFORE UPDATE
ON agendamentos
FOR EACH ROW
EXECUTE FUNCTION atualizar_updated_at();

DROP TRIGGER IF EXISTS
  bloqueios_horarios_updated_at_trigger
ON bloqueios_horarios;

CREATE TRIGGER
  bloqueios_horarios_updated_at_trigger
BEFORE UPDATE
ON bloqueios_horarios
FOR EACH ROW
EXECUTE FUNCTION atualizar_updated_at();

DROP TRIGGER IF EXISTS
  notificacoes_updated_at_trigger
ON notificacoes;

CREATE TRIGGER
  notificacoes_updated_at_trigger
BEFORE UPDATE
ON notificacoes
FOR EACH ROW
EXECUTE FUNCTION atualizar_updated_at();

COMMIT;