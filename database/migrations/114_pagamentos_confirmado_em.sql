BEGIN;

ALTER TABLE pagamentos
  ADD COLUMN confirmado_em TIMESTAMPTZ;

COMMENT ON COLUMN pagamentos.confirmado_em IS
  'Instante preciso da confirmação financeira quando o provedor fornece timestamp com fuso. Não deve ser inferido a partir de data_pagamento.';

COMMIT;
