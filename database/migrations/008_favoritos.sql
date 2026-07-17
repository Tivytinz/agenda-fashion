BEGIN;

-- =========================================================
-- COMPATIBILIDADE COM O MODELO ANTIGO
-- cliente_id agora representa usuario_id.
-- =========================================================

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'favoritos'
  )
  AND EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'favoritos'
      AND column_name = 'cliente_id'
  )
  AND NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'favoritos'
      AND column_name = 'usuario_id'
  ) THEN
    ALTER TABLE favoritos
      RENAME COLUMN cliente_id
      TO usuario_id;
  END IF;
END;
$$;

-- =========================================================
-- TABELA DE FAVORITOS
-- Qualquer conta autenticada pode favoritar um negócio.
-- =========================================================

CREATE TABLE IF NOT EXISTS favoritos (
  id BIGINT
    GENERATED ALWAYS AS IDENTITY
    PRIMARY KEY,

  usuario_id BIGINT
    NOT NULL,

  negocio_id BIGINT
    NOT NULL,

  created_at TIMESTAMPTZ
    NOT NULL
    DEFAULT NOW(),

  updated_at TIMESTAMPTZ
    NOT NULL
    DEFAULT NOW(),

  CONSTRAINT favoritos_usuario_fk
    FOREIGN KEY (usuario_id)
    REFERENCES usuarios(id)
    ON DELETE CASCADE,

  CONSTRAINT favoritos_negocio_fk
    FOREIGN KEY (negocio_id)
    REFERENCES negocios(id)
    ON DELETE CASCADE
);

-- Adiciona colunas ausentes caso umaa colunas ausentes caso uma versão antiga
-- da tabela já exista.

ALTER TABLE favoritos
  ADD COLUMN IF NOT EXISTS
    usuario_id BIGINT;

ALTER TABLE favoritos
  ADD COLUMN IF NOT EXISTS
    negocio_id BIGINT;

ALTER TABLE favoritos
  ADD COLUMN IF NOT EXISTS
    created_at TIMESTAMPTZ
    NOT NULL
    DEFAULT NOW();

ALTER TABLE favoritos
  ADD COLUMN IF NOT EXISTS
    updated_at TIMESTAMPTZ
    NOT NULL
    DEFAULT NOW();

-- =========================================================
-- CHAVES E RESTRIÇÕES PARA TABELAS ANTIGAS
-- =========================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'favoritos_usuario_fk'
  ) THEN
    ALTER TABLE favoritos
      ADD CONSTRAINT favoritos_usuario_fk
      FOREIGN KEY (usuario_id)
      REFERENCES usuarios(id)
      ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'favoritos_negocio_fk'
  ) THEN
    ALTER TABLE favoritos
      ADD CONSTRAINT favoritos_negocio_fk
      FOREIGN KEY (negocio_id)
      REFERENCES negocios(id)
      ON DELETE CASCADE;
  END IF;
END;
$$;

ALTER TABLE favoritos
  ALTER COLUMN usuario_id
  SET NOT NULL;

ALTER TABLE favoritos
  ALTER COLUMN negocio_id
  SET NOT NULL;

-- Um usuário só pode favoritar
-- cada negócio uma vez.

CREATE UNIQUE INDEX IF NOT EXISTS
  favoritos_usuario_negocio_unique
ON favoritos (
  usuario_id,
  negocio_id
);

CREATE INDEX IF NOT EXISTS
  favoritos_usuario_idx
ON favoritos (
  usuario_id
);

CREATE INDEX IF NOT EXISTS
  favoritos_negocio_idx
ON favoritos (
  negocio_id
);

CREATE INDEX IF NOT EXISTS
  favoritos_created_at_idx
ON favoritos (
  created_at DESC
);

-- =========================================================
-- UPDATED_AT
-- =========================================================

CREATE OR REPLACE FUNCTION atualizar_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS
  favoritos_updated_at_trigger
ON favoritos;

CREATE TRIGGER
  favoritos_updated_at_trigger
BEFORE UPDATE
ON favoritos
FOR EACH ROW
EXECUTE FUNCTION atualizar_updated_at();

COMMIT;
