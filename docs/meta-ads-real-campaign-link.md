# Vínculo real com Meta Ads

A integração de custos do Meta Ads usa credenciais exclusivas de backend:

- `META_ADS_COSTS_ENABLED`
- `META_AD_ACCOUNT_ID`
- `META_MARKETING_ACCESS_TOKEN`
- `META_GRAPH_API_VERSION`

O token da Marketing API não deve ser substituído pelo `META_CAPI_ACCESS_TOKEN`, que pertence ao fluxo de Conversion API.

## Fluxo

1. O admin testa a conexão com a conta de anúncios configurada.
2. O backend identifica a conta e devolve somente metadados seguros.
3. O admin seleciona uma campanha real listada pela Marketing API.
4. Antes de persistir, o backend consulta a campanha novamente e confirma o `account_id`.
5. A sincronização de custos continua usando apenas vínculos explicitamente verificados.

Credenciais nunca são devolvidas ao frontend.
