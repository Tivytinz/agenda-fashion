BEGIN;

CREATE TABLE marketing_usuario_atribuicoes (
  usuario_id BIGINT
    PRIMARY KEY
    REFERENCES usuarios(id)
    ON DELETE CASCADE,

  intencao VARCHAR(24)
    NOT NULL
    DEFAULT 'indefinida',

  sessao_id VARCHAR(64),

  utm_source VARCHAR(80),
  utm_medium VARCHAR(80),
  utm_campaign VARCHAR(140),
  utm_content VARCHAR(140),
  utm_term VARCHAR(140),

  gclid VARCHAR(160),
  fbclid VARCHAR(160),

  landing_page VARCHAR(500),

  atribuicao_em TIMESTAMPTZ
    NOT NULL
    DEFAULT NOW(),

  created_at TIMESTAMPTZ
    NOT NULL
    DEFAULT NOW(),

  updated_at TIMESTAMPTZ
    NOT NULL
    DEFAULT NOW(),

  CONSTRAINT marketing_usuario_atribuicoes_intencao_valida
    CHECK (
      intencao IN (
        'indefinida',
        'cliente',
        'profissional'
      )
    ),

  CONSTRAINT marketing_usuario_atribuicoes_sessao_valida
    CHECK (
      sessao_id IS NULL
      OR sessao_id ~ '^[A-Za-z0-9_-]{8,64}$'
    ),

  CONSTRAINT marketing_usuario_atribuicoes_landing_interna
    CHECK (
      landing_page IS NULL
      OR (
        LEFT(landing_page, 1) = '/'
        AND LEFT(landing_page, 2) <> '//'
        AND POSITION(E'\\' IN landing_page) = 0
      )
    )
);

CREATE INDEX marketing_usuario_atribuicoes_funil_idx
  ON marketing_usuario_atribuicoes (
    intencao,
    atribuicao_em DESC
  );

CREATE INDEX marketing_usuario_atribuicoes_campanha_idx
  ON marketing_usuario_atribuicoes (
    utm_source,
    utm_medium,
    utm_campaign
  );

ALTER TABLE agenda_configuracoes
  ADD COLUMN IF NOT EXISTS
    configurado_em TIMESTAMPTZ;

ALTER TABLE negocios
  ADD COLUMN IF NOT EXISTS
    primeiro_servico_criado_em TIMESTAMPTZ;

ALTER TABLE negocios
  ADD COLUMN IF NOT EXISTS
    primeira_publicacao_em TIMESTAMPTZ;

/*
 * O histórico anterior não possuía marcos explícitos. Para serviços ainda
 * existentes, recuperamos com precisão a primeira criação conhecida.
 */
UPDATE negocios n
SET primeiro_servico_criado_em = dados.primeiro_servico_em
FROM (
  SELECT
    negocio_id,
    MIN(created_at) AS primeiro_servico_em
  FROM servicos_negocio
  GROUP BY negocio_id
) dados
WHERE dados.negocio_id = n.id
  AND n.primeiro_servico_criado_em IS NULL;

/*
 * Para negócios já publicados antes desta migration, updated_at é a melhor
 * evidência disponível do marco histórico. A partir daqui o primeiro momento
 * de publicação será preservado exatamente.
 */
UPDATE negocios
SET primeira_publicacao_em = updated_at
WHERE publicado = TRUE
  AND primeira_publicacao_em IS NULL;

/*
 * Contas que já são donas entram no funil como profissionais orgânicos. A
 * data da conta preserva a coorte original sem inventar uma aquisição nova.
 */
INSERT INTO marketing_usuario_atribuicoes (
  usuario_id,
  intencao,
  atribuicao_em
)
SELECT DISTINCT
  u.id,
  'profissional',
  u.created_at
FROM usuarios u
INNER JOIN usuarios_negocios un
  ON un.usuario_id = u.id
WHERE un.papel = 'dono'
ON CONFLICT (usuario_id)
DO UPDATE SET
  intencao = 'profissional',
  updated_at = NOW();

COMMIT;
