BEGIN;

CREATE INDEX IF NOT EXISTS
  eventos_produto_atribuicao_paga_data_idx
ON eventos_produto (
  created_at DESC
)
WHERE (
  NULLIF(BTRIM(propriedades ->> 'gclid'), '') IS NOT NULL
  OR NULLIF(BTRIM(propriedades ->> 'gbraid'), '') IS NOT NULL
  OR NULLIF(BTRIM(propriedades ->> 'wbraid'), '') IS NOT NULL
  OR NULLIF(BTRIM(propriedades ->> 'msclkid'), '') IS NOT NULL
  OR NULLIF(BTRIM(propriedades ->> 'ttclid'), '') IS NOT NULL
  OR NULLIF(BTRIM(propriedades ->> 'epik'), '') IS NOT NULL
  OR LOWER(
    COALESCE(
      NULLIF(BTRIM(propriedades ->> 'utm_medium'), ''),
      ''
    )
  ) IN (
    'cpc',
    'ppc',
    'paid',
    'paid_search',
    'paid_social',
    'paid-social',
    'social_paid',
    'display'
  )
);

CREATE INDEX IF NOT EXISTS
  marketing_campanha_vinculos_provedor_campanha_idx
ON marketing_campanha_vinculos (
  provedor,
  campanha_id
);

COMMENT ON INDEX
  eventos_produto_atribuicao_paga_data_idx
IS
  'Reduz o custo dos relatórios legados de marketing ao limitar a leitura aos eventos com evidência de mídia paga e ordenar pelo período.';

COMMENT ON INDEX
  marketing_campanha_vinculos_provedor_campanha_idx
IS
  'Acelera resolução assistida de campanhas por provedor e contagem de vínculos únicos sem alterar a evidência capturada.';

COMMIT;
