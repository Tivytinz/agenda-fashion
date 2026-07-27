BEGIN;

ALTER TABLE negocios
ADD COLUMN IF NOT EXISTS asaas_customer_id VARCHAR(100);

CREATE UNIQUE INDEX IF NOT EXISTS
  negocios_asaas_customer_id_unique
ON negocios (asaas_customer_id)
WHERE asaas_customer_id IS NOT NULL;

COMMIT;