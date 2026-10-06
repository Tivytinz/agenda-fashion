BEGIN;

ALTER TABLE pagamentos
  ADD COLUMN IF NOT EXISTS
    confirmacao_observada_em TIMESTAMPTZ;

WITH primeira_confirmacao AS (
  SELECT
    p.id AS pagamento_id,
    MIN(we.recebido_em) AS confirmado_em
  FROM pagamentos p
  INNER JOIN webhook_eventos we
    ON we.provedor = 'asaas'
   AND we.recurso_id = p.asaas_payment_id
   AND we.tipo_evento IN (
     'PAYMENT_CONFIRMED',
     'PAYMENT_RECEIVED'
   )
   AND we.status = 'PROCESSED'
  WHERE p.confirmacao_observada_em IS NULL
    AND p.asaas_payment_id IS NOT NULL
    AND p.data_pagamento IS NOT NULL
  GROUP BY p.id
)
UPDATE pagamentos p
SET confirmacao_observada_em =
  primeira_confirmacao.confirmado_em
FROM primeira_confirmacao
WHERE p.id = primeira_confirmacao.pagamento_id
  AND p.confirmacao_observada_em IS NULL;

COMMENT ON COLUMN
  pagamentos.confirmacao_observada_em
IS
  'Instante em que o AF observou pela primeira vez um webhook Asaas de confirmação/recebimento desta cobrança. É TIMESTAMPTZ e não substitui data_pagamento, que permanece a data financeira do provedor.';

COMMIT;
