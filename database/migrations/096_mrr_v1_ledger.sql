BEGIN;

ALTER TABLE assinatura_eventos
  ADD COLUMN IF NOT EXISTS
    valor_mensal_anterior NUMERIC(12,2),
  ADD COLUMN IF NOT EXISTS
    valor_mensal_novo NUMERIC(12,2),
  ADD COLUMN IF NOT EXISTS
    periodicidade_snapshot VARCHAR(20);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname =
      'assinatura_eventos_valor_mensal_anterior_valido'
  ) THEN
    ALTER TABLE assinatura_eventos
      ADD CONSTRAINT
        assinatura_eventos_valor_mensal_anterior_valido
      CHECK (
        valor_mensal_anterior IS NULL
        OR valor_mensal_anterior >= 0
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname =
      'assinatura_eventos_valor_mensal_novo_valido'
  ) THEN
    ALTER TABLE assinatura_eventos
      ADD CONSTRAINT
        assinatura_eventos_valor_mensal_novo_valido
      CHECK (
        valor_mensal_novo IS NULL
        OR valor_mensal_novo >= 0
      );
  END IF;
END
$$;

ALTER TABLE assinatura_eventos
  DROP CONSTRAINT IF EXISTS
    assinatura_eventos_tipo_valido;

ALTER TABLE assinatura_eventos
  ADD CONSTRAINT assinatura_eventos_tipo_valido
  CHECK (
    tipo IN (
      'MRR_BASELINE',
      'EPISODIO_PAGO_BASELINE',
      'CONVERSAO_INICIAL',
      'RENOVACAO_CONFIRMADA',
      'PAGAMENTO_ATRASADO',
      'PAGAMENTO_RECUPERADO',
      'REVERSAO_FINANCEIRA',
      'RENOVACAO_CANCELADA',
      'ACESSO_PAGO_ENCERRADO',
      'REATIVACAO_PAGA',
      'PLANO_ALTERADO',
      'VALOR_RECORRENTE_ALTERADO'
    )
  );

INSERT INTO financeiro_marcos (
  chave,
  detalhes
)
VALUES (
  'mrr_v1_inicio',
  jsonb_build_object(
    'regra', 'mrr_v1',
    'periodicidade_suportada', 'MONTHLY',
    'historico_anterior', 'nao_inferido'
  )
)
ON CONFLICT (chave)
DO NOTHING;

WITH marco AS (
  SELECT ocorrido_em
  FROM financeiro_marcos
  WHERE chave = 'mrr_v1_inicio'
),
base_mrr AS (
  SELECT DISTINCT ON (a.negocio_id)
    a.negocio_id,
    a.id AS assinatura_id,
    a.plano_id,
    a.valor,
    COALESCE(
      NULLIF(UPPER(TRIM(a.periodicidade)), ''),
      'MONTHLY'
    ) AS periodicidade,
    UPPER(COALESCE(a.status, '')) AS status,
    a.ativo
  FROM assinaturas a
  INNER JOIN planos pl
    ON pl.id = a.plano_id
  WHERE pl.valor > 0
    AND a.valor IS NOT NULL
    AND a.valor >= 0
    AND COALESCE(
      NULLIF(UPPER(TRIM(a.periodicidade)), ''),
      'MONTHLY'
    ) = 'MONTHLY'
    AND (
      (
        a.ativo = TRUE
        AND NOT (
          UPPER(COALESCE(a.status, '')) IN (
            'CANCELED',
            'CANCELLED'
          )
          AND a.data_proxima_cobranca IS NOT NULL
          AND a.data_proxima_cobranca <= CURRENT_DATE
        )
      )
      OR (
        a.ativo = FALSE
        AND UPPER(COALESCE(a.status, '')) IN (
          'OVERDUE',
          'PAST_DUE',
          'PAYMENT_FAILED',
          'CREDIT_CARD_CAPTURE_REFUSED',
          'REFUNDED',
          'RECEIVED_IN_CASH_UNDONE',
          'CHARGEBACK_REQUESTED',
          'CHARGEBACK_DISPUTE',
          'AWAITING_CHARGEBACK_REVERSAL'
        )
        AND EXISTS (
          SELECT 1
          FROM pagamentos pg
          WHERE pg.assinatura_id = a.id
            AND UPPER(pg.status) IN (
              'CONFIRMED',
              'RECEIVED',
              'RECEIVED_IN_CASH'
            )
            AND pg.data_pagamento IS NOT NULL
        )
        AND COALESCE(
          (
            SELECT fronteira.tipo
            FROM assinatura_eventos fronteira
            WHERE fronteira.negocio_id = a.negocio_id
              AND fronteira.tipo IN (
                'EPISODIO_PAGO_BASELINE',
                'CONVERSAO_INICIAL',
                'REATIVACAO_PAGA',
                'ACESSO_PAGO_ENCERRADO'
              )
            ORDER BY
              fronteira.ocorrido_em DESC,
              fronteira.id DESC
            LIMIT 1
          ),
          ''
        ) <> 'ACESSO_PAGO_ENCERRADO'
      )
    )
  ORDER BY
    a.negocio_id,
    (a.ativo = TRUE) DESC,
    EXISTS (
      SELECT 1
      FROM pagamentos pg
      WHERE pg.assinatura_id = a.id
        AND UPPER(pg.status) IN (
          'CONFIRMED',
          'RECEIVED',
          'RECEIVED_IN_CASH'
        )
        AND pg.data_pagamento IS NOT NULL
    ) DESC,
    a.id DESC
)
INSERT INTO assinatura_eventos (
  negocio_id,
  assinatura_id,
  tipo,
  motivo,
  plano_anterior_id,
  plano_novo_id,
  origem,
  detalhes,
  valor_mensal_anterior,
  valor_mensal_novo,
  periodicidade_snapshot,
  ocorrido_em,
  chave_idempotencia
)
SELECT
  bm.negocio_id,
  bm.assinatura_id,
  'MRR_BASELINE',
  'WAVE25_CUTOVER',
  bm.plano_id,
  bm.plano_id,
  'sistema',
  jsonb_build_object(
    'regra', 'mrr_v1',
    'historico_anterior', 'nao_inferido',
    'status_assinatura', bm.status,
    'ativo_entitlement', bm.ativo,
    'mrr_em_risco_snapshot',
      bm.status IN (
        'OVERDUE',
        'PAST_DUE',
        'PAYMENT_FAILED',
        'CREDIT_CARD_CAPTURE_REFUSED',
        'REFUNDED',
        'RECEIVED_IN_CASH_UNDONE',
        'CHARGEBACK_REQUESTED',
        'CHARGEBACK_DISPUTE',
        'AWAITING_CHARGEBACK_REVERSAL'
      )
  ),
  bm.valor,
  bm.valor,
  bm.periodicidade,
  m.ocorrido_em,
  'negocio:' || bm.negocio_id ||
    ':MRR_BASELINE:wave25'
FROM base_mrr bm
CROSS JOIN marco m
ON CONFLICT (chave_idempotencia)
DO NOTHING;

CREATE INDEX IF NOT EXISTS
  assinatura_eventos_negocio_mrr_ocorrido_idx
ON assinatura_eventos (
  negocio_id,
  ocorrido_em DESC,
  id DESC
)
WHERE valor_mensal_novo IS NOT NULL;

COMMIT;
