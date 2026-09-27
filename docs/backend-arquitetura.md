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

## 5. Inventário de endpoints

Este inventário é derivado dos routers efetivamente montados por `src/routes/index.js`. Ele documenta método, caminho e fronteira HTTP principal; regras finas de payload e autorização continuam pertencendo ao controller/service correspondente.

### 5.1 Autenticação, sessão, conta e negócio

| Método | Endpoint | Acesso / middleware relevante |
| --- | --- | --- |
| GET | `/auth/configuracao-publica` | público |
| POST | `/cadastro` | público + rate limit de cadastro |
| POST | `/login` | público + rate limit de login |
| POST | `/auth/google` | público + rate limit de login |
| POST | `/auth/esqueci-senha` | público + rate limit de recuperação |
| POST | `/auth/redefinir-senha` | público + rate limit de recuperação |
| POST | `/auth/migrar-sessao-legada` | autenticado |
| POST | `/logout` | revogação de sessão |
| GET | `/minha-sessao` | autenticado |
| POST | `/criar-negocio` | autenticado |
| GET | `/meu-negocio` | autenticado; compatibilidade |
| POST | `/negocio/encerrar` | autenticado |
| GET | `/buscar-negocios` | autenticado; fluxo antigo |
| POST | `/entrar-negocio` | autenticado; entrada direta bloqueada pelo fluxo atual |
| GET/PUT | `/conta` | autenticado |
| PUT | `/conta/preferencias-whatsapp` | autenticado |
| PUT | `/conta/notificacoes-whatsapp` | autenticado |
| PUT | `/conta/senha` | autenticado |
| POST | `/conta/foto` | autenticado + upload + rate limit |
| POST | `/conta/desativar` | autenticado |
| DELETE | `/conta` | autenticado |

### 5.2 Configuração, profissionais e serviços

| Método | Endpoint | Acesso / middleware relevante |
| --- | --- | --- |
| GET/PUT | `/configuracoes` | autenticado |
| GET | `/cep/:cep` | autenticado + rate limit de leitura |
| POST | `/configuracoes/foto` | autenticado + upload + rate limit |
| PATCH | `/configuracoes/publicacao` | autenticado |
| GET | `/profissionais` | autenticado |
| PUT/DELETE | `/profissionais/:id` | autenticado |
| POST | `/profissionais/:id/ativar` | autenticado |
| GET/PUT | `/profissionais/:id/servicos` | autenticado |
| GET | `/profissionais/convites/recebidos` | autenticado |
| POST | `/profissionais/convites` | autenticado + rate limit de convites |
| POST | `/profissionais/convites/:id/aceitar` | autenticado |
| POST | `/profissionais/convites/:id/recusar` | autenticado |
| POST | `/profissionais/vincular` | autenticado + rate limit; compatibilidade via convite |
| GET/POST | `/servicos` | autenticado |
| PUT/DELETE | `/servicos/:id` | autenticado |
| PATCH | `/servicos/:id/ativo` | autenticado |
| POST | `/servicos/:id/foto` | autenticado + upload + rate limit |
| GET/POST | `/servicos/:id/fotos` | autenticado; POST inclui upload + rate limit |
| PUT | `/servicos/:id/capa` | autenticado |
| DELETE | `/servicos/fotos/:fotoId` | autenticado |

### 5.3 Planos, checkout e assinatura

| Método | Endpoint | Acesso / middleware relevante |
| --- | --- | --- |
| GET | `/planos` | resposta JSON somente quando `Accept` solicita JSON sem HTML |
| GET | `/meu-plano` | autenticado |
| POST | `/checkout` | autenticado + rate limit de checkout |
| GET | `/checkout/status/:pagamento_id` | autenticado |
| GET | `/minha-assinatura` | autenticado |
| DELETE | `/minha-assinatura` | autenticado |
| POST | `/webhook/asaas` | autenticação própria do webhook Asaas |

### 5.4 Agenda e agendamentos

| Método | Endpoint | Acesso / middleware relevante |
| --- | --- | --- |
| GET | `/agenda-geral` | autenticado |
| GET | `/agenda-profissional` | autenticado + profissional ativo |
| GET | `/agendamentos-profissional` | autenticado + profissional ativo; alias operacional |
| PATCH | `/agendamentos/:id/atendimento` | autenticado + booking operacional ativo |
| PATCH | `/agendamentos/:id/cancelar-operacional` | autenticado + booking operacional ativo |
| PATCH | `/agendamentos/:id/reagendar-operacional` | autenticado + booking operacional ativo |
| POST | `/bloqueios-horario` | autenticado + vínculo ativo de agenda |
| GET | `/notificacoes-agenda` | autenticado |
| GET | `/agenda-configuracao/status` | autenticado |
| GET/PUT | `/agenda-configuracao` | autenticado |
| GET | `/agenda-publica` | público + rate limit de leitura |
| GET | `/agenda-publica/politica-cancelamento` | público + rate limit de leitura |
| POST | `/agendamentos` | público/autenticação opcional + rate limit + validação da política |
| GET | `/meus-agendamentos` | autenticado |
| PATCH | `/agendamentos/:id/cancelar` | autenticado |
| GET | `/agendamentos/:id/acesso-visitante` | público + rate limit |
| PATCH | `/agendamentos/:id/cancelar-visitante` | capability de visitante + rate limit |
| GET | `/agendamentos/:id/acesso-cliente-desativado` | público + rate limit |
| PATCH | `/agendamentos/:id/cancelar-acesso-cliente-desativado` | acesso específico + rate limit |
| PATCH | `/agendamentos/:id/avaliar` | autenticado |

### 5.5 Perfil público, favoritos, dashboard e notificações

| Método | Endpoint | Acesso / middleware relevante |
| --- | --- | --- |
| GET | `/negocios-publicos` | público + rate limit |
| GET | `/catalogo-local/:categoria/:localidade` | público + rate limit |
| GET | `/sitemap.xml` | público |
| GET | `/robots.txt` | público |
| GET | `/perfil-negocio/:slug` | público + rate limit |
| GET | `/social-preview.png` | público |
| GET | `/servicos/:categoria/em/:localidade` | página pública renderizada |
| GET | `/negocio/:slug` | página pública renderizada |
| GET | `/favoritos` | autenticado |
| POST/DELETE | `/favoritos/:negocioId` | autenticado |
| GET | `/favoritos/:negocioId/status` | autenticado |
| GET | `/dashboard-profissional` | autenticado |
| GET | `/dashboard-dono` | autenticado |
| GET | `/dashboard-dono/origem-clientes` | autenticado |
| POST | `/dashboard-dono/copilot/divulgacao` | autenticado + rate limit do Copilot |
| GET | `/notificacoes` | autenticado |
| PATCH | `/notificacoes/:id/lida` | autenticado |

### 5.6 Analytics, consentimento e WhatsApp

| Método | Endpoint | Acesso / middleware relevante |
| --- | --- | --- |
| POST | `/eventos-produto` | autenticação opcional + rate limit; coletor legado |
| POST | `/analytics/collect` | autenticação opcional + rate limit |
| GET | `/marketing/meta/config` | público |
| POST | `/marketing/meta/consentimento` | autenticado |
| GET | `/marketing/google/config` | público |
| POST | `/marketing/google/consentimento` | autenticado |
| GET | `/webhook/whatsapp` | verificação pública do webhook |
| POST | `/webhook/whatsapp` | autenticação própria do webhook WhatsApp |

### 5.7 Administração

Todas as leituras administrativas abaixo, exceto callbacks OAuth explicitamente indicados, passam por sessão autenticada e `authAdmin`. Respostas administrativas recebem política para impedir cache de documento.

| Método | Endpoint | Observação |
| --- | --- | --- |
| GET | `/admin/dashboard` | resumo da plataforma |
| GET | `/admin/usuarios` | usuários |
| GET | `/admin/auditoria` | auditoria |
| POST | `/admin/auditoria/:id/revisao` | auditado: `auditoria_revisar` |
| GET | `/admin/negocios` | negócios |
| GET | `/admin/agendamentos` | agendamentos |
| GET | `/admin/marketing` | painel legado |
| GET | `/admin/marketing/resumo` | atribuição/resumo |
| GET | `/admin/marketing/campanhas` | campanhas |
| GET | `/admin/marketing/conversoes` | conversões |
| GET | `/admin/marketing/ga4` | GA4 Data API |
| GET | `/admin/marketing/funil-profissionais` | funil profissional |
| GET | `/admin/marketing/recorrencia-profissionais` | recorrência |
| GET | `/admin/saude/perfis-incompletos` | saúde de ativação |
| GET | `/admin/saude/operacional` | saúde operacional |
| GET | `/admin/saude/ml-no-show` | maturidade ML/no-show |
| GET | `/admin/whatsapp/templates` | templates/entregas |
| GET/POST | `/admin/marketing/gestao-campanhas` | POST auditado: `campanha_criar` |
| PATCH | `/admin/marketing/gestao-campanhas/:id` | auditado: `campanha_atualizar` |
| GET | `/admin/marketing/custos` | custos |
| GET | `/admin/marketing/gastos` | gastos |
| POST | `/admin/marketing/gastos` | auditado: `gasto_registrar` |
| GET | `/admin/financeiro/contribuicao` | contribuição |
| POST | `/admin/financeiro/contribuicao/fontes` | auditado: `contribuicao_fonte_criar` |
| POST | `/admin/financeiro/contribuicao/custos` | auditado: `contribuicao_custo_registrar` |
| POST | `/admin/financeiro/contribuicao/cobertura` | auditado: `contribuicao_cobertura_registrar` |
| GET | `/admin/financeiro/contribuicao/sync` | status de sync |
| POST | `/admin/financeiro/contribuicao/sync/integracoes` | auditado: `contribuicao_integracao_criar` |
| PATCH | `/admin/financeiro/contribuicao/sync/integracoes/:id` | auditado: `contribuicao_integracao_atualizar` |
| POST | `/admin/financeiro/contribuicao/sync/integracoes/:id/executar` | auditado: `contribuicao_sincronizar` |
| POST | `/admin/marketing/custos-integracoes/tiktok_ads/autorizacao` | inicia OAuth; auditado |
| GET | `/admin/marketing/custos-integracoes/tiktok_ads/callback` | callback público protegido por state de uso único |
| POST | `/admin/marketing/custos-integracoes/pinterest_ads/autorizacao` | inicia OAuth; auditado |
| GET | `/admin/marketing/custos-integracoes/pinterest_ads/callback` | callback público protegido por state de uso único |
| GET | `/admin/marketing/custos-integracoes` | status das integrações |
| GET | `/admin/marketing/custos-integracoes/:provedor/campanhas` | campanhas do provider |
| POST | `/admin/marketing/custos-integracoes/:provedor/testar` | teste de integração |
| POST | `/admin/marketing/custos-integracoes/vinculos` | auditado: `midia_vincular` |
| POST | `/admin/marketing/custos-integracoes/:provedor/sincronizar` | auditado: `midia_sincronizar` |
| GET | `/admin/analytics-v2/:secao` | auth + admin; sem cache |

## 6. Persistência e migrations

O PostgreSQL é acessado por `pg`. O histórico atual vai de `001_usuarios.sql` até `105_admin_auditoria_revisoes.sql`, com numeração histórica não necessariamente contínua.

Mudanças de schema exigem migration nova. Migrations aplicadas não devem ser editadas. O startup de produção executado por `npm start` chama `npm run migrate:deploy` antes de iniciar `src/server.js`, e o readiness também rejeita banco atrás da versão esperada.

Os repositories são a fronteira preferencial para SQL. Operações críticas de booking, billing, webhooks e sincronizações usam transações/locks quando o domínio exige atomicidade ou serialização.

## 7. Segurança e fronteiras de confiança

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

## 8. Agendamento

O backend separa agenda pública, configuração e operação. Os módulos de agendamento cobrem criação pública, cancelamento, lifecycle, reagendamento, notificações e ações da cliente.

Invariantes duráveis incluem validação server-side de disponibilidade, elegibilidade profissional↔serviço, conflitos por instante absoluto, snapshots históricos e serialização das mutações concorrentes. O detalhe canônico fica em [ciclo-atendimento.md](./ciclo-atendimento.md) e [agendamento-integridade.md](./agendamento-integridade.md).

## 9. Billing e financeiro

Assinaturas foram decompostas em serviços/repositories especializados para registro, conta, ativação Asaas, pagamentos, lifecycle, inadimplência e webhook. Checkout possui repository próprio e fencing de tentativa.

O retorno do navegador não ativa plano. A confirmação financeira depende do backend e do processamento autenticado/idempotente do Asaas. Reconciliações financeiras também podem rodar em background.

## 10. Marketing, analytics e growth

O backend mantém separadas telemetria, atribuição, custo e resultado financeiro. Há módulos específicos para Analytics v2, Google Measurement, Meta Ads, sincronização de custos, entrega de conversões, atribuição persistente e leituras administrativas.

Custos e integrações externas devem preservar origem factual e estado de sincronização; valores controlados por providers não devem ser inferidos como fatos quando ausentes.

## 11. Workers

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

## 12. Integrações externas

As integrações visíveis no backend incluem Asaas, WhatsApp Cloud API, Resend/e-mail, Cloudinary, Google Identity/Measurement/Ads, Meta Ads, TikTok Ads, Pinterest Ads e OpenAI no módulo de Copilot.

Credenciais ficam no backend e a configuração habilitada deve ser completa. Providers externos não devem controlar autorização interna nem transformar respostas externas em fatos financeiros sem validação.

## 13. Testes e evidência

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

## 14. Comandos operacionais

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

## 15. Regra de manutenção

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
