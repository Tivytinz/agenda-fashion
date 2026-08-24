BEGIN;

/*
 * Mantém uma única campanha oficial para aquisição de profissionais no Google.
 * A limpeza remove somente atribuição de marketing; usuários, negócios e
 * eventos de produto continuam preservados.
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
 * Remove investimento associado a qualquer outra campanha Google classificada
 * para profissionais e às três identidades históricas já observadas.
 */
DELETE FROM marketing_campanha_gastos
WHERE campanha_id IN (
  SELECT id
  FROM marketing_campanhas
  WHERE NOT (
    utm_source = 'google'
    AND utm_medium = 'cpc'
    AND utm_campaign = 'google_ads_profissionais'
  )
  AND (
    (
      canal = 'google'
      AND objetivo = 'profissional'
    )
    OR utm_campaign IN (
      'aquisicao_profissionais',
      'search_aquisicao_profissionais',
      'profissionais_google_ads'
    )
  )
);

/*
 * Vínculos externos dessas identidades também deixam de existir. A identidade
 * oficial já foi reconciliada pela migration 042 e permanece intacta.
 */
DELETE FROM marketing_campanha_vinculos
WHERE campanha_id IN (
  SELECT id
  FROM marketing_campanhas
  WHERE NOT (
    utm_source = 'google'
    AND utm_medium = 'cpc'
    AND utm_campaign = 'google_ads_profissionais'
  )
  AND (
    (
      canal = 'google'
      AND objetivo = 'profissional'
    )
    OR utm_campaign IN (
      'aquisicao_profissionais',
      'search_aquisicao_profissionais',
      'profissionais_google_ads'
    )
  )
);

DELETE FROM marketing_campanhas
WHERE NOT (
  utm_source = 'google'
  AND utm_medium = 'cpc'
  AND utm_campaign = 'google_ads_profissionais'
)
AND (
  (
    canal = 'google'
    AND objetivo = 'profissional'
  )
  OR utm_campaign IN (
    'aquisicao_profissionais',
    'search_aquisicao_profissionais',
    'profissionais_google_ads'
  )
);

/*
 * Mantém os profissionais no funil, mas remove a origem paga quando ela não é
 * a campanha oficial. Assim os cadastros continuam existindo sem contaminar
 * CAC, ROAS ou investimento da campanha conhecida.
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
  AND LOWER(COALESCE(utm_source, '')) = 'google'
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
  AND LOWER(COALESCE(last_utm_source, '')) = 'google'
  AND LOWER(COALESCE(last_utm_campaign, '')) <> 'google_ads_profissionais';

/*
 * Nos eventos históricos, retira somente os parâmetros das identidades antigas.
 * O evento em si não é apagado e continua útil para métricas de produto.
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

COMMIT;
