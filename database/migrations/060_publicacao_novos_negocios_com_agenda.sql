BEGIN;

-- Preserva a regra de publicação dos negócios já existentes e marca somente
-- os novos cadastros para o onboarding completo.
ALTER TABLE negocios
  ADD COLUMN IF NOT EXISTS
    publicacao_exige_agenda BOOLEAN
    NOT NULL
    DEFAULT FALSE;

COMMENT ON COLUMN negocios.publicacao_exige_agenda IS
  'Quando verdadeiro, a publicação exige dados obrigatórios, serviço ativo e agenda confirmada.';

COMMIT;
