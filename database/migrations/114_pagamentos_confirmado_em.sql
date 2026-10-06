BEGIN;

ALTER TABLE pagamentos
  ADD COLUMN confirmado_em TIMESTAMPTZ;

COMMENT ON COLUMN pagamentos.confirmado_em IS
  'Instante preciso da confirmação financeira quando o provedor fornece timestamp com fuso. Não deve ser inferido a partir de data_pagamento.';

COMMENT ON COLUMN marketing_conversoes_entregas.ocorrido_em IS
  'Instante preciso da confirmação financeira quando conhecido. Pode ser NULL; a entrega usa created_at da outbox como observação estável quando não existe precisão do provedor.';

COMMIT;
