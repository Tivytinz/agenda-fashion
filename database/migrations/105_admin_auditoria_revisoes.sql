BEGIN;

-- Links an audited review action to the UUID of the attempt being reviewed.
ALTER TABLE admin_auditoria_eventos
  ADD COLUMN alvo_tentativa_id UUID;

CREATE TABLE admin_auditoria_revisoes (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  tentativa_id UUID NOT NULL UNIQUE,
  fase_iniciada VARCHAR(12) NOT NULL DEFAULT 'INICIADA'
    CHECK (fase_iniciada = 'INICIADA'),
  revisor_usuario_id BIGINT NOT NULL CHECK (revisor_usuario_id > 0),
  avaliacao VARCHAR(24) NOT NULL CHECK (avaliacao IN (
    'EFEITO_OBSERVADO', 'SEM_EFEITO_OBSERVADO', 'INDETERMINADO'
  )),
  evidencia_tipo VARCHAR(24) NOT NULL CHECK (evidencia_tipo IN (
    'LOG_APLICACAO', 'TRILHA_DOMINIO', 'PROVEDOR'
  )),
  evidencia_referencia_sha256 CHAR(64) NOT NULL
    CHECK (evidencia_referencia_sha256 ~ '^[a-f0-9]{64}$'),
  revisado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT admin_auditoria_revisao_tentativa_fk
    FOREIGN KEY (tentativa_id, fase_iniciada)
    REFERENCES admin_auditoria_eventos(tentativa_id, fase)
);

CREATE TRIGGER admin_auditoria_revisoes_append_only
BEFORE UPDATE OR DELETE ON admin_auditoria_revisoes
FOR EACH ROW EXECUTE FUNCTION bloquear_mutacao_admin_auditoria_eventos();

CREATE TRIGGER admin_auditoria_revisoes_sem_truncate
BEFORE TRUNCATE ON admin_auditoria_revisoes
FOR EACH STATEMENT EXECUTE FUNCTION bloquear_mutacao_admin_auditoria_eventos();

COMMENT ON TABLE admin_auditoria_revisoes IS
  'Revisao humana de uma tentativa sem resultado HTTP; nao infere resposta HTTP nem substitui o ledger original.';
COMMENT ON COLUMN admin_auditoria_revisoes.evidencia_referencia_sha256 IS
  'Hash de referencia operacional informada pelo revisor; nunca persistir token, URL, payload ou contato em claro.';

COMMIT;
