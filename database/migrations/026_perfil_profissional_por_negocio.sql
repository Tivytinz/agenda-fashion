BEGIN;

ALTER TABLE usuarios_negocios
  ADD COLUMN IF NOT EXISTS nome_exibicao VARCHAR(120),
  ADD COLUMN IF NOT EXISTS whatsapp_exibicao VARCHAR(11);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'usuarios_negocios_nome_exibicao_check'
  ) THEN
    ALTER TABLE usuarios_negocios
      ADD CONSTRAINT usuarios_negocios_nome_exibicao_check
      CHECK (
        nome_exibicao IS NULL
        OR CHAR_LENGTH(BTRIM(nome_exibicao)) BETWEEN 2 AND 120
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'usuarios_negocios_whatsapp_exibicao_check'
  ) THEN
    ALTER TABLE usuarios_negocios
      ADD CONSTRAINT usuarios_negocios_whatsapp_exibicao_check
      CHECK (
        whatsapp_exibicao IS NULL
        OR whatsapp_exibicao ~ '^[0-9]{10,11}$'
      );
  END IF;
END;
$$;

COMMENT ON COLUMN usuarios_negocios.nome_exibicao IS
  'Nome público do profissional dentro deste negócio, sem alterar a conta global.';

COMMENT ON COLUMN usuarios_negocios.whatsapp_exibicao IS
  'WhatsApp público do profissional dentro deste negócio, sem alterar a conta global.';

COMMIT;
