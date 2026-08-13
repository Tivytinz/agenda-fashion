# TikTok Ads OAuth no Agenda Fashion

## Objetivo

Autorizar uma conta TikTok Ads diretamente pelo Admin do Agenda Fashion sem copiar access tokens manualmente e sem expor App Secret ou tokens ao React.

O fluxo é somente de leitura nesta fase: conta, campanhas e custos. O AF não cria, edita, pausa ou exclui campanhas no TikTok Ads.

## Redirect registrado no TikTok

A URL de retorno precisa ser exatamente:

```text
https://app.agendafashion.com.br/admin/trafego-pago/custos
```

A mesma URL deve estar registrada como Advertiser redirect URL no TikTok for Business Developers e configurada em `TIKTOK_OAUTH_REDIRECT_URI`.

## Variáveis do Railway

```env
TIKTOK_ADS_COSTS_ENABLED=false
TIKTOK_ADVERTISER_ID=
TIKTOK_API_VERSION=v1.3
TIKTOK_APP_ID=
TIKTOK_APP_SECRET=
TIKTOK_OAUTH_ENCRYPTION_KEY=
TIKTOK_OAUTH_REDIRECT_URI=https://app.agendafashion.com.br/admin/trafego-pago/custos
```

`TIKTOK_APP_SECRET` e `TIKTOK_OAUTH_ENCRYPTION_KEY` são segredos exclusivos do backend. Não devem usar prefixo `VITE_`, aparecer no React ou ser enviados ao navegador.

A chave `TIKTOK_OAUTH_ENCRYPTION_KEY` deve ter pelo menos 32 caracteres aleatórios e não deve reutilizar `JWT_SECRET`.

`TIKTOK_ADS_ACCESS_TOKEN` existe apenas como compatibilidade temporária para um token manual já disponível. O fluxo normal usa OAuth e persiste tokens criptografados.

## Fluxo

1. O administrador abre `/admin/trafego-pago/custos`.
2. O painel chama `POST /admin/marketing/custos-integracoes/tiktok_ads/autorizacao` com autenticação Admin.
3. O backend gera um `state` aleatório, persiste apenas o SHA-256 e associa o state ao administrador e ao redirect por 10 minutos.
4. O navegador é enviado para a autorização oficial do TikTok.
5. O TikTok volta para `/admin/trafego-pago/custos?auth_code=...&state=...`.
6. O backend intercepta o callback antes da SPA, consome o state uma única vez e troca o `auth_code` pelo access token e refresh token.
7. Antes de salvar, o backend consulta a conta e confirma que o token realmente possui acesso ao `TIKTOK_ADVERTISER_ID` configurado.
8. Access token e refresh token são armazenados no PostgreSQL com AES-256-GCM. Tokens em texto puro não são persistidos.
9. O navegador recebe apenas um redirect interno com `?tiktok_oauth=success` ou `?tiktok_oauth=error`. `auth_code`, state e tokens são removidos da URL visível.
10. Quando o access token se aproxima do vencimento, o backend usa o refresh token e rotaciona as duas credenciais automaticamente.

## Banco

A migration `038_marketing_tiktok_ads.sql` adiciona `tiktok_ads` aos provedores aceitos pelas tabelas de vínculo e sincronização.

A migration `040_marketing_tiktok_oauth.sql` cria:

- `marketing_tiktok_oauth_states`, para state de uso único e curta duração;
- `marketing_tiktok_oauth_credenciais`, singleton com tokens criptografados e vencimentos.

Nenhum App Secret é gravado no banco. O App Secret permanece apenas no ambiente do Railway.

## Ativação segura

Primeiro publique as migrations e o código mantendo:

```env
TIKTOK_ADS_COSTS_ENABLED=false
```

Depois configure App ID, App Secret, Advertiser ID, chave de criptografia e redirect URI. Abra o Admin e conclua `Autorizar TikTok`.

Depois da autorização, valide `Testar conexão`. A conta deve retornar `BRL`, pois a versão atual do motor de custos do AF recusa outras moedas para não misturar valores sem conversão cambial.

Somente após essa validação altere `TIKTOK_ADS_COSTS_ENABLED=true`. A sincronização automática global continua controlada separadamente por `MARKETING_COST_SYNC_SCHEDULE_ENABLED`.

## Segurança

- access token usa o header `Access-Token` e nunca query string;
- App Secret só participa da troca/renovação server-side;
- state é aleatório, armazenado somente como hash, expira e é consumido uma única vez;
- redirect é limitado ao domínio e à rota oficial do AF;
- tokens são criptografados com autenticação de integridade;
- o frontend recebe apenas status seguro da autorização;
- campanha TikTok só pode ser vinculada a uma campanha AF cujo canal seja `tiktok`;
- o backend revalida conta e campanha antes do vínculo;
- endpoints de início de autorização, teste, vínculo e sincronização exigem `auth + authAdmin`.
