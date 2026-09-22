BEGIN;

ALTER TABLE negocios
  ADD COLUMN IF NOT EXISTS despublicado_manual_em TIMESTAMPTZ;

COMMENT ON COLUMN negocios.despublicado_manual_em IS
  'Momento em que a proprietária ocultou explicitamente o negócio. Enquanto preenchido, a publicação automática não pode republicar o perfil; somente uma nova ação explícita de publicação limpa este estado.';

ALTER TABLE negocios
  ADD CONSTRAINT negocios_despublicacao_manual_coerente
  CHECK (
    despublicado_manual_em IS NULL
    OR publicado = FALSE
  );

COMMIT;
