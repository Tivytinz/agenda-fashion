BEGIN;

ALTER TABLE assinaturas
  ADD COLUMN IF NOT EXISTS reativacao_tentativa INTEGER;

UPDATE assinaturas
SET reativacao_tentativa = 0
WHERE reativacao_tentativa IS NULL;

ALTER TABLE assinaturas
  ALTER COLUMN reativacao_tentativa SET DEFAULT 0;

ALTER TABLE assinaturas
  ALTER COLUMN reativacao_tentativa SET NOT NULL;

ALTER TABLE assinaturas
  DROP CONSTRAINT IF EXISTS assinaturas_reativacao_tentativa_valida;

ALTER TABLE assinaturas
  ADD CONSTRAINT assinaturas_reativacao_tentativa_valida
  CHECK (reativacao_tentativa >= 0);

COMMENT ON COLUMN assinaturas.reativacao_tentativa IS
  'Versão monotônica usada para identificar de forma idempotente cada ciclo de reativação da renovação no Asaas.';

COMMIT;
