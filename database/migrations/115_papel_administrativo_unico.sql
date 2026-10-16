BEGIN;

-- Unifica o papel atual sem reativar contas ou permissões revogadas.
-- Eventos de auditoria e marcos financeiros antigos são snapshots históricos:
-- seus rótulos originais, inclusive superadmin, não devem ser reescritos.
ALTER TABLE usuarios_administradores
  DROP CONSTRAINT usuarios_administradores_papel_check;

UPDATE usuarios_administradores
SET papel = 'admin', updated_at = NOW()
WHERE papel = 'superadmin';

ALTER TABLE usuarios_administradores
  ADD CONSTRAINT usuarios_administradores_papel_check CHECK (papel = 'admin');

COMMENT ON COLUMN usuarios_administradores.papel IS
  'Papel administrativo global único: admin. Histórico de auditoria preserva o papel original de cada evento.';

COMMIT;
