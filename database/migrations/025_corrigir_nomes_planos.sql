BEGIN;

/*
 * Corrige dados que podem ter sido gravados com codificação incorreta.
 * O slug é estável, portanto a migration é segura para executar novamente.
 */
UPDATE planos
SET
  nome = CASE slug
    WHEN 'inicial' THEN 'Grátis'
    WHEN 'autonoma' THEN 'Autônoma'
    WHEN 'studio' THEN 'Studio'
    WHEN 'salao' THEN 'Salão'
    ELSE nome
  END,
  updated_at = NOW()
WHERE slug IN ('inicial', 'autonoma', 'studio', 'salao')
  AND nome IS DISTINCT FROM CASE slug
    WHEN 'inicial' THEN 'Grátis'
    WHEN 'autonoma' THEN 'Autônoma'
    WHEN 'studio' THEN 'Studio'
    WHEN 'salao' THEN 'Salão'
    ELSE nome
  END;

COMMIT;
