BEGIN;

-- A descrição melhora o perfil, mas não deve impedir que clientes encontrem
-- negócios que já possuem os demais dados mínimos e um serviço ativo.
-- O recorte em descrição vazia evita republicar negócios retirados da página
-- inicial por decisão da própria profissional.
UPDATE negocios n
SET
  publicado = TRUE,
  updated_at = NOW()
WHERE n.ativo = TRUE
  AND n.publicado = FALSE
  AND NULLIF(BTRIM(COALESCE(n.descricao, '')), '') IS NULL
  AND (
    COALESCE(cardinality(n.areas), 0) > 0
    OR NULLIF(BTRIM(COALESCE(n.setor, '')), '') IS NOT NULL
  )
  AND n.whatsapp ~ '^[0-9]{10,11}$'
  AND NULLIF(BTRIM(COALESCE(n.cidade, '')), '') IS NOT NULL
  AND UPPER(BTRIM(COALESCE(n.estado, ''))) IN (
    'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO',
    'MA', 'MT', 'MS', 'MG', 'PA', 'PB', 'PR', 'PE', 'PI',
    'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO'
  )
  AND EXISTS (
    SELECT 1
    FROM servicos_negocio s
    WHERE s.negocio_id = n.id
      AND s.ativo = TRUE
  );

COMMIT;
