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

### 6.1 Política de conexão e transação

O acesso ao PostgreSQL é centralizado em `src/db/db.js`, usando `pg.Pool`. A origem da conexão é `DATABASE_URL` com fallback para `DATABASE_PRIVATE_URL`. Em produção, o pool usa TLS e recebe limites/timeouts de `src/config/databasePool.js`.

A camada de banco distingue leitura de escrita para retry: consultas iniciadas por `SELECT`, `SHOW`, `EXPLAIN` ou `VALUES` podem receber **uma segunda tentativa** após falha transitória de conexão; escritas não são repetidas automaticamente para evitar duplicação de agendamentos, pagamentos ou cadastros. `connect()` também pode repetir uma única obtenção de conexão antes de uma transação começar. `executarTransacao()` executa `BEGIN/COMMIT`, tenta `ROLLBACK` em falha e nunca repete a transação automaticamente.

O readiness do banco consulta `schema_migrations` e compara a maior versão aplicada com a maior migration válida encontrada em `database/migrations`. Portanto, `/health/ready` e o processo dedicado de workers não consideram o banco pronto enquanto a versão persistida estiver abaixo da versão esperada.

### 6.2 Mapa dos domínios persistidos

A lista abaixo é um mapa de ownership lógico, não uma tentativa de repetir todas as colunas das migrations.

| Domínio | Tabelas/estruturas centrais | Repositories principais |
| --- | --- | --- |
| Identidade e sessão | `usuarios`, vínculos e revogações de sessão | `authRepository`, `authSessionRepository`, `sessaoRepository`, `sessionRevocationRepository`, `contaRepository` |
| Negócio e equipe | `negocios`, `usuarios_negocios`, convites e perfil profissional | `negocioRepository`, `profissionaisRepository`, `configuracoesRepository` |
| Serviços | `servicos_negocio`, fotos e matriz profissional-serviço | `servicosRepository`, `profissionalServicosRepository` |
| Agenda | configurações, disponibilidade, bloqueios e contexto profissional-negócio | `agendaConfiguracaoRepository`, `agendaContextoRepository`, `agendaRepository`, `agendaPublicaRepository` |
| Booking | `agendamentos`, snapshots, lifecycle, cancelamento e reagendamento | `agendamentoLifecycleRepository`, `agendamentoCancelamentoRepository`, `agendamentoReagendamentoRepository`, `bookingAnalyticsRepository` |
| Planos e billing | `planos`, assinaturas, pagamentos, tentativas de checkout e eventos de assinatura | `planoRepository`, `assinaturaRepository`, `assinaturaAtivacaoRepository`, `assinaturaEventoRepository`, `pagamentoRepository`, `checkoutRepository`, `checkoutTentativaRepository` |
| Webhooks | eventos recebidos e retenção de payload | `webhookEventoRepository`, `webhookRetentionRepository`, `assinaturaWebhookRepository` |
| WhatsApp | mensagens, fila, estado e agenda de comunicação | família `whatsappMensagem*` e `whatsappAgendaRepository` |
| Marketing | campanhas, gastos, atribuição, conversões, OAuth e sincronização de custos | família `marketing*`, `metaAdsRepository`, `googleMeasurementRepository`, repositories TikTok/Pinterest |
| Analytics | eventos first-party, jornadas e agregações administrativas | `analyticsV2Repository`, `eventoProdutoRepository`, `adminAnalyticsV2Repository` |
| Financeiro analítico | aquisição financeira, economia de pagamentos, MRR/LTV/contribuição | `aquisicaoFinanceiraRepository`, `paymentEconomicsRepository`, família `admin*Economics*` |
| Contribuição | fontes, ledger de custos, cobertura, integrações e histórico de sync | `contributionEconomicsRepository`, `contributionCostSyncRepository`, repositories administrativos de contribuição |
| Administração/auditoria | administradores, operações e eventos append-only | `adminRepository`, `adminOperationRepository`, `adminAuditRepository` |

### 6.3 Invariantes importantes do banco

- `usuarios.email` possui unicidade case-insensitive e formato normalizado.
- `negocios.slug` é único e é o identificador público do perfil.
- `usuarios_negocios` impede dois donos ativos para o mesmo negócio e mais de um vínculo profissional ativo por conta.
- Serviços pertencem ao negócio; nomes de serviços ativos são únicos por negócio.
- Agendamentos mantêm referências restritivas para preservar histórico e receberam snapshots/instante UTC em migrations posteriores.
- Webhooks e checkout possuem estruturas específicas de idempotência/fencing; processamento financeiro não deve depender de repetição cega de escrita.
- Os ledgers financeiros introduzidos nas waves recentes preservam fatos históricos em vez de recalcular silenciosamente o passado.
- `contribuicao_custos` é um ledger de débito/crédito com chave de origem idempotente; correções são novos fatos, não edição destrutiva.
- `contribuicao_operacoes_admin` e `admin_auditoria_eventos` são trilhas append-only protegidas por trigger contra mutação.
- `contribuicao_integracoes_sync` não armazena credenciais; o cursor só deve avançar junto da persistência reconciliada dos fatos/cobertura.

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

### 11.1 Catálogo operacional dos workers

Os oito workers são coordenados por `src/workers/backgroundWorkers.js`. O processo HTTP pode iniciá-los quando habilitado e `src/worker.js` permite executá-los em processo dedicado. O shutdown aguarda as execuções conhecidas antes de encerrar o pool.

| Worker | Responsabilidade | Controles relevantes |
| --- | --- | --- |
| `webhook` | processar fila Asaas, entregas de conversão e retenção de payloads | roda imediatamente e a cada 30 s; lease/fencing impede finalização por tentativa que perdeu a reserva; eventos podem terminar `PROCESSED` ou `IGNORED` |
| WhatsApp | consumir fila de mensagens e executar lembretes/automações habilitadas | condicionado por `WHATSAPP_NOTIFICATIONS_ENABLED`; intervalo e lote configuráveis; automações adicionais possuem flags próprias |
| custos de marketing | sincronizar custos dos providers de mídia configurados | agenda controlada por configuração/feature flag; integrações preservam vínculo explícito com campanha externa |
| ML no-show | materializar base de dados operacional para evolução do modelo de no-show | `ML_NO_SHOW_DATA_ENABLED`; intervalo e lote configuráveis; não equivale a decisão automatizada sobre cliente |
| `billing_reconciliation` | encerrar períodos pagos cancelados vencidos e materializar inadimplência terminal | evita execução concorrente; lote, intervalo e janela terminal configuráveis; falha individual não interrompe os demais candidatos |
| `acquisition_financial_reconciliation` | materializar snapshots pendentes de aquisição financeira | evita execução concorrente; processa em lote e registra falhas por candidato |
| `payment_economics_reconciliation` | reconciliar economia líquida observada dos pagamentos | evita execução concorrente; distingue reconciliados, obsoletos e falhas |
| `contribution_cost_sync` | ingerir custos variáveis de fontes/adaptadores configurados | só agenda quando habilitado; impede sobreposição; cobertura/cursor dependem da reconciliação da fonte |

### 11.2 Regras de execução

Workers periódicos mantêm proteção local contra sobreposição da própria execução. Métricas operacionais registram worker iniciado/parado e início/sucesso/falha das execuções. Os workers financeiros processam candidatos individualmente quando aplicável, permitindo contabilizar falhas sem transformar uma falha isolada em rollback lógico de todo o lote.

A idempotência não é delegada ao timer: ela é sustentada pelos repositories, constraints, chaves externas, leases, snapshots e operações transacionais de cada domínio. Por isso, aumentar frequência ou paralelismo exige revisar essas garantias antes de alterar a agenda.

## 12. Integrações externas

As integrações visíveis no backend incluem Asaas, WhatsApp Cloud API, Resend/e-mail, Cloudinary, Google Identity/Measurement/Ads, Meta Ads, TikTok Ads, Pinterest Ads e OpenAI no módulo de Copilot.

Credenciais ficam no backend e a configuração habilitada deve ser completa. Providers externos não devem controlar autorização interna nem transformar respostas externas em fatos financeiros sem validação.

### 12.1 Contratos operacionais das integrações

| Integração | Uso no backend | Garantias e falhas relevantes |
| --- | --- | --- |
| Asaas | clientes financeiros, cobranças PIX, assinaturas, pagamentos, refunds e webhooks | configuração valida combinação de endpoint oficial e tipo de chave; timeout padrão de 10 s; reutilização por `externalReference` é usada nos fluxos que exigem idempotência; remoção de assinatura trata 404 como remoção já efetivada |
| Meta | Pixel/configuração pública e Conversions API | envio server-side depende de feature flag, credencial e consentimento; identificadores pessoais elegíveis são normalizados/hasheados; falha de CAPI é registrada sem derrubar o fluxo principal |
| Google | GA4/Google Ads measurement e consentimento | IDs/labels são validados antes de exposição; Measurement Protocol depende de feature flag e secret; consentimento é persistido separadamente do simples carregamento da configuração |
| WhatsApp/Meta Graph | mensagens transacionais, lembretes e webhook de status/conversa | envio depende de configuração/flags; webhook POST possui autenticação própria; falha de comunicação posterior ao commit não deve desfazer booking |
| Resend | e-mail de redefinição de senha | envio depende de feature flag e configuração; timeout de 15 s; falha do provider vira erro controlado do domínio de e-mail |
| Cloudinary | imagens de conta, negócio e serviços | credenciais permanecem somente no backend; uploads passam pelos limites/middlewares das rotas correspondentes |
| OpenAI | Copilot de divulgação | `COPILOT_AI_ENABLED` + API key; Responses API; timeout configurável de 1–20 s; saída exige JSON Schema estrito; contexto é tratado como dado, não instrução; logs de falha não registram prompt nem conteúdo gerado |
| TikTok Ads | OAuth administrativo e importação de campanhas/custos | requer autorização OAuth e advertiser configurado; timeout máximo de 30 s; paginação limitada a 100 páginas; falha externa é normalizada para 502/504 |
| Pinterest Ads | OAuth administrativo e importação de campanhas/custos | requer autorização OAuth e ad account configurada; timeout máximo de 30 s; paginação limitada e analytics em lotes; falha externa é normalizada para 502/504 |

### 12.2 Fronteira de confiança

Tokens, API keys, client secrets e credenciais OAuth não pertencem ao frontend. Configurações públicas expõem apenas identificadores necessários ao navegador, como IDs de measurement/pixel quando habilitados. Callbacks OAuth de mídia usam estado de uso único e retornam ao domínio público configurado.

Integrações de marketing são auxiliares ao produto: indisponibilidade de tracking não deve converter cadastro, checkout ou assinatura em falha quando o fato principal já foi persistido. Integrações financeiras são diferentes: confirmação de pagamento e entitlement dependem da evidência autenticada do provedor e das regras idempotentes do backend.

## 13. Contrato de erros HTTP

O middleware global `errorHandler` é a última fronteira de serialização de falhas da API. Erros operacionais conhecidos preservam status e mensagem; falhas não tratadas retornam resposta genérica e não expõem stack em produção.

### 13.1 Envelope

Erros operacionais usam o seguinte formato lógico:

```json
{
  "erro": "Mensagem segura para o consumidor",
  "codigo": "codigo_opcional",
  "pendencias": [],
  "request_id": "id-opcional-da-requisicao"
}
```

`codigo` e `pendencias` só aparecem quando o erro fornece esses campos. `request_id` acompanha a resposta quando a requisição possui identificador, permitindo correlação com observabilidade sem expor detalhes internos.

### 13.2 Classes e status

| Tipo | HTTP | Uso |
| --- | ---: | --- |
| `ValidationError` | 400 | entrada inválida |
| `UnauthorizedError` | 401 | autenticação ausente/inválida |
| `ForbiddenError` | 403 | identidade válida sem autorização |
| `NotFoundError` | 404 | recurso inexistente ou não visível no contexto autorizado |
| `AppError` | configurável | erro operacional explícito do domínio |
| erro inesperado | 500 | mensagem pública fixa `Erro interno do servidor.` |

O handler também traduz violações conhecidas de integridade do PostgreSQL para 409. Atualmente isso inclui tentativa de remover serviço que possui histórico de agendamentos e inconsistência do vínculo profissional-negócio de um agendamento.

Erros 4xx informados por componentes externos ao `AppError` também são tratados como operacionais. Erros não operacionais são registrados com rota, método, código e `request_id`; detalhes/stack só podem aparecer no log fora de produção. A resposta HTTP de erro inesperado nunca devolve esses detalhes.

## 14. Testes e evidência

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

## 15. Comandos operacionais

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

## 16. Regra de manutenção

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
