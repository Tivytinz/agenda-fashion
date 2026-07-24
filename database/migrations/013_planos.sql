BEGIN;

CREATE TABLE IF NOT EXISTS planos (
  id SERIAL PRIMARY KEY,

  nome VARCHAR(100) NOT NULL,

  slug VARCHAR(80) NOT NULL UNIQUE,

  valor NUMERIC(10, 2) NOT NULL DEFAULT 0,

  capacidade_agendamentos INTEGER,

  destaque BOOLEAN NOT NULL DEFAULT FALSE,

  ativo BOOLEAN NOT NULL DEFAULT TRUE,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT planos_valor_valido
    CHECK (valor >= 0),

  CONSTRAINT planos_capacidade_valida
    CHECK (
      capacidade_agendamentos IS NULL
      OR capacidade_agendamentos > 0
    )
);

/*
 * Plano provisório para desenvolvimento e beta.
 * A capacidade alta evita bloquear os testes atuais.
 */
INSERT INTO planos (
  nome,
  slug,
  valor,
  capacidade_agendamentos,
  destaque,
  ativo
)
VALUES (
  'Plano inicial',
  'inicial',
  0.00,
  1000,
  FALSE,
  TRUE
)
ON CONFLICT (slug) DO NOTHING;

/*
 * Vinculação do negócio ao plano.
 */
ALTER TABLE negocios
ADD COLUMN IF NOT EXISTS plano_id INTEGER;

/*
 * Vincula os negócios que já existem
 * ao plano inicial.
 */
UPDATE negocios
SET plano_id = (
  SELECT id
  FROM planos
  WHERE slug = 'inicial'
  LIMIT 1
)
WHERE plano_id IS NULL;

/*
 * Cria a chave estrangeira somente
 * quando ela ainda não existir.
 */
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'negocios_plano_id_fk'
  ) THEN
    ALTER TABLE negocios
    ADD CONSTRAINT negocios_plano_id_fk
      FOREIGN KEY (plano_id)
      REFERENCES planos(id)
      ON UPDATE CASCADE
      ON DELETE RESTRICT;
  END IF;
END
$$;

ALTER TABLE negocios
ALTER COLUMN plano_id SET NOT NULL;

CREATE INDEX IF NOT EXISTS
  negocios_plano_id_idx
ON negocios(plano_id);

/*
 * Garante que novos negócios recebam
 * automaticamente o plano inicial.
 */
CREATE OR REPLACE FUNCTION definir_plano_inicial_negocio()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.plano_id IS NULL THEN
    SELECT id
    INTO NEW.plano_id
    FROM planos
    WHERE slug = 'inicial'
      AND ativo = TRUE
    LIMIT 1;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS
  negocios_definir_plano_inicial
ON negocios;

CREATE TRIGGER negocios_definir_plano_inicial
BEFORE INSERT ON negocios
FOR EACH ROW
EXECUTE FUNCTION definir_plano_inicial_negocio();

COMMIT;