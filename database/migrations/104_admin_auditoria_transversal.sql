BEGIN;

-- An audit attempt is written before the administrative operation. Its result
-- is a separate row so the historical record cannot be rewritten.
CREATE TABLE admin_auditoria_eventos (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  tentativa_id UUID NOT NULL,
  fase VARCHAR(12) NOT NULL CHECK (fase IN ('INICIADA', 'RESULTADO')),
  ator_usuario_id BIGINT NOT NULL CHECK (ator_usuario_id > 0),
  papel_admin VARCHAR(20) NOT NULL CHECK (papel_admin IN ('admin', 'superadmin')),
  acao VARCHAR(80) NOT NULL CHECK (acao ~ '^[a-z0-9_]+$'),
  alvo_tipo VARCHAR(40) NOT NULL CHECK (alvo_tipo ~ '^[a-z0-9_]+$'),
  alvo_id BIGINT CHECK (alvo_id > 0),
  alvo_codigo VARCHAR(40) CHECK (alvo_codigo ~ '^[a-z0-9_]+$'),
  request_id VARCHAR(100),
  resultado VARCHAR(12) CHECK (resultado IN ('HTTP_OK', 'HTTP_ERRO')),
  http_status SMALLINT CHECK (http_status BETWEEN 100 AND 599),
  ocorrido_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT admin_auditoria_fase_resultado CHECK (
    (fase = 'INICIADA' AND resultado IS NULL AND http_status IS NULL)
    OR (fase = 'RESULTADO' AND resultado IS NOT NULL AND http_status IS NOT NULL)
  ),
  CONSTRAINT admin_auditoria_uma_fase UNIQUE (tentativa_id, fase)
);

CREATE INDEX admin_auditoria_data_idx
  ON admin_auditoria_eventos (ocorrido_em DESC, id DESC)
  WHERE fase = 'INICIADA';
CREATE INDEX admin_auditoria_ator_idx
  ON admin_auditoria_eventos (ator_usuario_id, ocorrido_em DESC, id DESC)
  WHERE fase = 'INICIADA';
CREATE INDEX admin_auditoria_acao_idx
  ON admin_auditoria_eventos (acao, ocorrido_em DESC, id DESC)
  WHERE fase = 'INICIADA';
CREATE INDEX admin_auditoria_alvo_idx
  ON admin_auditoria_eventos (alvo_tipo, alvo_id, ocorrido_em DESC)
  WHERE fase = 'INICIADA';

CREATE FUNCTION bloquear_mutacao_admin_auditoria_eventos()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'admin_auditoria_eventos e append-only';
END;
$$;

CREATE TRIGGER admin_auditoria_eventos_append_only
BEFORE UPDATE OR DELETE ON admin_auditoria_eventos
FOR EACH ROW EXECUTE FUNCTION bloquear_mutacao_admin_auditoria_eventos();

CREATE TRIGGER admin_auditoria_eventos_sem_truncate
BEFORE TRUNCATE ON admin_auditoria_eventos
FOR EACH STATEMENT EXECUTE FUNCTION bloquear_mutacao_admin_auditoria_eventos();

COMMENT ON TABLE admin_auditoria_eventos IS
  'Trilha administrativa transversal a partir da migration 104. Tentativas sem RESULTADO exigem investigacao; historico anterior nao foi inferido.';
COMMENT ON COLUMN admin_auditoria_eventos.ator_usuario_id IS
  'Snapshot historico do usuario administrador, sem FK para preservar auditoria apos encerramento da conta.';
COMMENT ON COLUMN admin_auditoria_eventos.request_id IS
  'SHA-256 do request id validado; nao contem URL, query, payload, token ou dados pessoais em claro.';

COMMIT;
