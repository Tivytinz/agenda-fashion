BEGIN;

ALTER TABLE pagamentos
  ADD COLUMN IF NOT EXISTS reversao_tipo VARCHAR(40),
  ADD COLUMN IF NOT EXISTS reversao_em DATE,
  ADD COLUMN IF NOT EXISTS valor_revertido NUMERIC(10, 2),
  ADD COLUMN IF NOT EXISTS reversao_valor_conhecido BOOLEAN;

UPDATE pagamentos
SET
  reversao_tipo = CASE
    WHEN UPPER(status) = 'REFUNDED' THEN 'REFUNDED'
    WHEN UPPER(status) IN (
      'CHARGEBACK_REQUESTED',
      'CHARGEBACK_DISPUTE',
      'AWAITING_CHARGEBACK_REVERSAL',
      'RECEIVED_IN_CASH_UNDONE'
    ) THEN UPPER(status)
    WHEN UPPER(status) = 'PARTIALLY_REFUNDED' THEN 'PARTIALLY_REFUNDED'
    ELSE reversao_tipo
  END,
  reversao_em = CASE
    WHEN UPPER(status) IN (
      'REFUNDED',
      'PARTIALLY_REFUNDED',
      'CHARGEBACK_REQUESTED',
      'CHARGEBACK_DISPUTE',
      'AWAITING_CHARGEBACK_REVERSAL',
      'RECEIVED_IN_CASH_UNDONE'
    )
    THEN COALESCE(reversao_em, updated_at::date, data_pagamento)
    ELSE reversao_em
  END,
  valor_revertido = CASE
    WHEN UPPER(status) IN (
      'REFUNDED',
      'CHARGEBACK_REQUESTED',
      'CHARGEBACK_DISPUTE',
      'AWAITING_CHARGEBACK_REVERSAL',
      'RECEIVED_IN_CASH_UNDONE'
    )
    THEN COALESCE(valor_revertido, valor)
    ELSE valor_revertido
  END,
  reversao_valor_conhecido = CASE
    WHEN UPPER(status) IN (
      'REFUNDED',
      'CHARGEBACK_REQUESTED',
      'CHARGEBACK_DISPUTE',
      'AWAITING_CHARGEBACK_REVERSAL',
      'RECEIVED_IN_CASH_UNDONE'
    )
    THEN TRUE
    WHEN UPPER(status) = 'PARTIALLY_REFUNDED'
    THEN COALESCE(reversao_valor_conhecido, FALSE)
    ELSE reversao_valor_conhecido
  END
WHERE UPPER(status) IN (
  'REFUNDED',
  'PARTIALLY_REFUNDED',
  'CHARGEBACK_REQUESTED',
  'CHARGEBACK_DISPUTE',
  'AWAITING_CHARGEBACK_REVERSAL',
  'RECEIVED_IN_CASH_UNDONE'
);

ALTER TABLE pagamentos
  DROP CONSTRAINT IF EXISTS pagamentos_valor_revertido_valido;

ALTER TABLE pagamentos
  ADD CONSTRAINT pagamentos_valor_revertido_valido
  CHECK (
    valor_revertido IS NULL
    OR (
      valor_revertido >= 0
      AND valor_revertido <= valor
    )
  );

CREATE INDEX IF NOT EXISTS pagamentos_reversao_em_idx
  ON pagamentos(reversao_em)
  WHERE reversao_em IS NOT NULL;

COMMENT ON COLUMN pagamentos.reversao_tipo IS
  'Último estado financeiro de reversão aplicado ao pagamento.';
COMMENT ON COLUMN pagamentos.reversao_em IS
  'Data em que a reversão financeira atual foi observada pelo AF.';
COMMENT ON COLUMN pagamentos.valor_revertido IS
  'Valor acumulado revertido quando o provedor fornece evidência suficiente.';
COMMENT ON COLUMN pagamentos.reversao_valor_conhecido IS
  'TRUE quando valor_revertido representa a reversão conhecida; FALSE quando existe reversão sem valor confiável.';

COMMIT;
