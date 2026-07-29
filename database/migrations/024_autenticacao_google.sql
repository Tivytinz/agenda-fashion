BEGIN;

ALTER TABLE usuarios
  ADD COLUMN IF NOT EXISTS
    google_sub VARCHAR(255);

ALTER TABLE usuarios
  ALTER COLUMN senha
    DROP NOT NULL;

ALTER TABLE usuarios
  ALTER COLUMN whatsapp
    DROP NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS
  usuarios_google_sub_unique
ON usuarios (google_sub)
WHERE google_sub IS NOT NULL;

COMMIT;
