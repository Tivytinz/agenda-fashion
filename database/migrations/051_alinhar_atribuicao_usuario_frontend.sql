BEGIN;

/*
 * O navegador já preserva estes identificadores no first e no last touch.
 * A tabela de atribuição da conta precisa manter o mesmo contrato para que o
 * funil administrativo não perca campanhas entre o clique e o cadastro.
 */
ALTER TABLE marketing_usuario_atribuicoes
  ALTER COLUMN gclid TYPE VARCHAR(200),
  ALTER COLUMN fbclid TYPE VARCHAR(200),
  ALTER COLUMN last_gclid TYPE VARCHAR(200),
  ALTER COLUMN last_fbclid TYPE VARCHAR(200),
  ADD COLUMN IF NOT EXISTS gbraid VARCHAR(200),
  ADD COLUMN IF NOT EXISTS wbraid VARCHAR(200),
  ADD COLUMN IF NOT EXISTS msclkid VARCHAR(200),
  ADD COLUMN IF NOT EXISTS ttclid VARCHAR(200),
  ADD COLUMN IF NOT EXISTS epik VARCHAR(200),
  ADD COLUMN IF NOT EXISTS af_source VARCHAR(80),
  ADD COLUMN IF NOT EXISTS af_medium VARCHAR(80),
  ADD COLUMN IF NOT EXISTS af_content VARCHAR(80),
  ADD COLUMN IF NOT EXISTS last_gbraid VARCHAR(200),
  ADD COLUMN IF NOT EXISTS last_wbraid VARCHAR(200),
  ADD COLUMN IF NOT EXISTS last_msclkid VARCHAR(200),
  ADD COLUMN IF NOT EXISTS last_ttclid VARCHAR(200),
  ADD COLUMN IF NOT EXISTS last_epik VARCHAR(200),
  ADD COLUMN IF NOT EXISTS last_af_source VARCHAR(80),
  ADD COLUMN IF NOT EXISTS last_af_medium VARCHAR(80),
  ADD COLUMN IF NOT EXISTS last_af_content VARCHAR(80);

COMMIT;
