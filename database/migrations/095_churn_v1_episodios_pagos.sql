BEGIN;

ALTER TABLE assinatura_eventos
  DROP CONSTRAINT IF EXISTS
    assinatura_eventos_tipo_valido;

ALTER TABLE assinatura_eventos
  ADD CONSTRAINT assinatura_eventos_tipo_valido
  CHECK (
    tipo IN (
      'EPISODIO_PAGO_BASELINE',
      'CONVERSAO_INICIAL',
      'RENOVACAO_CONFIRMADA',
      'PAGAMENTO_ATRASADO',
      'PAGAMENTO_RECUPERADO',
      'REVERSAO_FINANCEIRA',
      'RENOVACAO_CANCELADA',
      'ACESSO_PAGO_ENCERRADO',
      'REATIVACAO_PAGA',
      'PLANO_ALTERADO'
    )
  );

CREATE TABLE IF NOT EXISTS financeiro_marcos (
  chave VARCHAR(80) PRIMARY KEY,
  ocorrido_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  detalhes JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO financeiro_marcos (
  chave,
  detalhes
)
VALUES (
  'churn_v1_inicio',
  jsonb_build_object(
    'regra', 'churn_v1',
    'historico_anterior', 'nao_inferido'
  )
)
ON CONFLICT (chave)
DO NOTHING;

WITH marco AS (
  SELECT ocorrido_em
  FROM financeiro_marcos
  WHERE chave = 'churn_v1_inicio'
),
base_paga AS (
  SELECT DISTINCT ON (a.negocio_id)
    a.negocio_id,
    a.id AS assinatura_id,
    a.plano_id
  FROM assinaturas a
  INNER JOIN planos pl
    ON pl.id = a.plano_id
  WHERE a.ativo = TRUE
    AND pl.valor > 0
    AND NOT (
      UPPER(a.status) IN (
        'CANCELED',
        'CANCELLED'
      )
      AND a.data_proxima_cobranca IS NOT NULL
      AND a.data_proxima_cobranca <= CURRENT_DATE
    )
  ORDER BY
    a.negocio_id,
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
  ocorrido_em,
  chave_idempotencia
)
SELECT
  bp.negocio_id,
  bp.assinatura_id,
  'EPISODIO_PAGO_BASELINE',
  'WAVE24_CUTOVER',
  NULL,
  bp.plano_id,
  'sistema',
  jsonb_build_object(
    'regra', 'churn_v1',
    'historico_anterior', 'nao_inferido'
  ),
  m.ocorrido_em,
  'negocio:' || bp.negocio_id ||
    ':EPISODIO_PAGO_BASELINE:wave24'
FROM base_paga bp
CROSS JOIN marco m
ON CONFLICT (chave_idempotencia)
DO NOTHING;

CREATE INDEX IF NOT EXISTS
  assinatura_eventos_negocio_tipo_ocorrido_idx
ON assinatura_eventos (
  negocio_id,
  tipo,
  ocorrido_em DESC
);

COMMIT;
