BEGIN;

-- =========================================================
-- ADMINISTRADORES DA PLATAFORMA
--
-- usuarios:
--   identidade, autenticação e dados da conta.
--
-- usuarios_negocios:
--   papéis dentro de um negócio:
--   dono ou profissional.
--
-- usuarios_administradores:
--   permissão administrativa global da plataforma.
-- =========================================================

CREATE TABLE IF NOT EXISTS usuarios_administradores (
  usuario_id INTEGER PRIMARY KEY,

  papel VARCHAR(20)
    NOT NULL
    DEFAULT 'admin',

  ativo BOOLEAN
    NOT NULL
    DEFAULT TRUE,

  created_at TIMESTAMPTZ
    NOT NULL
    DEFAULT NOW(),

  updated_at TIMESTAMPTZ
    NOT NULL
    DEFAULT NOW(),

  CONSTRAINT
    usuarios_administradores_usuario_fk
  FOREIGN KEY (
    usuario_id
  )
  REFERENCES usuarios (
    id
  )
  ON DELETE CASCADE,

  CONSTRAINT
    usuarios_administradores_papel_check
  CHECK (
    papel IN (
      'admin',
      'superadmin'
    )
  )
);

CREATE INDEX IF NOT EXISTS
  usuarios_administradores_ativos_idx
ON usuarios_administradores (
  usuario_id
)
WHERE ativo = TRUE;

COMMENT ON TABLE
  usuarios_administradores
IS
  'Usuários autorizados a administrar globalmente a plataforma Agenda Fashion.';

COMMENT ON COLUMN
  usuarios_administradores.papel
IS
  'Nível administrativo global: admin ou superadmin.';

-- =========================================================
-- COMPATIBILIDADE COM O MODELO ANTIGO
--
-- Caso a coluna usuarios.tipo ainda exista,
-- os administradores antigos são migrados
-- automaticamente.
-- =========================================================

DO $$
BEGIN
  IF EXISTS (
    SELECT 1

    FROM information_schema.columns

    WHERE table_schema = 'public'
      AND table_name = 'usuarios'
      AND column_name = 'tipo'
  ) THEN
    EXECUTE $sql$
      INSERT INTO usuarios_administradores (
        usuario_id,
        papel,
        ativo
      )

      SELECT
        id,
        'superadmin',
        TRUE

      FROM usuarios

      WHERE tipo = 'admin'

      ON CONFLICT (
        usuario_id
      )
      DO NOTHING
    $sql$;
  END IF;
END;
$$;

COMMIT;