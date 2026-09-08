# TikTok Ads no Agenda Fashion

## Objetivo

Adicionar o TikTok Ads ao mesmo motor de aquisição e custos já usado por Google Ads e Meta Ads, sem criar um sistema paralelo e sem permitir que o frontend controle credenciais, IDs financeiros ou vínculos de campanha.

A integração é **somente leitura** nesta fase:

- autorizar a conta pelo fluxo oficial da TikTok Marketing API;
- validar o Advertiser ID configurado;
- testar a conta e a moeda;
- listar campanhas reais;
- reconciliar campanhas externas com campanhas do AF;
- importar gasto diário por campanha;
- alimentar CAC/ROAS apenas quando a atribuição do AF estiver comprovada pelas regras existentes.

O AF não cria, edita, pausa ou exclui campanhas no TikTok Ads.

## Autorização

O fluxo usa o OAuth de **Advertiser / Marketing API**, não o OAuth de TikTok Account.

1. Um administrador autenticado inicia a autorização no painel do AF.
2. O backend cria um `state` criptograficamente aleatório e persiste apenas seu SHA-256 por 10 minutos.
3. O navegador é enviado para `https://ads.tiktok.com/marketing_api/auth`.
4. O TikTok retorna `auth_code` + `state` para o callback do backend.
5. O backend consome o `state` uma única vez e troca o `auth_code` em `/open_api/v1.3/oauth2/access_token/`.
6. O Advertiser ID configurado precisa constar em `advertiser_ids` retornado pelo TikTok.
7. O access token de longo prazo é armazenado criptografado com AES-256-GCM.
8. O navegador volta para `/admin/trafego-pago?tiktok_oauth=success|error`; `auth_code`, `state` e token não permanecem na URL administrativa.

A Marketing API v1.3 usa access token de longo prazo. Não existe refresh token neste fluxo; se a autorização for revogada, o administrador autoriza novamente.

## Variáveis de ambiente

```env
TIKTOK_ADS_COSTS_ENABLED=false
TIKTOK_ADVERTISER_ID=
TIKTOK_API_VERSION=v1.3
TIKTOK_APP_ID=
TIKTOK_APP_SECRET=
TIKTOK_OAUTH_ENCRYPTION_KEY=
TIKTOK_OAUTH_SCOPE=
TIKTOK_OAUTH_REDIRECT_URI=https://app.agendafashion.com.br/admin/marketing/custos-integracoes/tiktok_ads/callback
```

`TIKTOK_APP_SECRET` e `TIKTOK_OAUTH_ENCRYPTION_KEY` são exclusivos do backend. Nenhuma variável TikTok sensível usa prefixo `VITE_`.

`TIKTOK_OAUTH_ENCRYPTION_KEY` precisa ter pelo menos 32 caracteres e não deve reutilizar `JWT_SECRET`.

## Banco

A migration `061_marketing_tiktok_ads.sql`:

- amplia os provedores aceitos em vínculos e sincronizações para incluir `tiktok_ads`;
- cria `marketing_tiktok_oauth_states` para states de uso único;
- cria `marketing_tiktok_oauth_credenciais` para o access token criptografado.

O banco não armazena App Secret nem access token em texto puro.

## API TikTok usada

- autorização: `https://ads.tiktok.com/marketing_api/auth`;
- token: `POST /open_api/v1.3/oauth2/access_token/`;
- conta: `GET /open_api/v1.3/advertiser/info/`;
- campanhas: `GET /open_api/v1.3/campaign/get/`;
- custos: `GET /open_api/v1.3/report/integrated/get/`.

O token é enviado somente no header `Access-Token` nas chamadas da Marketing API.

O relatório de custos usa:

- `service_type=AUCTION`;
- `report_type=BASIC`;
- `data_level=AUCTION_CAMPAIGN`;
- dimensões `campaign_id` + `stat_time_day`;
- métrica `spend`.

O `spend` é convertido para centavos antes de entrar no motor financeiro do AF.

## Moeda e reconciliação

O mesmo contrato de Google/Meta é preservado:

- a conta precisa usar `BRL`;
- a campanha externa é revalidada pelo backend;
- campanha AF de TikTok só pode receber vínculo TikTok;
- custos fora do período solicitado são recusados;
- campanhas operacionais sem vínculo mantêm a sincronização parcial;
- atribuição incompleta continua fora de CAC/ROAS.

## Rollout

1. aplicar migration e código mantendo `TIKTOK_ADS_COSTS_ENABLED=false`;
2. cadastrar o callback no TikTok for Business Developers;
3. configurar App ID, App Secret, Advertiser ID e chave de criptografia no Railway;
4. usar **Autorizar TikTok** no Admin;
5. depois da autorização, ativar `TIKTOK_ADS_COSTS_ENABLED=true`;
6. executar **Testar conexão** e confirmar conta + moeda BRL;
7. criar/sincronizar a campanha real;
8. validar gasto diário antes de habilitar qualquer rotina automática global.

## Segurança

- `state` aleatório, hash SHA-256, TTL e uso único;
- callback possui destino fixo no domínio do AF;
- Advertiser ID é verificado antes de persistir a credencial;
- access token usa AES-256-GCM autenticado;
- token nunca é devolvido ao React;
- token nunca vai em query string;
- App Secret nunca sai do backend;
- endpoints de início, teste, vínculo e sincronização exigem `auth + authAdmin`;
- callback não recebe destino arbitrário e só conclui com um `state` previamente criado pelo Admin.
