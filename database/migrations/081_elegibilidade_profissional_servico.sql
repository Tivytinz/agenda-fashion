-- Wave 4 P0: elegibilidade explícita profissional-serviço.
-- Backfill preserva o comportamento atual dos negócios existentes.

CREATE TABLE IF NOT EXISTS servicos_profissionais (
  negocio_id BIGINT NOT NULL,
  servico_id BIGINT NOT NULL,
  profissional_id BIGINT NOT NULL,
  created_by_user_id BIGINT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT servicos_profissionais_pk
    PRIMARY KEY (servico_id, profissional_id),

  CONSTRAINT servicos_profissionais_negocio_fk
    FOREIGN KEY (negocio_id)
    REFERENCES negocios(id)
    ON DELETE CASCADE,

  CONSTRAINT servicos_profissionais_servico_fk
    FOREIGN KEY (servico_id)
    REFERENCES servicos_negocio(id)
    ON DELETE CASCADE,

  CONSTRAINT servicos_profissionais_profissional_fk
    FOREIGN KEY (profissional_id)
    REFERENCES usuarios(id)
    ON DELETE CASCADE,

  CONSTRAINT servicos_profissionais_created_by_fk
    FOREIGN KEY (created_by_user_id)
    REFERENCES usuarios(id)
    ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS
  servicos_profissionais_negocio_profissional_idx
ON servicos_profissionais (
  negocio_id,
  profissional_id
);

CREATE INDEX IF NOT EXISTS
  servicos_profissionais_negocio_servico_idx
ON servicos_profissionais (
  negocio_id,
  servico_id
);

-- Compatibilidade: até esta migration qualquer profissional ativa do negócio
-- podia ser escolhida para qualquer serviço. Preservamos isso apenas no
-- backfill; novas relações passam a ser explícitas.
INSERT INTO servicos_profissionais (
  negocio_id,
  servico_id,
  profissional_id,
  created_by_user_id
)
SELECT
  s.negocio_id,
  s.id,
  un.usuario_id,
  dono.usuario_id
FROM servicos_negocio s
INNER JOIN usuarios_negocios un
  ON un.negocio_id = s.negocio_id
  AND un.ativo = TRUE
  AND un.papel IN ('dono', 'profissional')
INNER JOIN usuarios u
  ON u.id = un.usuario_id
  AND u.ativo = TRUE
LEFT JOIN LATERAL (
  SELECT owner_un.usuario_id
  FROM usuarios_negocios owner_un
  WHERE owner_un.negocio_id = s.negocio_id
    AND owner_un.papel = 'dono'
    AND owner_un.ativo = TRUE
  ORDER BY owner_un.id
  LIMIT 1
) dono ON TRUE
ON CONFLICT (servico_id, profissional_id)
DO NOTHING;
