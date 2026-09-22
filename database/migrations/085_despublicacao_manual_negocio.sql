BEGIN;

ALTER TABLE negocios
  ADD COLUMN IF NOT EXISTS despublicado_manual_em TIMESTAMPTZ;

COMMENT ON COLUMN negocios.despublicado_manual_em IS
  'Momento em que a proprietária ocultou explicitamente o negócio. Enquanto preenchido, a publicação automática não pode republicar o perfil; somente uma nova ação explícita de publicação limpa este estado.';

CREATE INDEX IF NOT EXISTS negocios_despublicados_manual_idx
  ON negocios (despublicado_manual_em)
  WHERE despublicado_manual_em IS NOT NULL;

COMMIT;
