BEGIN;

-- Base auditável para o primeiro caso de Machine Learning do AF.
--
-- A amostra contém somente atributos operacionais disponíveis no momento em
-- que o booking foi criado. Nome, telefone, texto livre e identificadores de
-- campanha não são copiados. O rótulo só nasce de um desfecho explícito do
-- ciclo de atendimento: realizado (FALSE) ou falta (TRUE).
CREATE TABLE IF NOT EXISTS ml_agendamento_no_show_amostras (
  agendamento_id BIGINT
    PRIMARY KEY,

  negocio_id BIGINT
    NOT NULL,

  feature_version VARCHAR(20)
    NOT NULL
    DEFAULT 'v1',

  antecedencia_horas NUMERIC(12, 2)
    NOT NULL,

  dia_semana SMALLINT
    NOT NULL,

  minuto_dia SMALLINT
    NOT NULL,

  duracao_minutos INTEGER
    NOT NULL,

  cliente_tem_conta BOOLEAN
    NOT NULL,

  cliente_agendamentos_anteriores INTEGER
    NOT NULL,

  cliente_faltas_anteriores INTEGER
    NOT NULL,

  negocio_agendamentos_anteriores INTEGER
    NOT NULL,

  negocio_faltas_anteriores INTEGER
    NOT NULL,

  rotulo_falta BOOLEAN,

  rotulado_em TIMESTAMPTZ,

  capturado_em TIMESTAMPTZ
    NOT NULL
    DEFAULT NOW(),

  CONSTRAINT ml_no_show_agendamento_fk
    FOREIGN KEY (agendamento_id)
    REFERENCES agendamentos(id)
    ON DELETE CASCADE,

  CONSTRAINT ml_no_show_negocio_fk
    FOREIGN KEY (negocio_id)
    REFERENCES negocios(id)
    ON DELETE CASCADE,

  CONSTRAINT ml_no_show_feature_version_check
    CHECK (feature_version = 'v1'),

  CONSTRAINT ml_no_show_antecedencia_check
    CHECK (antecedencia_horas >= 0),

  CONSTRAINT ml_no_show_dia_semana_check
    CHECK (dia_semana BETWEEN 1 AND 7),

  CONSTRAINT ml_no_show_minuto_dia_check
    CHECK (minuto_dia BETWEEN 0 AND 1439),

  CONSTRAINT ml_no_show_duracao_check
    CHECK (duracao_minutos > 0),

  CONSTRAINT ml_no_show_historico_check
    CHECK (
      cliente_agendamentos_anteriores >= 0
      AND cliente_faltas_anteriores >= 0
      AND cliente_faltas_anteriores <= cliente_agendamentos_anteriores
      AND negocio_agendamentos_anteriores >= 0
      AND negocio_faltas_anteriores >= 0
      AND negocio_faltas_anteriores <= negocio_agendamentos_anteriores
    ),

  CONSTRAINT ml_no_show_rotulo_timestamp_check
    CHECK (
      (rotulo_falta IS NULL AND rotulado_em IS NULL)
      OR
      (rotulo_falta IS NOT NULL AND rotulado_em IS NOT NULL)
    )
);

CREATE INDEX IF NOT EXISTS
  ml_no_show_amostras_rotulo_idx
ON ml_agendamento_no_show_amostras (
  rotulo_falta,
  rotulado_em
)
WHERE rotulo_falta IS NOT NULL;

CREATE INDEX IF NOT EXISTS
  ml_no_show_amostras_negocio_idx
ON ml_agendamento_no_show_amostras (
  negocio_id,
  capturado_em
);

-- Índices parciais mantêm o backfill temporal escalável. Somente desfechos
-- explícitos podem compor o histórico anterior de uma feature.
CREATE INDEX IF NOT EXISTS
  agendamentos_ml_cliente_historico_idx
ON agendamentos (
  client_id,
  status_atendimento_em,
  created_at
)
WHERE status IN ('realizado', 'falta');

CREATE INDEX IF NOT EXISTS
  agendamentos_ml_negocio_historico_idx
ON agendamentos (
  negocio_id,
  status_atendimento_em,
  created_at
)
WHERE status IN ('realizado', 'falta');

CREATE INDEX IF NOT EXISTS
  agendamentos_ml_captura_idx
ON agendamentos (
  created_at,
  id
);

COMMENT ON TABLE ml_agendamento_no_show_amostras IS
  'Amostras sem PII para treinamento futuro de risco de falta; não autorizam decisão automática.';

COMMENT ON COLUMN ml_agendamento_no_show_amostras.rotulo_falta IS
  'TRUE para falta, FALSE para realizado e NULL enquanto não há desfecho observável.';

COMMIT;
