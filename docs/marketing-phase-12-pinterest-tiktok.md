# Marketing Fase 12 — Pinterest Ads + TikTok Ads

## Objetivo

Adicionar Pinterest e TikTok ao motor de aquisição visual do Agenda Fashion sem criar um segundo sistema de campanhas, atribuição ou custos.

A fase reaproveita:

- campanhas internas e links UTM do AF;
- atribuição de marketing já persistida no produto;
- painel `Custos & CPA`;
- vínculo explícito entre campanha AF e campanha externa;
- worker recorrente da Fase 11;
- compartilhamento público e metadados sociais já existentes.

## Escopo

A integração externa é somente de leitura nesta fase:

- testar acesso à conta de anúncios;
- listar campanhas reais;
- revalidar no backend a campanha selecionada;
- salvar vínculo explícito com a campanha AF do mesmo canal;
- importar gasto diário por campanha;
- permitir sincronização manual e pelo worker existente.

O AF não cria, edita, pausa ou exclui campanhas no Pinterest ou no TikTok nesta fase.

## Provedores

### Pinterest Ads

Identificador interno: `pinterest_ads`.

Canal correspondente no AF: `pinterest`.

Configuração de backend:

```env
PINTEREST_ADS_COSTS_ENABLED=false
PINTEREST_AD_ACCOUNT_ID=
PINTEREST_ADS_ACCESS_TOKEN=
PINTEREST_API_VERSION=v5
```

O token fica somente no backend e é enviado no header `Authorization: Bearer`.

O gasto retornado pelo relatório do Pinterest é convertido de micro-unidades monetárias para centavos antes de ser persistido pelo AF.

### TikTok Ads

Identificador interno: `tiktok_ads`.

Canal correspondente no AF: `tiktok`.

Configuração de backend:

```env
TIKTOK_ADS_COSTS_ENABLED=false
TIKTOK_ADVERTISER_ID=
TIKTOK_ADS_ACCESS_TOKEN=
TIKTOK_API_VERSION=v1.3
```

O token fica somente no backend e é enviado no header `Access-Token`.

O relatório é consultado por campanha e dia. O campo monetário `spend` é convertido para centavos antes da persistência.

## Banco de dados

A migration `038_marketing_pinterest_tiktok.sql` amplia as constraints existentes para aceitar:

- `google_ads`;
- `meta_ads`;
- `pinterest_ads`;
- `tiktok_ads`.

A tabela `marketing_campanha_gastos` já aceita fontes futuras por slug, portanto não recebe uma nova estrutura.

A regra da Fase 11 permanece: há uma única fonte efetiva de custo por campanha + dia, evitando dupla contagem entre lançamento manual e sincronizações automáticas.

## Segurança

- tokens nunca são enviados ao React;
- tokens não entram em query string;
- IDs e nomes enviados pelo navegador não são fonte de verdade;
- o backend consulta novamente a campanha antes de persistir o vínculo;
- uma campanha AF de Pinterest não pode ser vinculada ao TikTok e vice-versa;
- a conta retornada pela plataforma precisa corresponder à conta configurada;
- endpoints continuam protegidos por autenticação + `authAdmin`.

## UX administrativa

O painel existente passa a exibir quatro provedores:

- Google Ads;
- Meta Ads;
- Pinterest Ads;
- TikTok Ads.

Todos usam o mesmo fluxo:

1. testar conexão;
2. selecionar a plataforma;
3. selecionar uma campanha AF do canal correspondente;
4. selecionar uma campanha real da conta externa;
5. salvar o vínculo verificado;
6. sincronizar os últimos 30 dias.

## Aquisição orgânica e links rastreáveis

A Fase 12 não cria um sistema paralelo de links. As campanhas Pinterest/TikTok continuam usando o gerador de campanhas do AF, que produz UTMs consistentes e preserva a atribuição ao longo da jornada.

O compartilhamento de perfil/serviço e as prévias sociais existentes continuam sendo reutilizados para distribuição orgânica. Esta fase não adiciona novos pixels/tags no navegador e, portanto, não altera o modelo atual de consentimento de marketing.

## Validação antes de produção

Antes do merge definitivo, validar em ambiente real para cada provedor configurado:

1. `Testar conexão` retorna apenas metadados seguros da conta;
2. campanhas reais aparecem no seletor;
3. uma campanha externa de outra conta não pode ser vinculada;
4. campanha AF de canal incompatível é recusada;
5. sincronização importa somente campanhas explicitamente vinculadas;
6. custo diário aparece no histórico com a fonte correta;
7. CPA e investimento não duplicam valores já existentes.

## Testes automatizados

A fase adiciona cobertura para:

- autenticação dos providers sem token na URL;
- paginação/listagem de campanhas Pinterest;
- conversão de gasto Pinterest em micro-unidades;
- leitura de advertiser/campanhas/relatório TikTok;
- erro semântico do TikTok mesmo com HTTP 200;
- vínculo revalidado no backend;
- bloqueio entre canais incompatíveis;
- sincronização somente com vínculo explícito;
- seleção/vínculo dos dois novos provedores no React.
