BEGIN;

CREATE TABLE convites_profissionais (
  id BIGINT
    GENERATED ALWAYS AS IDENTITY
    PRIMARY KEY,

  negocio_id BIGINT
    NOT NULL,

  usuario_convidado_id BIGINT
    NOT NULL,

  convidado_por_usuario_id BIGINT
    NOT NULL,

  status VARCHAR(20)
    NOT NULL
    DEFAULT 'pendente',

  expira_em TIMESTAMPTZ
    NOT NULL,

  respondido_em TIMESTAMPTZ,

  created_at TIMESTAMPTZ
    NOT NULL
    DEFAULT NOW(),

  updated_at TIMESTAMPTZ
    NOT NULL
    DEFAULT NOW(),

  CONSTRAINT convites_profissionais_negocio_fk
    FOREIGN KEY (negocio_id)
    REFERENCES negocios (id)
    ON UPDATE CASCADE
    ON DELETE CASCADE,

  CONSTRAINT convites_profissionais_usuario_fk
    FOREIGN KEY (usuario_convidado_id)
    REFERENCES usuarios (id)
    ON UPDATE CASCADE
    ON DELETE CASCADE,

  CONSTRAINT convites_profissionais_convidado_por_fk
    FOREIGN KEY (convidado_por_usuario_id)
    REFERENCES usuarios (id)
    ON UPDATE CASCADE
    ON DELETE RESTRICT,

  CONSTRAINT convites_profissionais_status_valido
    CHECK (
      status IN (
        'pendente',
        'aceito',
        'recusado',
        'expirado',
        'cancelado'
      )
    ),

  CONSTRAINT convites_profissionais_expiracao_valida
    CHECK (expira_em > created_at)
);

CREATE UNIQUE INDEX
  convites_profissionais_pendente_unique
ON convites_profissionais (
  negocio_id,
  usuario_convidado_id
)
WHERE status = 'pendente';

CREATE INDEX
  convites_profissionais_recebidos_idx
ON convites_profissionais (
  usuario_convidado_id,
  status,
  expira_em,
  created_at DESC
);

CREATE INDEX
  convites_profissionais_negocio_idx
ON convites_profissionais (
  negocio_id,
  status,
  created_at DESC
);

CREATE TRIGGER
  trigger_convites_profissionais_updated_at
BEFORE UPDATE
ON convites_profissionais
FOR EACH ROW
EXECUTE FUNCTION atualizar_updated_at();

COMMENT ON TABLE convites_profissionais IS
  'Convites que exigem aceite autenticado antes de criar vínculo profissional-negócio.';

COMMIT;
