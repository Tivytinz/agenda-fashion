BEGIN;

UPDATE negocios n
SET publicado = TRUE
WHERE n.ativo = TRUE
  AND n.publicado = FALSE
  AND NULLIF(BTRIM(n.descricao), '') IS NOT NULL
  AND NULLIF(BTRIM(n.setor), '') IS NOT NULL
  AND n.whatsapp ~ '^[0-9]{10,11}$'
  AND NULLIF(BTRIM(n.cidade), '') IS NOT NULL
  AND EXISTS (
    SELECT 1
    FROM servicos_negocio s
    WHERE s.negocio_id = n.id
      AND s.ativo = TRUE
  );

COMMIT;
