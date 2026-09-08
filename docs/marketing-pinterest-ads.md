# Pinterest Ads no Agenda Fashion

## Objetivo

Adicionar o Pinterest Ads ao motor de aquisição e custos do Agenda Fashion sem criar um fluxo financeiro paralelo. A integração é somente leitura nesta fase:

- autorizar uma conta Pinterest pelo OAuth 2.0 oficial;
- validar o Ad Account ID configurado;
- consultar conta, moeda e campanhas reais;
- importar gasto diário por campanha;
- reconciliar campanhas externas com campanhas do AF;
- alimentar CAC/ROAS somente quando as regras de atribuição existentes comprovarem o vínculo.

O AF não cria, edita, pausa, arquiva ou exclui campanhas no Pinterest Ads.

## OAuth

O fluxo usa Authorization Code Grant da API v5 do Pinterest.

1. Admin autenticado inicia a autorização no painel.
2. O backend gera `state` criptograficamente aleatório e salva apenas SHA-256 por 10 minutos.
3. O navegador é enviado para `https://www.pinterest.com/oauth/`.
4. O Pinterest devolve `code` e `state` ao callback fixo do AF.
5. O backend consome o `state` uma única vez.
6. O código é trocado por tokens em `POST https://api.pinterest.com/v5/oauth/token`, usando HTTP Basic com App ID + App Secret.
7. O backend valida o `PINTEREST_AD_ACCOUNT_ID` com o access token antes de persistir a autorização.
8. Access token e refresh token são armazenados com AES-256-GCM.
9. O refresh token contínuo renova o access token automaticamente antes da expiração.
10. O navegador volta para `/admin/trafego-pago?pinterest_oauth=success|error`.

A integração solicita somente `ads:read`. Configurações que tentem ampliar o OAuth para scopes de escrita são rejeitadas pelo backend.

## Variáveis

```env
PINTEREST_ADS_COSTS_ENABLED=false
PINTEREST_AD_ACCOUNT_ID=
PINTEREST_API_VERSION=v5
PINTEREST_APP_ID=
PINTEREST_APP_SECRET=
PINTEREST_OAUTH_ENCRYPTION_KEY=
PINTEREST_OAUTH_SCOPE=ads:read
PINTEREST_OAUTH_REDIRECT_URI=https://app.agendafashion.com.br/admin/marketing/custos-integracoes/pinterest_ads/callback
```

`PINTEREST_APP_SECRET`, `PINTEREST_OAUTH_ENCRYPTION_KEY`, access token e refresh token são exclusivos do backend. Nenhum segredo usa prefixo `VITE_`.

## API Pinterest usada

- autorização: `GET https://www.pinterest.com/oauth/`;
- token/refresh: `POST https://api.pinterest.com/v5/oauth/token`;
- conta: `GET /v5/ad_accounts/{ad_account_id}`;
- campanhas: `GET /v5/ad_accounts/{ad_account_id}/campaigns`;
- custos: `GET /v5/ad_accounts/{ad_account_id}/campaigns/analytics`.

A API oficial representa gasto em `SPEND_IN_MICRO_DOLLAR`, que corresponde a microunidades da moeda da conta. O AF converte microunidades para centavos antes de persistir o custo.

## Moeda e atribuição

- a conta precisa usar `BRL`;
- a campanha externa é sempre revalidada no backend;
- campanha AF de canal Pinterest só pode receber vínculo `pinterest_ads`;
- custos fora do período solicitado são recusados;
- UTM ou visita isolada não é prova financeira;
- ambiguidade continua fora de CAC/ROAS.

## Rollout

1. aplicar migration e código com `PINTEREST_ADS_COSTS_ENABLED=false`;
2. criar/configurar o app no Pinterest Developers;
3. cadastrar exatamente o callback oficial do AF;
4. configurar App ID, App Secret, Ad Account ID e chave de criptografia no Railway;
5. usar **Autorizar Pinterest**;
6. depois da autorização, ativar `PINTEREST_ADS_COSTS_ENABLED=true`;
7. testar a conexão e confirmar moeda BRL;
8. sincronizar campanhas e gastos.

## Segurança

- OAuth Authorization Code server-side;
- `state` aleatório, SHA-256, TTL e uso único;
- callback fixo no domínio do AF;
- escopo mínimo `ads:read`;
- App Secret nunca sai do backend;
- tokens nunca vão ao React, query string ou logs;
- access/refresh tokens usam AES-256-GCM;
- endpoints de início, teste, vínculo e sincronização exigem `auth + authAdmin`;
- callback só conclui com `state` previamente criado por um admin.
