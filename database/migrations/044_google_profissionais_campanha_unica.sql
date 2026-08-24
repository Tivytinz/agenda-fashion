BEGIN;

/*
 * Aquisição de profissionais via Google passa a ter uma única identidade
 * oficial. Identidades históricas ou não reconhecidas deixam de participar
 * dos relatórios, sem apagar usuários, negócios ou eventos de produto.
 */
INSERT INTO marketing_campanhas (
  nome,
  canal,
  objetivo,
  utm_source,
  utm_medium,
  utm_campaign,
  destino_path,
  ativo
)
VALUES (
  'Google Ads · Aquisição de profissionais',
  'google',
  'profissional',
  'google',
  'cpc',
  'google_ads_profissionais',
  '/cadastro?tipo=profissional',
  TRUE
)
ON CONFLICT (
  utm_source,
  utm_medium,
  utm_campaign
)
DO UPDATE SET
  nome = EXCLUDED.nome,
  canal = EXCLUDED.canal,
  objetivo = EXCLUDED.objetivo,
  ativo = TRUE,
  updated_at = NOW();

/*
 * Se o vínculo real do Google Ads ainda estiver preso à identidade legada
 * conhecida, preserva esse vínculo na campanha oficial antes da limpeza.
 */
DO $$
DECLARE
  campanha_oficial_id BIGINT;
  campanha_legada_id BIGINT;
  vinculo_oficial_id BIGINT;
  vinculo_legado_id BIGINT;
BEGIN
  SELECT id
  INTO campanha_oficial_id
  FROM marketing_campanhas
  WHERE utm_source = 'google'
    AND utm_medium = 'cpc'
    AND utm_campaign = 'google_ads_profissionais'
  LIMIT 1;

  SELECT id
  INTO campanha_legada_id
  FROM marketing_campanhas
  WHERE utm_source = 'google'
    AND utm_medium = 'cpc'
    AND utm_campaign = 'profissionais_google_ads'
  LIMIT 1;

  IF campanha_legada_id IS NOT NULL THEN
    SELECT id
    INTO vinculo_oficial_id
    FROM marketing_campanha_vinculos
    WHERE campanha_id = campanha_oficial_id
      AND provedor = 'google_ads'
    LIMIT 1;

    SELECT id
    INTO vinculo_legado_id
    FROM marketing_campanha_vinculos
    WHERE campanha_id = campanha_legada_id
      AND provedor = 'google_ads'
    LIMIT 1;

    IF vinculo_oficial_id IS NULL
      AND vinculo_legado_id IS NOT NULL
    THEN
      UPDATE marketing_campanha_vinculos
      SET
        campanha_id = campanha_oficial_id,
        updated_at = NOW()
      WHERE id = vinculo_legado_id;
    END IF;
  END IF;
END;
$$;

/*
 * Custos de identidades não oficiais não são transferidos para a oficial.
 * Sem comprovação de equivalência, somá-los criaria CAC e ROAS falsos.
 */
DELETE FROM marketing_campanha_gastos gasto
USING marketing_campanhas campanha
WHERE gasto.campanha_id = campanha.id
  AND campanha.id <> (
    SELECT id
    FROM marketing_campanhas
    WHERE utm_source = 'google'
      AND utm_medium = 'cpc'
      AND utm_campaign = 'google_ads_profissionais'
    LIMIT 1
  )
  AND (
    (
      campanha.canal = 'google'
      AND campanha.objetivo = 'profissional'
    )
    OR (
      campanha.utm_source = 'google'
      AND campanha.utm_medium = 'cpc'
      AND campanha.utm_campaign IN (
        'aquisicao_profissionais',
        'search_aquisicao_profissionais',
        'profissionais_google_ads'
      )
    )
  );

/*
 * Remove cadastros de campanha duplicados/legados. Vínculos remanescentes de
 * plataforma são removidos por ON DELETE CASCADE; gastos já foram tratados.
 */
DELETE FROM marketing_campanhas campanha
WHERE NOT (
  campanha.utm_source = 'google'
  AND campanha.utm_medium = 'cpc'
  AND campanha.utm_campaign = 'google_ads_profissionais'
)
AND (
  (
    campanha.canal = 'google'
    AND campanha.objetivo = 'profissional'
  )
  OR (
    campanha.utm_source = 'google'
    AND campanha.utm_medium = 'cpc'
    AND campanha.utm_campaign IN (
      'aquisicao_profissionais',
      'search_aquisicao_profissionais',
      'profissionais_google_ads'
    )
  )
);

/*
 * Usuários permanecem no funil profissional, mas atribuições Google não
 * oficiais deixam de ser tratadas como mídia paga conhecida.
 */
UPDATE marketing_usuario_atribuicoes
SET
  utm_source = NULL,
  utm_medium = NULL,
  utm_campaign = NULL,
  utm_content = NULL,
  utm_term = NULL,
  gclid = NULL,
  fbclid = NULL,
  landing_page = NULL,
  updated_at = NOW()
WHERE intencao = 'profissional'
  AND (
    LOWER(COALESCE(utm_source, '')) = 'google'
    OR gclid IS NOT NULL
    OR LOWER(COALESCE(utm_campaign, '')) IN (
      'aquisicao_profissionais',
      'search_aquisicao_profissionais',
      'profissionais_google_ads'
    )
  )
  AND LOWER(COALESCE(utm_campaign, '')) <> 'google_ads_profissionais';

UPDATE marketing_usuario_atribuicoes
SET
  last_utm_source = NULL,
  last_utm_medium = NULL,
  last_utm_campaign = NULL,
  last_utm_content = NULL,
  last_utm_term = NULL,
  last_gclid = NULL,
  last_fbclid = NULL,
  last_landing_page = NULL,
  updated_at = NOW()
WHERE intencao = 'profissional'
  AND (
    LOWER(COALESCE(last_utm_source, '')) = 'google'
    OR last_gclid IS NOT NULL
    OR LOWER(COALESCE(last_utm_campaign, '')) IN (
      'aquisicao_profissionais',
      'search_aquisicao_profissionais',
      'profissionais_google_ads'
    )
  )
  AND LOWER(COALESCE(last_utm_campaign, '')) <> 'google_ads_profissionais';

/*
 * Limpa somente a atribuição das identidades antigas nos eventos. O evento de
 * produto continua existindo para métricas operacionais não relacionadas à
 * campanha.
 */
UPDATE eventos_produto
SET propriedades = propriedades
  - 'utm_source'
  - 'utm_medium'
  - 'utm_campaign'
  - 'utm_content'
  - 'utm_term'
  - 'gclid'
  - 'fbclid'
  - 'landing_page'
  - 'attribution_first_at'
WHERE LOWER(COALESCE(propriedades ->> 'utm_campaign', '')) IN (
  'aquisicao_profissionais',
  'search_aquisicao_profissionais',
  'profissionais_google_ads'
);

UPDATE eventos_produto
SET propriedades = propriedades
  - 'last_utm_source'
  - 'last_utm_medium'
  - 'last_utm_campaign'
  - 'last_utm_content'
  - 'last_utm_term'
  - 'last_gclid'
  - 'last_fbclid'
  - 'last_landing_page'
  - 'attribution_last_at'
WHERE LOWER(COALESCE(propriedades ->> 'last_utm_campaign', '')) IN (
  'aquisicao_profissionais',
  'search_aquisicao_profissionais',
  'profissionais_google_ads'
);

/*
 * Impede que browsers com atribuição antiga em localStorage recriem as mesmas
 * identidades nos eventos depois desta migração.
 */
CREATE OR REPLACE FUNCTION
  marketing_descartar_google_profissionais_legado_evento()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF LOWER(COALESCE(NEW.propriedades ->> 'utm_campaign', '')) IN (
    'aquisicao_profissionais',
    'search_aquisicao_profissionais',
    'profissionais_google_ads'
  ) THEN
    NEW.propriedades := NEW.propriedades
      - 'utm_source'
      - 'utm_medium'
      - 'utm_campaign'
      - 'utm_content'
      - 'utm_term'
      - 'gclid'
      - 'fbclid'
      - 'landing_page'
      - 'attribution_first_at';
  END IF;

  IF LOWER(COALESCE(NEW.propriedades ->> 'last_utm_campaign', '')) IN (
    'aquisicao_profissionais',
    'search_aquisicao_profissionais',
    'profissionais_google_ads'
  ) THEN
    NEW.propriedades := NEW.propriedades
      - 'last_utm_source'
      - 'last_utm_medium'
      - 'last_utm_campaign'
      - 'last_utm_content'
      - 'last_utm_term'
      - 'last_gclid'
      - 'last_fbclid'
      - 'last_landing_page'
      - 'attribution_last_at';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS
  marketing_descartar_google_profissionais_legado_evento_trigger
ON eventos_produto;

CREATE TRIGGER
  marketing_descartar_google_profissionais_legado_evento_trigger
BEFORE INSERT OR UPDATE OF propriedades
ON eventos_produto
FOR EACH ROW
EXECUTE FUNCTION
  marketing_descartar_google_profissionais_legado_evento();

/*
 * No funil de profissionais, qualquer atribuição Google que não use a UTM
 * oficial é descartada antes de persistir. Assim ela não pode contaminar CAC,
 * ROAS ou decisões de investimento.
 */
CREATE OR REPLACE FUNCTION
  marketing_manter_google_profissionais_oficial()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.intencao = 'profissional'
    AND (
      LOWER(COALESCE(NEW.utm_source, '')) = 'google'
      OR NEW.gclid IS NOT NULL
    )
    AND LOWER(COALESCE(NEW.utm_campaign, '')) <> 'google_ads_profissionais'
  THEN
    NEW.utm_source := NULL;
    NEW.utm_medium := NULL;
    NEW.utm_campaign := NULL;
    NEW.utm_content := NULL;
    NEW.utm_term := NULL;
    NEW.gclid := NULL;
    NEW.fbclid := NULL;
    NEW.landing_page := NULL;
  END IF;

  IF NEW.intencao = 'profissional'
    AND (
      LOWER(COALESCE(NEW.last_utm_source, '')) = 'google'
      OR NEW.last_gclid IS NOT NULL
    )
    AND LOWER(COALESCE(NEW.last_utm_campaign, '')) <> 'google_ads_profissionais'
  THEN
    NEW.last_utm_source := NULL;
    NEW.last_utm_medium := NULL;
    NEW.last_utm_campaign := NULL;
    NEW.last_utm_content := NULL;
    NEW.last_utm_term := NULL;
    NEW.last_gclid := NULL;
    NEW.last_fbclid := NULL;
    NEW.last_landing_page := NULL;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS
  marketing_manter_google_profissionais_oficial_trigger
ON marketing_usuario_atribuicoes;

CREATE TRIGGER
  marketing_manter_google_profissionais_oficial_trigger
BEFORE INSERT OR UPDATE
ON marketing_usuario_atribuicoes
FOR EACH ROW
EXECUTE FUNCTION
  marketing_manter_google_profissionais_oficial();

/*
 * A própria tabela de campanhas passa a impedir uma segunda campanha Google
 * classificada para aquisição de profissionais com outra identidade.
 */
ALTER TABLE marketing_campanhas
  DROP CONSTRAINT IF EXISTS
    marketing_campanhas_google_profissionais_oficial;

ALTER TABLE marketing_campanhas
  ADD CONSTRAINT
    marketing_campanhas_google_profissionais_oficial
  CHECK (
    NOT (
      canal = 'google'
      AND objetivo = 'profissional'
    )
    OR (
      utm_source = 'google'
      AND utm_medium = 'cpc'
      AND utm_campaign = 'google_ads_profissionais'
    )
  );

COMMENT ON CONSTRAINT
  marketing_campanhas_google_profissionais_oficial
ON marketing_campanhas IS
  'Aquisição de profissionais no Google usa somente a identidade oficial google/cpc/google_ads_profissionais.';

COMMIT;
