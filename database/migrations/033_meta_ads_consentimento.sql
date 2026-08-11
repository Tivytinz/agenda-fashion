BEGIN;

ALTER TABLE marketing_usuario_atribuicoes
  ADD COLUMN IF NOT EXISTS meta_consentido_em TIMESTAMPTZ;

ALTER TABLE marketing_usuario_atribuicoes
  ADD COLUMN IF NOT EXISTS meta_fbp VARCHAR(255);

ALTER TABLE marketing_usuario_atribuicoes
  ADD COLUMN IF NOT EXISTS meta_fbc VARCHAR(255);

COMMENT ON COLUMN marketing_usuario_atribuicoes.meta_consentido_em IS
  'Momento em que o usuário autorizou o uso opcional das ferramentas de publicidade da Meta.';

COMMENT ON COLUMN marketing_usuario_atribuicoes.meta_fbp IS
  'Identificador pseudônimo _fbp, persistido somente enquanto houver consentimento de marketing.';

COMMENT ON COLUMN marketing_usuario_atribuicoes.meta_fbc IS
  'Identificador pseudônimo _fbc, persistido somente enquanto houver consentimento de marketing.';

COMMIT;
