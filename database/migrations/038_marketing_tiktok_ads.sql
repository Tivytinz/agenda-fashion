BEGIN;

ALTER TABLE marketing_campanha_vinculos
  DROP CONSTRAINT IF EXISTS marketing_campanha_vinculos_provedor_valido;

ALTER TABLE marketing_campanha_vinculos
  ADD CONSTRAINT marketing_campanha_vinculos_provedor_valido
  CHECK (
    provedor IN (
      'google_ads',
      'meta_ads',
      'tiktok_ads'
    )
  );

ALTER TABLE marketing_custo_sincronizacoes
  DROP CONSTRAINT IF EXISTS marketing_custo_sincronizacoes_provedor_valido;

ALTER TABLE marketing_custo_sincronizacoes
  ADD CONSTRAINT marketing_custo_sincronizacoes_provedor_valido
  CHECK (
    provedor IN (
      'google_ads',
      'meta_ads',
      'tiktok_ads'
    )
  );

COMMENT ON COLUMN marketing_campanha_gastos.fonte IS
  'Origem efetiva do custo do dia: manual, google_ads, meta_ads ou tiktok_ads. A fonte gravada por último substitui as demais para impedir dupla contagem.';

COMMIT;
