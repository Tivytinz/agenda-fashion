BEGIN;

ALTER TABLE servicos_negocio
  DROP CONSTRAINT IF EXISTS
    servicos_negocio_categoria_check;

ALTER TABLE servicos_negocio
  ADD CONSTRAINT
    servicos_negocio_categoria_check
  CHECK (
    categoria IS NULL OR categoria IN (
      'unha',
      'cabelo',
      'cilio',
      'sobrancelha',
      'maquiagem',
      'estetica',
      'bronzeamento',
      'outro'
    )
  );

WITH servicos_reclassificados AS (
  UPDATE servicos_negocio
  SET categoria = 'bronzeamento'
  WHERE (
      categoria IS NULL
      OR categoria = 'outro'
    )
    AND TRANSLATE(
      LOWER(
        CONCAT_WS(
          ' ',
          nome,
          descricao
        )
      ),
      'áàâãäéèêëíìîïóòôõöúùûüç',
      'aaaaaeeeeiiiiooooouuuuc'
    ) ~ '(^|[^a-z])(bronzeamento|bronze artificial|bronze natural|marquinha|spray tan)([^a-z]|$)'
  RETURNING negocio_id
),
negocios_reclassificados AS (
  SELECT DISTINCT negocio_id
  FROM servicos_reclassificados
)
UPDATE negocios n
SET
  areas = CASE
    WHEN 'Bronzeamento' = ANY(
      COALESCE(
        n.areas,
        ARRAY[]::TEXT[]
      )
    ) THEN COALESCE(
      n.areas,
      ARRAY[]::TEXT[]
    )
    ELSE ARRAY_APPEND(
      COALESCE(
        n.areas,
        ARRAY[]::TEXT[]
      ),
      'Bronzeamento'
    )
  END,
  setor = COALESCE(
    NULLIF(
      BTRIM(n.setor),
      ''
    ),
    'Bronzeamento'
  ),
  updated_at = NOW()
FROM negocios_reclassificados nr
WHERE n.id = nr.negocio_id;

COMMIT;
