BEGIN;

INSERT INTO financeiro_marcos (
  chave,
  detalhes
)
VALUES (
  'ltv_v1_inicio',
  jsonb_build_object(
    'regra', 'ltv_bruto_observado_v1',
    'janelas_dias', jsonb_build_array(30, 60, 90),
    'unidade', 'negocio',
    'fonte_receita', 'pagamentos',
    'historico_anterior', 'nao_inferido',
    'ltv_liquido_disponivel', false
  )
)
ON CONFLICT (chave)
DO NOTHING;

CREATE INDEX IF NOT EXISTS
  assinatura_eventos_conversao_inicial_ocorrido_idx
ON assinatura_eventos (
  ocorrido_em,
  negocio_id,
  pagamento_id
)
WHERE tipo = 'CONVERSAO_INICIAL';

CREATE INDEX IF NOT EXISTS
  pagamentos_assinatura_data_pagamento_idx
ON pagamentos (
  assinatura_id,
  data_pagamento,
  id
)
WHERE data_pagamento IS NOT NULL;

COMMIT;
