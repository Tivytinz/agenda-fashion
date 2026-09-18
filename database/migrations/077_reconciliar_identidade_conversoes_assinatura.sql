BEGIN;

-- Compatibilidade com a janela em que a identidade da conversão foi alterada
-- para assinatura + pagamento. A aquisição volta a ser identificada pela
-- assinatura, preservando os IDs históricos usados pelos provedores.
WITH grupos_afetados AS (
  SELECT DISTINCT
    provedor,
    tipo_evento,
    payload ->> 'assinaturaId' AS assinatura_id
  FROM marketing_conversoes_entregas
  WHERE chave_evento LIKE 'assinatura:%;pagamento:%'
    AND payload ->> 'assinaturaId' ~ '^[0-9]+$'
),
enviadas AS (
  SELECT
    m.provedor,
    m.tipo_evento,
    m.payload ->> 'assinaturaId' AS assinatura_id,
    MIN(m.id) AS manter_id
  FROM marketing_conversoes_entregas m
  INNER JOIN grupos_afetados g
    ON g.provedor = m.provedor
    AND g.tipo_evento = m.tipo_evento
    AND g.assinatura_id =
      m.payload ->> 'assinaturaId'
  WHERE m.status = 'SENT'
  GROUP BY
    m.provedor,
    m.tipo_evento,
    m.payload ->> 'assinaturaId'
)
UPDATE marketing_conversoes_entregas m
SET
  status = 'IGNORED',
  tentativas = tentativas + 1,
  proxima_tentativa_em = NULL,
  bloqueado_em = NULL,
  ultimo_erro =
    'Entrega substituída por conversão histórica da mesma assinatura já enviada.',
  updated_at = NOW()
FROM enviadas e
WHERE m.provedor = e.provedor
  AND m.tipo_evento = e.tipo_evento
  AND m.payload ->> 'assinaturaId' =
    e.assinatura_id
  AND m.id <> e.manter_id
  AND m.status <> 'SENT';

WITH grupos_sem_enviado AS (
  SELECT
    m.provedor,
    m.tipo_evento,
    m.payload ->> 'assinaturaId' AS assinatura_id
  FROM marketing_conversoes_entregas m
  WHERE m.payload ->> 'assinaturaId' ~ '^[0-9]+$'
    AND EXISTS (
      SELECT 1
      FROM marketing_conversoes_entregas x
      WHERE x.provedor = m.provedor
        AND x.tipo_evento = m.tipo_evento
        AND x.payload ->> 'assinaturaId' =
          m.payload ->> 'assinaturaId'
        AND x.chave_evento LIKE
          'assinatura:%;pagamento:%'
    )
  GROUP BY
    m.provedor,
    m.tipo_evento,
    m.payload ->> 'assinaturaId'
  HAVING BOOL_OR(m.status = 'SENT') = FALSE
),
keepers AS (
  SELECT DISTINCT ON (
    m.provedor,
    m.tipo_evento,
    g.assinatura_id
  )
    m.id,
    m.provedor,
    m.tipo_evento,
    g.assinatura_id
  FROM marketing_conversoes_entregas m
  INNER JOIN grupos_sem_enviado g
    ON g.provedor = m.provedor
    AND g.tipo_evento = m.tipo_evento
    AND g.assinatura_id =
      m.payload ->> 'assinaturaId'
  ORDER BY
    m.provedor,
    m.tipo_evento,
    g.assinatura_id,
    CASE
      WHEN m.chave_evento =
        'assinatura:' || g.assinatura_id
        THEN 0
      ELSE 1
    END,
    m.id ASC
),
fontes_payload AS (
  SELECT DISTINCT ON (
    m.provedor,
    m.tipo_evento,
    g.assinatura_id
  )
    m.provedor,
    m.tipo_evento,
    g.assinatura_id,
    m.payload
  FROM marketing_conversoes_entregas m
  INNER JOIN grupos_sem_enviado g
    ON g.provedor = m.provedor
    AND g.tipo_evento = m.tipo_evento
    AND g.assinatura_id =
      m.payload ->> 'assinaturaId'
  ORDER BY
    m.provedor,
    m.tipo_evento,
    g.assinatura_id,
    CASE
      WHEN m.chave_evento LIKE
        'assinatura:%;pagamento:%'
        THEN 0
      ELSE 1
    END,
    m.id DESC
),
duplicadas AS (
  UPDATE marketing_conversoes_entregas m
  SET
    status = 'IGNORED',
    tentativas = tentativas + 1,
    proxima_tentativa_em = NULL,
    bloqueado_em = NULL,
    ultimo_erro =
      'Entrega consolidada na identidade canônica da assinatura.',
    updated_at = NOW()
  FROM keepers k
  WHERE m.provedor = k.provedor
    AND m.tipo_evento = k.tipo_evento
    AND m.payload ->> 'assinaturaId' =
      k.assinatura_id
    AND m.id <> k.id
    AND m.status <> 'SENT'
  RETURNING m.id
)
UPDATE marketing_conversoes_entregas m
SET
  chave_evento =
    'assinatura:' || k.assinatura_id,
  payload = fp.payload,
  status = 'PENDING',
  tentativas = 0,
  proxima_tentativa_em = NOW(),
  bloqueado_em = NULL,
  enviado_em = NULL,
  ultimo_erro = NULL,
  updated_at = NOW()
FROM keepers k
INNER JOIN fontes_payload fp
  ON fp.provedor = k.provedor
  AND fp.tipo_evento = k.tipo_evento
  AND fp.assinatura_id =
    k.assinatura_id
WHERE m.id = k.id
  AND m.status <> 'SENT';

COMMIT;
