BEGIN;

CREATE TABLE usuarios_negocios (
  id BIGINT
    GENERATED ALWAYS AS IDENTITY
    PRIMARY KEY,

  usuario_id BIGINT
    NOT NULL,

  negocio_id BIGINT
    NOT NULL,

  papel VARCHAR(20)
    NOT NULL,

  ativo BOOLEAN
    NOT NULL
    DEFAULT TRUE,

  created_at TIMESTAMPTZ
    NOT NULL
    DEFAULT NOW(),

  updated_at TIMESTAMPTZ
    NOT NULL
    DEFAULT NOW(),

  CONSTRAINT usuarios_negocios_usuario_fk
    FOREIGN KEY (usuario_id)
    REFERENCES usuarios (id)
    ON UPDATE CASCADE
    ON DELETE CASCADE,

  CONSTRAINT usuarios_negocios_negocio_fk
    FOREIGN KEY (negocio_id)
    REFERENCES negocios (id)
    ON UPDATE CASCADE
    ON DELETE CASCADE,

  CONSTRAINT usuarios_negocios_papel_valido
    CHECK (
      papel IN (
        'dono',
        'profissional'
      )
    ),

  CONSTRAINT usuarios_negocios_vinculo_unico
    UNIQUE (
      usuario_id,
      negocio_id
    )
);

/*
 * Cada negócio possui somente
 * um dono ativo.
 *
 * Um novo dono poderá ser definido
 * depois que o vínculo anterior
 * for desativado.
 */
CREATE UNIQUE INDEX
  usuarios_negocios_dono_ativo_unique
ON usuarios_negocios (
  negocio_id
)
WHERE
  papel = 'dono'
  AND ativo = TRUE;

/*
 * Uma conta atuando como profissional
 * pode trabalhar em somente um negócio
 * ativo por vez.
 */
CREATE UNIQUE INDEX
  usuarios_negocios_profissional_ativo_unique
ON usuarios_negocios (
  usuario_id
)
WHERE
  papel = 'profissional'
  AND ativo = TRUE;

/*
 * Utilizado para descobrir rapidamente
 * os vínculos ativos de uma conta.
 */
CREATE INDEX
  usuarios_negocios_usuario_ativo_idx
ON usuarios_negocios (
  usuario_id,
  papel
)
WHERE ativo = TRUE;

/*
 * Utilizado para listar a equipe
 * ativa de um negócio.
 */
CREATE INDEX
  usuarios_negocios_negocio_ativo_idx
ON usuarios_negocios (
  negocio_id,
  papel,
  usuario_id
)
WHERE ativo = TRUE;

CREATE TRIGGER
  trigger_usuarios_negocios_updated_at
BEFORE UPDATE
ON usuarios_negocios
FOR EACH ROW
EXECUTE FUNCTION atualizar_updated_at();

COMMENT ON TABLE usuarios_negocios IS
  'Vínculos entre contas e negócios, com papel contextual de dono ou profissional.';

COMMENT ON COLUMN usuarios_negocios.papel IS
  'Papel desempenhado pela conta dentro do negócio: dono ou profissional.';

COMMENT ON COLUMN usuarios_negocios.ativo IS
  'Indica se o vínculo ainda está ativo.';

COMMIT;