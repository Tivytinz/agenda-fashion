BEGIN;

ALTER TABLE checkout_tentativas
  ADD COLUMN IF NOT EXISTS lease_tentativa INTEGER;

UPDATE checkout_tentativas
SET lease_tentativa = 1
WHERE lease_tentativa IS NULL;

ALTER TABLE checkout_tentativas
  ALTER COLUMN lease_tentativa SET DEFAULT 1;

ALTER TABLE checkout_tentativas
  ALTER COLUMN lease_tentativa SET NOT NULL;

ALTER TABLE checkout_tentativas
  DROP CONSTRAINT IF EXISTS checkout_tentativas_lease_tentativa_valida;

ALTER TABLE checkout_tentativas
  ADD CONSTRAINT checkout_tentativas_lease_tentativa_valida
  CHECK (lease_tentativa >= 1);

COMMENT ON COLUMN checkout_tentativas.lease_tentativa IS
  'Versão monotônica da execução que possui o direito de finalizar a tentativa de checkout.';

COMMIT;
