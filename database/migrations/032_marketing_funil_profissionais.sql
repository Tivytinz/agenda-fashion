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

/*
 * Se uma conta genérica criar um negócio depois, ela passa a integrar o
 * funil profissional preservando a atribuição que recebeu no cadastro.
 */
CREATE OR REPLACE FUNCTION
  marketing_marcar_usuario_dono_profissional()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.papel = 'dono' THEN
    INSERT INTO marketing_usuario_atribuicoes (
      usuario_id,
      intencao,
      atribuicao_em
    )
    SELECT
      u.id,
      'profissional',
      u.created_at
    FROM usuarios u
    WHERE u.id = NEW.usuario_id
    ON CONFLICT (usuario_id)
    DO UPDATE SET
      intencao = 'profissional',
      updated_at = NOW();
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS
  marketing_usuario_dono_profissional_trigger
ON usuarios_negocios;

CREATE TRIGGER
  marketing_usuario_dono_profissional_trigger
AFTER INSERT OR UPDATE OF papel
ON usuarios_negocios
FOR EACH ROW
EXECUTE FUNCTION
  marketing_marcar_usuario_dono_profissional();

/*
 * Primeiro serviço é um marco permanente do funil, mesmo se o serviço for
 * removido no futuro.
 */
CREATE OR REPLACE FUNCTION
  marketing_marcar_primeiro_servico()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE negocios
  SET primeiro_servico_criado_em =
    COALESCE(
      primeiro_servico_criado_em,
      NEW.created_at,
      NOW()
    )
  WHERE id = NEW.negocio_id
    AND primeiro_servico_criado_em IS NULL;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS
  marketing_primeiro_servico_trigger
ON servicos_negocio;

CREATE TRIGGER
  marketing_primeiro_servico_trigger
AFTER INSERT
ON servicos_negocio
FOR EACH ROW
EXECUTE FUNCTION
  marketing_marcar_primeiro_servico();

/*
 * A primeira publicação não desaparece do funil quando o dono decide ocultar
 * temporariamente o perfil.
 */
CREATE OR REPLACE FUNCTION
  marketing_marcar_primeira_publicacao()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.publicado = TRUE
    AND COALESCE(OLD.publicado, FALSE) = FALSE
    AND NEW.primeira_publicacao_em IS NULL
  THEN
    NEW.primeira_publicacao_em = NOW();
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS
  marketing_primeira_publicacao_trigger
ON negocios;

CREATE TRIGGER
  marketing_primeira_publicacao_trigger
BEFORE UPDATE OF publicado
ON negocios
FOR EACH ROW
EXECUTE FUNCTION
  marketing_marcar_primeira_publicacao();

COMMIT;
