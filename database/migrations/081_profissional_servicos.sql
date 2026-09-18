BEGIN;

CREATE UNIQUE INDEX IF NOT EXISTS
  servicos_negocio_id_negocio_unique_idx
ON servicos_negocio (
  id,
  negocio_id
);

CREATE TABLE IF NOT EXISTS profissional_servicos (
  negocio_id BIGINT
    NOT NULL,

  profissional_id BIGINT
    NOT NULL,

  servico_id BIGINT
    NOT NULL,

  habilitado_por_usuario_id BIGINT,

  habilitado_em TIMESTAMPTZ
    NOT NULL
    DEFAULT NOW(),

  PRIMARY KEY (
    negocio_id,
    profissional_id,
    servico_id
  ),

  CONSTRAINT profissional_servicos_vinculo_fk
    FOREIGN KEY (
      profissional_id,
      negocio_id
    )
    REFERENCES usuarios_negocios (
      usuario_id,
      negocio_id
    )
    ON UPDATE CASCADE
    ON DELETE CASCADE,

  CONSTRAINT profissional_servicos_servico_fk
    FOREIGN KEY (
      servico_id,
      negocio_id
    )
    REFERENCES servicos_negocio (
      id,
      negocio_id
    )
    ON UPDATE CASCADE
    ON DELETE CASCADE,

  CONSTRAINT profissional_servicos_habilitado_por_fk
    FOREIGN KEY (
      habilitado_por_usuario_id
    )
    REFERENCES usuarios(id)
    ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS
  profissional_servicos_servico_idx
ON profissional_servicos (
  negocio_id,
  servico_id,
  profissional_id
);

CREATE INDEX IF NOT EXISTS
  profissional_servicos_profissional_idx
ON profissional_servicos (
  negocio_id,
  profissional_id,
  servico_id
);

/*
 * Compatibilidade de rollout:
 * materializa todos os pares profissional-serviço que o sistema legado
 * tratava implicitamente como elegíveis. A partir desta migration,
 * novos vínculos passam a ser explícitos.
 */
INSERT INTO profissional_servicos (
  negocio_id,
  profissional_id,
  servico_id,
  habilitado_por_usuario_id
)
SELECT
  un.negocio_id,
  un.usuario_id,
  s.id,
  dono.usuario_id
FROM usuarios_negocios un
INNER JOIN usuarios u
  ON u.id = un.usuario_id
  AND u.ativo = TRUE
INNER JOIN negocios n
  ON n.id = un.negocio_id
  AND n.ativo = TRUE
INNER JOIN servicos_negocio s
  ON s.negocio_id = un.negocio_id
LEFT JOIN usuarios_negocios dono
  ON dono.negocio_id = un.negocio_id
  AND dono.papel = 'dono'
  AND dono.ativo = TRUE
WHERE un.ativo = TRUE
  AND un.papel IN (
    'dono',
    'profissional'
  )
ON CONFLICT (
  negocio_id,
  profissional_id,
  servico_id
)
DO NOTHING;

/*
 * A elegibilidade é validada nas escritas de aplicação de booking e
 * reagendamento. O trigger global de vínculo da migration 068 permanece
 * responsável apenas por garantir o vínculo profissional-negócio ativo.
 * Isso preserva compatibilidade de fixtures/migrações administrativas que
 * materializam histórico diretamente por SQL.
 */

COMMENT ON TABLE profissional_servicos IS
'Relação explícita de serviços que cada profissional ativa está habilitada a executar em um negócio.';

COMMIT;
