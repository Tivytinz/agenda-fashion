# Matriz exclusiva de requisitos da Administração — Admin v1.0

> **Escopo:** contexto administrativo do Agenda Fashion, separado da baseline funcional geral P0 + P1.
>
> **Baseline avaliada:** `main` no commit `deabc97abed79186aff720ba9dbe3933656dc8f9`.
>
> **Cobertura própria do Admin:** **39/40 requisitos = 97,5%**.

## Objetivo

Esta matriz cria uma baseline exclusiva para o **Admin / Command Center** do
Agenda Fashion.

Ela não substitui a matriz geral de critérios de aceitação do produto. A
baseline geral P0 + P1 continua independente em **67/67 (100%)**.

A matriz administrativa mede se o AF possui cobertura suficiente para operar e
analisar:

- aquisição;
- jornada até o primeiro agendamento;
- retenção;
- monetização;
- operação;
- marketing;
- integrações;
- saúde operacional;
- segurança administrativa.

## Regra de cobertura

Um requisito recebe apenas um dos dois estados abaixo:

- **Coberto** — o comportamento está implementado e possui evidência verificável
  em código executável, rota, migration, repository/service, frontend ou teste
  automatizado proporcional ao risco.
- **Não coberto** — falta parte necessária para considerar o requisito entregue
  de ponta a ponta.

A matriz não usa crédito parcial. Se um requisito depende de dado externo real e
o AF possui somente infraestrutura para recebê-lo, ele permanece **Não coberto**
até existir evidência factual operacional.

### Fórmula

```text
Cobertura Admin =
requisitos cobertos
÷
requisitos totais da baseline Admin
× 100
```

Na versão 1.0:

```text
39 ÷ 40 × 100 = 97,5%
```

## Resumo por domínio

| Domínio | Cobertos | Total | Cobertura |
| --- | ---: | ---: | ---: |
| Segurança e autorização | 6 | 6 | 100% |
| Arquitetura e UX administrativa | 6 | 6 | 100% |
| Visão geral executiva | 4 | 4 | 100% |
| Aquisição, jornada e retenção | 4 | 4 | 100% |
| Receita e economia SaaS | 9 | 10 | 90% |
| Operação | 4 | 4 | 100% |
| Marketing, WhatsApp e saúde | 5 | 5 | 100% |
| Qualidade automatizada | 1 | 1 | 100% |
| **Total Admin** | **39** | **40** | **97,5%** |

## Matriz de requisitos

| ID | Domínio | Requisito | Estado | Evidência principal |
| --- | --- | --- | --- | --- |
| ADM-001 | Segurança | Toda rota administrativa privada deve exigir autenticação e autorização administrativa no backend. | **Coberto** | `src/routes/adminRoutes.js`, `src/routes/adminAnalyticsV2Routes.js`, `tests/auth-admin.test.js` |
| ADM-002 | Segurança | A permissão de administrador deve ser consultada no banco em cada requisição e não deve ser confiada ao JWT. | **Coberto** | `src/middlewares/authAdmin.js`, `tests/auth-admin.test.js`, `tests/sessao-admin-context.test.js` |
| ADM-003 | Segurança | Operações financeiras administrativas de alto impacto devem ser restritas a `superadmin` no backend. | **Coberto** | `src/services/adminContributionOperationsService.js`, `src/services/contributionCostSyncService.js`, testes `admin-contribution-*` |
| ADM-004 | Segurança | Respostas administrativas com dados operacionais ou pessoais não devem permanecer em cache compartilhado/navegador. | **Coberto** | `src/routes/adminRoutes.js`, `src/routes/adminAnalyticsV2Routes.js` |
| ADM-005 | Segurança | O frontend administrativo deve bloquear navegação de usuário sem permissão administrativa. | **Coberto** | `frontend/src/App.jsx`, `frontend/src/auth/ProtectedRoute.admin.test.jsx` |
| ADM-006 | Segurança | Credenciais e segredos de integrações não devem ser devolvidos ao navegador nem persistidos em estruturas que não precisam deles. | **Coberto** | rotas/services de Marketing, WhatsApp e Wave 32; `database/migrations/103_sync_custos_contribuicao_v1.sql` |
| ADM-007 | Arquitetura/UX | A navegação principal deve separar Visão geral, Aquisição, Jornada, Retenção, Receita e Operação. | **Coberto** | `frontend/src/components/AdminLayout.jsx`, `docs/admin-console.md` |
| ADM-008 | Arquitetura/UX | Marketing detalhado, custos, Saúde e WhatsApp devem poder existir como rotas especializadas sem misturar semânticas na navegação principal. | **Coberto** | `frontend/src/App.jsx`, `docs/admin-console.md` |
| ADM-009 | Arquitetura/UX | O Admin deve possuir layout e navegação mobile próprios, preservando funcionamento em telas estreitas. | **Coberto** | `frontend/src/components/AdminShell.jsx`, `frontend/e2e/admin-mobile.spec.js`, `frontend/e2e/admin-operational-mobile.spec.js` |
| ADM-010 | Arquitetura/UX | Telas administrativas devem tratar loading, erro e indisponibilidade sem transformar falha de leitura em sucesso silencioso. | **Coberto** | páginas/componentes Admin e respectivos testes React |
| ADM-011 | Arquitetura/UX | Ausência ou falha de fonte deve aparecer como indisponível e não como zero sem evidência. | **Coberto** | `docs/admin-console.md`, Analytics V2, painéis de contribuição e seus testes |
| ADM-012 | Arquitetura/UX | Estado navegável relevante, como período, aba, busca, status e página, deve ser preservável em query string quando aplicável. | **Coberto** | `docs/admin-console.md`, `frontend/src/pages/AdminOperationPage.jsx`, páginas Analytics V2 |
| ADM-013 | Visão geral | A Visão geral deve priorizar KPIs executivos do funil: cadastros profissionais, ativações, agendamentos e assinaturas pagas. | **Coberto** | `docs/admin-visao-geral.md`, `frontend/src/pages/AdminOverviewV2Page.test.jsx`, Analytics V2 |
| ADM-014 | Visão geral | Ativação administrativa deve usar primeiro agendamento válido, ignorando reservas canceladas. | **Coberto** | `docs/admin-centro-comando.md`, repositories/services de Analytics V2 e testes de ativação |
| ADM-015 | Visão geral | Checkout iniciado deve permanecer separado de assinatura paga e não pode ser apresentado como receita. | **Coberto** | `docs/admin-visao-geral.md`, `docs/admin-centro-comando.md`, Analytics V2 |
| ADM-016 | Visão geral | Sinais de demanda de clientes finais devem manter semântica de sessões/eventos e não virar funil sequencial sem coorte válida. | **Coberto** | `docs/admin-visao-geral.md`, Analytics V2 e testes |
| ADM-017 | Growth | O Admin deve distinguir aquisição paga, orgânica e demais origens sem confundir clique/cadastro com ativação ou receita. | **Coberto** | Marketing/Admin Analytics, funil profissional, `docs/admin-marketing-visao-geral.md` |
| ADM-018 | Growth | O funil profissional canônico deve acompanhar Cadastro → Negócio → Serviço ativo → Publicação → Primeiro agendamento válido. | **Coberto** | `docs/admin-console.md`, services/repositories de funil profissional e testes |
| ADM-019 | Growth | A Jornada deve permitir diagnosticar avanço até o primeiro agendamento sem tornar configuração de agenda um gate de ativação/publicação. | **Coberto** | `docs/admin-console.md`, `frontend/src/pages/AdminJourneyV2Page.test.jsx` |
| ADM-020 | Growth | Retenção administrativa deve medir repetição observada após primeiro agendamento e não confundi-la automaticamente com cliente recorrente ou receita. | **Coberto** | `docs/admin-centro-comando.md`, services de recorrência, `frontend/src/pages/AdminRetentionV2Page.test.jsx` |
| ADM-021 | Receita | O Admin deve expor receita recorrente com MRR, GRR e NRR usando regras financeiras reconhecidas pelo backend. | **Coberto** | Wave 25, `tests/admin-analytics-v2-recurring-revenue.integration.test.js`, Analytics V2 |
| ADM-022 | Receita | Churn e episódios pagos devem ser medidos separadamente de simples cadastro ou checkout. | **Coberto** | Wave 24, services de recorrência/monetização e testes |
| ADM-023 | Receita | O Admin deve disponibilizar LTV observado D30/D60/D90 apenas para coortes maduras e cobertas. | **Coberto** | Wave 26, Analytics V2, testes de revenue/LTV |
| ADM-024 | Receita | CAC de mídia observado deve usar aquisição financeira canônica e manter custo de mídia separado de custo econômico total. | **Coberto** | Waves 27/30, `adminAcquisitionFinancialService`, testes de aquisição financeira |
| ADM-025 | Receita | Receita líquida de gateway e refunds devem usar fatos do gateway e não estimativa de taxa. | **Coberto** | Wave 28, `adminPaymentEconomicsRepository`, testes financeiros |
| ADM-026 | Receita | Margem e LTV de contribuição devem depender de custos variáveis factuais e cobertura completa das fontes obrigatórias. | **Coberto** | Wave 29, `adminContributionEconomicsRepository`, Analytics V2 e testes |
| ADM-027 | Receita | Retorno de contribuição sobre CAC de mídia deve preservar D30/D60/D90 e não ser chamado de payback econômico total. | **Coberto** | Wave 30, `adminContributionReturnRepository`, documentação/testes |
| ADM-028 | Receita | Superadmin deve poder operar fontes factuais, débitos, créditos e cobertura com trilha append-only e idempotência. | **Coberto** | Wave 31, migration 102, `adminContributionOperationsService`, testes unitários/integration |
| ADM-029 | Receita | O Admin deve possuir infraestrutura provider-agnostic para sincronizar custos factuais com cursor, replay, cobertura, lock e saúde operacional. | **Coberto** | Wave 32, migration 103, `contributionCostSyncService`, worker, painel e testes |
| ADM-030 | Receita | Deve existir ao menos um adaptador factual real em produção capaz de importar custo variável atribuível a negócio e liberar cobertura econômica real. | **Não coberto** | Registry da Wave 32 permanece intencionalmente vazio; nenhum provedor factual foi certificado |
| ADM-031 | Operação | Negócios devem ser pesquisáveis e paginados no backend, sem limitar busca à amostra carregada no navegador. | **Coberto** | `GET /admin/negocios`, `adminOperationService`, `tests/admin-operation-*` |
| ADM-032 | Operação | Agendamentos devem permitir busca, filtro de status e paginação server-side. | **Coberto** | `GET /admin/agendamentos`, `AdminOperationPage`, testes de operação |
| ADM-033 | Operação | A listagem administrativa de agendamentos não deve expor contato do cliente final quando ele não é necessário para a tarefa. | **Coberto** | `docs/admin-console.md`, repository/service de operação e testes |
| ADM-034 | Operação | A interface operacional deve preservar contexto de aba, busca, filtro e página quando aplicável. | **Coberto** | `AdminOperationPage.jsx`, `AdminOperationPage.test.jsx` |
| ADM-035 | Marketing/Saúde | O Admin deve permitir gestão de campanhas próprias preservando identidade UTM após criação. | **Coberto** | `adminCampaignService`, `adminCampaignRepository`, rotas e testes de campanha |
| ADM-036 | Marketing/Saúde | Custos de mídia devem aceitar registro manual e integrações externas com vínculo explícito, sem confiar em custo enviado livremente pelo frontend. | **Coberto** | `adminMarketingCostService`, `marketingCostSyncService`, testes de custos/integrações |
| ADM-037 | Marketing/Saúde | GA4 deve ser usado como leitura comportamental, sem substituir eventos canônicos do AF para ativação, agendamento, assinatura ou receita. | **Coberto** | `adminGoogleAnalyticsController`, `tests/admin-google-analytics.test.js`, documentação |
| ADM-038 | Marketing/Saúde | O Admin deve expor saúde de templates/entregas do WhatsApp sem devolver credenciais Meta ao navegador. | **Coberto** | `adminWhatsAppService`, `AdminWhatsAppPage`, `tests/admin-whatsapp-*` |
| ADM-039 | Marketing/Saúde | O Admin deve disponibilizar diagnóstico de ativação/saúde operacional, incluindo perfis incompletos e maturidade de ML de no-show como sinal separado. | **Coberto** | rotas `/admin/saude/*`, `AdminSaasHealthPage`, testes de SaaS Health |
| ADM-040 | Qualidade | O contexto administrativo deve possuir testes automatizados proporcionais ao risco em frontend, backend, integração PostgreSQL e fluxos mobile/desktop. | **Coberto** | suíte `tests/admin-*`, testes React Admin, `frontend/e2e/admin-desktop.spec.js`, `admin-mobile.spec.js` |

## Lacuna atual

A única lacuna da baseline Admin v1.0 é **ADM-030**.

A Wave 32 já entrega a infraestrutura genérica de sincronização, mas seu registry
de produção foi propositalmente criado vazio. Portanto o AF ainda não possui um
provedor factual certificado que consiga provar, de ponta a ponta:

```text
evento externo real
→ negócio correto
→ custo variável factual
→ débito/crédito idempotente
→ cobertura reconciliada
→ margem/LTV/retorno disponíveis
```

A cobertura do Admin não deve subir para 100% apenas por cadastrar um valor
manual ou criar um adaptador baseado em estimativa.

Para fechar ADM-030, o provedor precisa possuir evidência verificável de custo e
regra objetiva de atribuição ao negócio.

## Critério para 100%

A baseline Admin v1.0 chegará a **40/40 (100%)** quando ADM-030 estiver concluído
com:

1. adaptador real registrado no backend;
2. fonte factual real;
3. associação objetiva ao `negocio_id`;
4. identificador externo idempotente;
5. débito e correção/reversão reconciliáveis;
6. cobertura completa verificável;
7. teste PostgreSQL de ingestão e replay;
8. evidência operacional de pelo menos uma sincronização factual bem-sucedida.

## Governança da matriz

Esta baseline mede apenas requisitos administrativos permanentes.

Não adicionar à matriz:

- métricas temporárias de campanha;
- quantidade atual de usuários;
- MRR ou receita de um mês específico;
- resultados momentâneos de Ads;
- estado passageiro de uma integração;
- ideias que ainda não foram aprovadas como requisito.

Ao criar um novo requisito administrativo durável:

1. atribuir novo ID sequencial `ADM-xxx`;
2. definir o comportamento verificável;
3. registrar evidência;
4. atualizar numerador e denominador;
5. recalcular o percentual próprio do Admin.

Não reclassificar um requisito como coberto apenas porque a interface existe. A
cobertura exige comportamento verificável no backend quando segurança, dinheiro,
permissão ou integridade de dados estiverem envolvidos.
