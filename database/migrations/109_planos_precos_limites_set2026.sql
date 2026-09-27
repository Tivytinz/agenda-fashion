BEGIN;

DO $$
DECLARE
  faltantes TEXT;
BEGIN
  SELECT STRING_AGG(slug, ', ' ORDER BY slug)
  INTO faltantes
  FROM (
    VALUES
      ('inicial'),
      ('autonoma'),
      ('studio'),
      ('salao')
  ) AS esperados(slug)
  WHERE NOT EXISTS (
    SELECT 1
    FROM planos p
    WHERE p.slug = esperados.slug
  );

  IF faltantes IS NOT NULL THEN
    RAISE EXCEPTION
      'Planos obrigatórios ausentes: %',
      faltantes;
  END IF;
END
$$;

UPDATE planos
SET
  valor = CASE slug
    WHEN 'inicial' THEN 0.00
    WHEN 'autonoma' THEN 10.00
    WHEN 'studio' THEN 20.00
    WHEN 'salao' THEN 30.00
    ELSE valor
  END,
  limite_profissionais = CASE slug
    WHEN 'inicial' THEN 1
    WHEN 'autonoma' THEN 3
    WHEN 'studio' THEN 6
    WHEN 'salao' THEN 9
    ELSE limite_profissionais
  END,
  limite_servicos = CASE slug
    WHEN 'inicial' THEN 5
    WHEN 'autonoma' THEN 10
    WHEN 'studio' THEN 15
    WHEN 'salao' THEN NULL
    ELSE limite_servicos
  END,
  updated_at = NOW()
WHERE slug IN (
  'inicial',
  'autonoma',
  'studio',
  'salao'
);

COMMIT;
