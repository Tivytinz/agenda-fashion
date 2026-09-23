BEGIN;

INSERT INTO financeiro_marcos (
  chave,
  detalhes
)
VALUES (
  'retorno_contribuicao_v1_inicio',
  jsonb_build_object(
    'regra', 'retorno_contribuicao_cac_midia_v1',
    'unidade', 'negocio',
    'custo_aquisicao', 'midia_observada',
    'retorno', 'contribuicao_observada',
    'janelas_dias', jsonb_build_array(30, 60, 90),
    'dependencia', 'margem_contribuicao_v1',
    'historico_anterior', 'nao_inferido',
    'cac_total_disponivel', false,
    'payback_economico_disponivel', false,
    'decisao_automatica_midia', false
  )
)
ON CONFLICT (chave)
DO NOTHING;

COMMIT;
