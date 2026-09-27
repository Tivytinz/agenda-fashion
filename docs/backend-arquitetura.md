# Backend — arquitetura e mapa operacional

> Documento especializado da arquitetura do backend do Agenda Fashion.
> Atualizado em setembro de 2026 a partir do código executável, migrations e testes da `main`.
>
> A visão arquitetural geral permanece em [arquitetura.md](./arquitetura.md). Regras de produto duráveis permanecem em [AGENTS.md](../AGENTS.md).

## 1. Runtime e processo

O backend roda em Node.js 22, Express 5 e JavaScript CommonJS. O processo web nasce em `src/server.js`, valida a configuração antes de aceitar tráfego, verifica se o banco está na migration esperada e só então abre a porta HTTP.

Não existe prefixo global `/api`: as rotas de `src/routes/index.js` são montadas diretamente na aplicação. Esse contrato deve ser preservado em mudanças incrementais.

O servidor também entrega o build React, mantém redirects legados e diferencia APIs de fallback HTML. Em produção, a documentação Swagger não é exposta; `/docs` é registrada somente fora de produção.

## 2. Pipeline HTTP

A ordem relevante do processo web é:

```text
Helmet/CSP
→ /health
→ request id
→ request logger
→ canonical host redirect
→ JSON parser (1 MB; rawBody no webhook WhatsApp)
→ CORS
→ CSRF
→ /health/live e /health/ready
→ assets estáticos e redirects legados
→ rotas HTTP da aplicação
→ Swagger somente fora de produção
→ rotas/fallback da SPA
→ 404
→ error handler
```

O `X-Request-ID` recebido só é reutilizado quando atende ao formato aceito; caso contrário o backend gera UUID próprio. O endpoint `/health/ready` verifica PostgreSQL e compatibilidade de migrations, enquanto `/health/live` confirma apenas que o processo responde.

## 3. Camadas

O fluxo arquitetural esperado é:

```text
routes → controllers → services → repositories → PostgreSQL
```

- **routes**: endpoint e composição de middleware;
- **controllers**: adaptação HTTP e delegação;
- **services**: regra de negócio, autorização contextual e orquestração;
- **repositories**: SQL, transações, locks e persistência;
- **providers**: integrações externas;
- **validators/domain/utils**: validação, regras puras e utilidades compartilhadas;
- **middlewares**: autenticação, autorização, CSRF, rate limit, upload, auditoria e tratamento HTTP.

`tests/architecture-boundaries.test.js` protege as fronteiras e impede novas violações arquiteturais silenciosas.

## 4. Mapa de módulos HTTP

O agregador `src/routes/index.js` registra os seguintes domínios:

| Domínio | Entrada principal |
| --- | --- |
| Autenticação | `authRoutes.js` |
| Sessão | `sessaoRoutes.js` |
| Negócios | `negocioRoutes.js` |
| Conta | `contaRoutes.js` |
| Configurações | `configuracoesRoutes.js` |
| Profissionais/equipe | `profissionaisRoutes.js` |
| Serviços | `/servicos` + `servicosRoutes.js` |
| Checkout | `checkoutRoutes.js` |
| Assinaturas | `assinaturaRoutes.js` |
| Planos | `planosRoutes.js` |
| Webhooks | `webhookRoutes.js` |
| Favoritos | `favoritosRoutes.js` |
| Dashboard | `dashboardRoutes.js` |
| Notificações | `notificacoesRoutes.js` |
| Eventos de produto legado | `eventoProdutoRoutes.js` |
| Analytics first-party | `analyticsV2Routes.js` |
| Meta Ads | `metaAdsRoutes.js` |
| Google Measurement | `googleMeasurementRoutes.js` |
| Agenda operacional | `agendaRoutes.js` |
| Configuração da agenda | `agendaConfiguracaoRoutes.js` |
| Agenda pública | `agendaPublicaRoutes.js` |
| Perfil público | `perfilNegocioRoutes.js` |
| Admin Analytics v2 | `adminAnalyticsV2Routes.js` |
| Administração | `adminRoutes.js` |

Rotas específicas de um domínio podem estar compostas dentro desses módulos; o arquivo de rota correspondente é a fonte para o contrato HTTP efetivamente registrado.

## 5. Persistência e migrations

O PostgreSQL é acessado por `pg`. O histórico atual vai de `001_usuarios.sql` até `105_admin_auditoria_revisoes.sql`, com numeração histórica não necessariamente contínua.

Mudanças de schema exigem migration nova. Migrations aplicadas não devem ser editadas. O startup de produção executado por `npm start` chama `npm run migrate:deploy` antes de iniciar `src/server.js`, e o readiness também rejeita banco atrás da versão esperada.

Os repositories são a fronteira preferencial para SQL. Operações críticas de booking, billing, webhooks e sincronizações usam transações/locks quando o domínio exige atomicidade ou serialização.

## 6. Segurança e fronteiras de confiança

O backend é a autoridade para autenticação, autorização, contexto de negócio, limites de plano, preço e regras financeiras. O frontend não é fonte confiável para esses valores.

Controles presentes no runtime incluem:

- JWT de sessão transportado por cookie `HttpOnly`;
- autenticação administrativa separada;
- CSRF;
- CORS centralizado;
- Helmet e CSP;
- rate limits;
- validação e hardening de upload;
- autenticação própria de webhooks Asaas e WhatsApp;
- revogação de sessão;
- auditoria administrativa;
- request logging com correlação por request id;
- validação fail-fast da configuração.

O host público canônico e a política de cookie devem seguir `AGENTS.md`; hosts de infraestrutura não são contrato de produto.

## 7. Agendamento

O backend separa agenda pública, configuração e operação. Os módulos de agendamento cobrem criação pública, cancelamento, lifecycle, reagendamento, notificações e ações da cliente.

Invariantes duráveis incluem validação server-side de disponibilidade, elegibilidade profissional↔serviço, conflitos por instante absoluto, snapshots históricos e serialização das mutações concorrentes. O detalhe canônico fica em [ciclo-atendimento.md](./ciclo-atendimento.md) e [agendamento-integridade.md](./agendamento-integridade.md).

## 8. Billing e financeiro

Assinaturas foram decompostas em serviços/repositories especializados para registro, conta, ativação Asaas, pagamentos, lifecycle, inadimplência e webhook. Checkout possui repository próprio e fencing de tentativa.

O retorno do navegador não ativa plano. A confirmação financeira depende do backend e do processamento autenticado/idempotente do Asaas. Reconciliações financeiras também podem rodar em background.

## 9. Marketing, analytics e growth

O backend mantém separadas telemetria, atribuição, custo e resultado financeiro. Há módulos específicos para Analytics v2, Google Measurement, Meta Ads, sincronização de custos, entrega de conversões, atribuição persistente e leituras administrativas.

Custos e integrações externas devem preservar origem factual e estado de sincronização; valores controlados por providers não devem ser inferidos como fatos quando ausentes.

## 10. Workers

`src/workers/backgroundWorkers.js` coordena atualmente:

1. processamento de webhook;
2. fila de WhatsApp;
3. sincronização de custos de marketing;
4. fundação de dados de ML/no-show;
5. reconciliação de billing;
6. reconciliação de aquisição financeira;
7. reconciliação de economia de pagamentos;
8. sincronização de custos de contribuição.

Por compatibilidade, o processo web inicia workers quando `BACKGROUND_WORKERS_ENABLED` não é definido. Para processo dedicado existe `npm run worker`. Em topologia separada, o web deve usar `BACKGROUND_WORKERS_ENABLED=false`.

No shutdown, o servidor para novos ciclos, aguarda workers ativos e só depois encerra o pool PostgreSQL. Há limite de 10 segundos para fechamento das conexões HTTP remanescentes.

## 11. Integrações externas

As integrações visíveis no backend incluem Asaas, WhatsApp Cloud API, Resend/e-mail, Cloudinary, Google Identity/Measurement/Ads, Meta Ads, TikTok Ads, Pinterest Ads e OpenAI no módulo de Copilot.

Credenciais ficam no backend e a configuração habilitada deve ser completa. Providers externos não devem controlar autorização interna nem transformar respostas externas em fatos financeiros sem validação.

## 12. Testes e evidência

O backend usa Jest, Supertest e PostgreSQL de teste. A suíte cobre, entre outros:

- autenticação, sessão e revogação;
- multitenancy/contexto de negócio;
- agenda e concorrência;
- lifecycle/cancelamento/reagendamento;
- planos, checkout, Asaas e webhooks;
- privacidade;
- analytics e atribuição;
- workers e shutdown;
- segurança, CORS, CSRF e headers;
- fronteiras arquiteturais;
- migrations e readiness;
- administração e auditoria.

Mudança de backend deve receber teste proporcional ao risco. Documentação isolada não altera comportamento executável e não exige criar teste funcional novo, mas links e fatos documentados devem ser revisados contra o código.

## 13. Comandos operacionais

```bash
npm test
npm run test:coverage
npm run migrate:test
npm run migrate:test:status
npm run migrate:status
npm run frontend:test
npm run frontend:build
```

Em produção, `npm start` executa migrations de deploy antes de iniciar o servidor. O worker dedicado usa `npm run worker`.

## 14. Regra de manutenção

Ao alterar o backend:

1. localizar rota, controller, service, repository e migrations envolvidos;
2. validar autenticação, autorização e isolamento entre negócios;
3. preservar idempotência e atomicidade quando houver efeitos externos ou financeiros;
4. criar migration nova para mudança de schema;
5. atualizar testes proporcionais ao risco;
6. atualizar este documento quando a arquitetura ou o mapa operacional mudar;
7. atualizar o documento canônico do domínio e `AGENTS.md` quando a decisão durável mudar;
8. revisar o diff e o CI antes de merge/deploy.

Este arquivo documenta a estrutura do backend; não substitui documentos canônicos de regras específicas de produto.
