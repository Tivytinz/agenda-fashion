# Auditoria de autorização e RBAC

**Data:** 13/10/2026. **Base auditada:** `b20ed7509e4a7f892607af302a163a5f10012f46`.
**Tipo documental:** evidência de auditoria do backend.

## Decisão posterior — administração com papel único

O responsável pelo AF definiu somente `admin` após a primeira validação desta
revisão. A [matriz por ação](./admin-permissoes-matriz.md) documenta as 41 ações.
A migration 115 converte o papel legado e preserva eventos históricos. Admin
ativo passa a acessar auditoria e contribuição financeira. O restante deste
relatório mantém a evidência anterior à decisão; o novo commit exige novo CI.

## Revalidação e correções — 16/10/2026

**Base:** `084afc7c0c3c8d91237301078643922e98d4a289` (main, PR #395).
**Branch:** `audit/rbac-hardening`. Revisão preparada para validação em PR de
rascunho no CI. Os resultados locais abaixo não representam merge, deploy ou
teste contra dados de produção.

O modelo segue sendo RBAC contextual com verificação de vínculo, negócio,
responsável e estado. Não foi confirmado bypass de papel nem acesso entre
negócios nos caminhos exercitados. Foram confirmadas duas inconsistências e
ampliada a cobertura de recusa de acesso.

| Achado | Prioridade | Evidência anterior | Correção preparada |
| --- | --- | --- | --- |
| RBAC-03 — Credencial de cliente desativado aceita na URL | P2, hardening de capability | `encerramentoController` aceitava `req.query.token` em consulta/cancelamento. O teste com HMAC válido na query retornava 200. Essa forma de transporte aumenta a superfície de exposição da credencial em URLs e infraestrutura intermediária. Não foi investigado nem confirmado vazamento histórico. | Remove o fallback de query; mantém header para consulta e corpo JSON para cancelamento, como a interface já usa. Respostas de capability de visitante/cliente desativado passam a usar `no-store`, inclusive nos erros. |
| RBAC-04 — Recusa de assinatura classificada como falha interna | P3, contrato de erro | `GET /minha-assinatura` de conta sem vínculo de dona retornava 500. Não liberava dados financeiros. | Service responde 401 sem identidade e 404 sem negócio autorizado, consistente com o cancelamento de assinatura. Testes impedem consultas financeiras após a recusa. |
| RBAC-02 — Cobertura negativa distribuída | P3, melhoria | A revisão anterior recomendava consolidar a matriz de negação. | Nova matriz inventaria todas as 146 declarações, exige exceções explícitas e verifica 114 rotas sem sessão, 39 rotas administrativas com papel forjado e a recusa de assinatura. Isolamento de recurso/RN50 ganha suíte integrada adicional. |

### Matriz e isolamento exercitados

O inventário executável encontra **146 declarações em 24 módulos de rotas**
(excluído o agregador): **114 com autenticação obrigatória**, incluindo **39
administrativas**, e **32 exceções explícitas**. As exceções distinguem APIs
públicas, autenticação opcional, logout, capabilities, webhooks e callbacks OAuth.
O teste falha se uma nova rota sem autenticação não tiver classificação revisada.
Isso verifica a fronteira declarada, não prova sozinho autorização de cada recurso.

| Cenário | Resultado observado |
| --- | --- |
| Anônimo nas 114 rotas privadas | 401, antes de consultar dados |
| JWT assinado com claims falsos de superadmin, header de contexto e payload forjado | 403 nas 39 rotas administrativas; o banco recebe a identidade autenticada |
| Dona de A e profissional de B tenta editar serviço/equipe de B | 404; serviço e vínculo de B permanecem inalterados |
| Profissional ativa tenta concluir/cancelar reserva de outra responsável de B | 403 e estado persistido preservado |
| Vínculo de B inativo e vínculo de dona ativo em A | Não ganha agenda profissional por fallback; consulta restrita retorna somente a própria reserva de B |
| RN50: concluir a própria reserva após o término | 200; a exceção não libera cancelamento/reagendamento nem reserva alheia |
| Remoção e recriação do vínculo | Reservas anteriores não reaparecem nem podem ser atualizadas |
| Capability apenas na query | 403; header/corpo legítimos continuam funcionando |

### Validação local desta revisão

- **361 testes em 27 suítes** com configuração normal do Jest: matriz de rotas,
  sessão, papéis administrativos, contexto, agenda, RN50, serviços, checkout,
  assinatura, favoritos, OAuth e transporte/cache de capabilities. São 353 da
  regressão em 26 suítes mais os 8 casos novos de `booking-capability-http`;
  reexecuções sobrepostas não entram novamente na contagem.
- **19 testes SQL/API em 3 suítes**, com as migrations aplicadas em PostgreSQL
  18.6 embarcado (PGlite 0.5.10): `rbac-resource-isolation.integration`,
  `privacidade-encerramento.integration` e
  `agenda-profissional-autorizacao-integracao`. A adaptação externa ao produto
  preserva o formato de bigint/numeric do driver `pg` e executa o SQL real.
- Reproduções na base anterior: capability na query retornava 200; recusa de
  assinatura retornava 500. Com as correções, esses cenários retornam 403 e 404.
- Build frontend aprovado e diff revisado sem erros de whitespace.

**Limites:** o ambiente local não permite iniciar o PostgreSQL nativo por falta de
permissão para trocar o usuário do processo. O harness embarcado não comprova
concorrência entre conexões independentes. Uma tentativa ampliada com outras
cinco suítes SQL foi interrompida sem resultado conclusivo e não foi contada como
aprovação. O CI com PostgreSQL servidor ainda precisa validar esta branch antes
de integração. Não houve pen test de produção, verificação de logs históricos ou
certificação de todas as combinações de papel/recurso/estado.

### Melhorias ainda recomendadas

1. Ampliar a matriz de isolamento por família para fotos, notificações, favoritos,
   convites, faturamento e todas as combinações de conta/negócio arquivado; os
   guards e testes existentes foram inspecionados, mas a matriz integrada nova é
   focada em equipe, serviços, reservas e RN50.
2. Exercitar revogação concorrente (perda de vínculo durante uma escrita) em
   PostgreSQL servidor. A consulta inicial de papel não deve ser tratada como
   garantia de revogação atômica de todas as operações já em andamento.
3. Formalizar permissões por ação administrativa antes de adicionar novos níveis
   ou papéis. A especificação v1.17 ainda lista essa definição como pendência;
   esta auditoria não cria novos privilégios por suposição.

## Histórico da auditoria de 13/10 e evolução RN50

**Evolução RN50 (15/10/2026):** a implementação preparada após esta auditoria
adiciona a área restrita de reservas existentes e permite somente consulta,
`realizado` e `falta` para a responsável com vínculo inativo preservado.
Cancelamento e reagendamento ficam com a dona. A regra atual e os critérios de
revogação estão em [ciclo-atendimento.md](./ciclo-atendimento.md#rn50--reservas-existentes-de-vínculo-inativo).
Os achados e números abaixo continuam representando a base auditada em 13/10,
não uma nova certificação da aplicação nem uma confirmação de deploy.

Validação local da evolução RN50: lint e build aprovados; 698 testes frontend,
123 testes backend com doubles e 20 cenários WebKit com APIs simuladas passaram.
As 114 migrations foram aplicadas sem alteração em PostgreSQL 18.6 embarcado
(PGlite, instalado somente no harness externo ao produto); nele passaram 10
cenários novos da RN50 e duas regressões existentes de lifecycle/autorização.
Essa execução exercita o SQL e as transações, mas não substitui o CI com
PostgreSQL servidor nem valida concorrência entre conexões independentes.
Safari nativo e deploy não fazem parte dessa evidência local.

As regras de identidade, contexto e sessão continuam em
[arquitetura.md](./arquitetura.md), [contexto-negocio.md](./contexto-negocio.md)
e [session-security.md](./session-security.md). Este relatório registra a
implementação observada, a matriz de acesso, os testes e as pendências dessa base.

## Resultado

O AF implementa RBAC contextual, complementado por verificações de vínculo,
negócio, estado e propriedade do recurso. Os papéis de negócio e os papéis
administrativos são persistidos separadamente. A autorização está distribuída
entre middlewares, services e repositories; a aplicação não possui um catálogo
central de permissões configuráveis por papel.

Não foi confirmado um caminho de escalada de privilégio ou acesso entre negócios
nos caminhos inspecionados. Foi confirmada uma divergência funcional com RN50:
o vínculo profissional inativo perde também o acesso operacional às reservas
existentes. A definição e implementação das permissões mínimas previstas nesse
requisito permanecem pendentes. Essa conclusão tem os limites descritos adiante.

## Escopo e requisitos

A inspeção abrangeu as declarações de rota de `src/routes`, os controles de sessão
e administração e os caminhos críticos de negócio, serviços, equipe, agenda,
atendimentos, conta, checkout, assinatura, notificações, favoritos e callbacks
OAuth. Foram revisados os filtros de identidade e negócio nos repositories
correspondentes e as constraints de papéis.

Fontes funcionais: `Agenda_Fashion_Requisitos_v1_17(1).docx` e
`Agenda_Fashion_Criterios_Aceitacao_v1_2(1).docx`, fornecidos para a auditoria.

| Contrato | Verificação relevante |
| --- | --- |
| RN25 | Níveis de autorização para ações administrativas sensíveis |
| RN48 | Uma identidade pode acumular contextos de cliente, profissional e proprietária |
| RN50 | Inatividade impede novas reservas e deve preservar permissões mínimas para reservas existentes |
| RN55 | Profissional ativa opera a própria disponibilidade e bloqueios; dona opera a equipe do próprio negócio |
| RN57 | Gestão administrativa do negócio, serviços, equipe e assinatura pertence à proprietária |
| RF52 | Seleção de contexto deve respeitar o vínculo e impedir acesso por vínculo removido ou negócio arquivado |
| CA-AG-16 | Profissional só reagenda a própria reserva, sem transferir responsabilidade |
| Critério de prontidão | Permissões verificadas no backend, independentemente da interface |

Este trabalho não altera os requisitos nem recalcula a baseline funcional `67/67`.

## Identidade e papéis

| Informação | Fonte de autoridade | Efeito |
| --- | --- | --- |
| Pessoa autenticada | JWT validado e estado de sessão em `authSessionRepository` | `auth` atribui somente `req.user.id`; verifica conta ativa, revogação e troca de senha |
| Dona / profissional | `usuarios_negocios.papel`, vínculo ativo e negócio ativo | Direitos limitados ao negócio e à ação desse vínculo |
| Admin / superadmin | `usuarios_administradores.papel` e registro ativo | `authAdmin` consulta o banco a cada requisição administrativa |
| Cliente | Identidade autenticada e propriedade da reserva / registros de cliente | Pode coexistir com os demais papéis; não é um terceiro valor de `usuarios_negocios.papel` |
| Visitante / cliente desativado | Capability específica de uma reserva | Acesso restrito àquela reserva, sem sessão administrativa ou de negócio |

As migrations [003](../database/migrations/003_usuarios_negocios.sql) e
[011](../database/migrations/011_usuarios_administradores.sql) restringem os
valores de papel no banco. A migration 011 migrou administradores legados de
`usuarios.tipo`; no runtime atual, esse campo não concede administração.

Uma conta com os dois vínculos pode atuar como dona no próprio negócio e como
profissional em outro. `X-AF-Contexto` escolhe o papel pretendido nos endpoints
compartilhados; o backend resolve o vínculo persistido correspondente. O header
não atribui papel nem autoriza um `negocio_id` arbitrário. Algumas leituras legadas
sem seletor explícito priorizam o negócio da dona, como documentado em
[contexto-negocio.md](./contexto-negocio.md).

## Matriz de acesso observada

Os direitos abaixo dependem de sessão válida e vínculo ativo quando aplicável.
Acumular um papel administrativo não concede automaticamente um vínculo de dona
ou profissional. As condições de estado e integridade continuam valendo após a
autorização por papel.

| Ação / API | Autorização | Escopo adicional | Controle principal |
| --- | --- | --- | --- |
| Criar negócio | Conta autenticada | Cria vínculo de dona para a própria identidade; valida capacidade de possuir negócio | `negocioController` / `negocioService` |
| Ler `/configuracoes` e `/servicos` | Vínculo de negócio ativo | Negócio derivado do vínculo; a leitura pode admitir profissional | `configuracoesService`, `servicosService` e respectivos repositories |
| Editar perfil, foto e publicação do negócio | Dona | Negócio derivado do vínculo, sem aceitar negócio-alvo do navegador | `configuracoesService` |
| Criar, editar, ativar ou remover serviço | Dona | Serviço deve pertencer ao mesmo negócio | `servicosService`, `servicoAtivacaoService`, `servicosRepository` |
| Gerir fotos / capa / galeria de serviço | Dona | Serviço e foto associados ao próprio negócio; leitura privada da galeria também exige dona | `servicosService` / `servicosRepository` |
| Gerir equipe e matriz profissional-serviço | Dona | Profissional e serviços pertencem à equipe do próprio negócio | `profissionaisService`, `profissionalServicosService` |
| Aceitar ou recusar convite | Conta destinatária autenticada | Convite destinado à identidade / contato validado; aceite revalida elegibilidade | `profissionaisService` |
| Ler / salvar disponibilidade | Dona ou profissional ativa | Profissional altera somente a própria; dona pode selecionar integrante ativo do mesmo negócio | `agendaVinculoAtivo`, `agendaConfiguracaoService` |
| Alterar política de cancelamento | Dona | Política do negócio; profissional não a altera ao salvar disponibilidade | `agendaConfiguracaoService` |
| Criar / remover bloqueio | Dona ou profissional ativa | Profissional opera a própria agenda; alvo da dona deve pertencer ao próprio negócio | `agendaVinculoAtivo`, `agendaService` |
| Ler agenda geral | Dona | Próprio negócio | `agendaService.buscarAgendaGeral` |
| Ler agenda profissional | Profissional ativa | Compromissos de outro negócio aparecem somente como ocupação redigida | `agendaProfissionalAtiva`, `agendaContextoRepository` |
| Cancelar ou reagendar operacionalmente | Dona ou profissional ativa | Profissional só atua na própria reserva; não transfere responsabilidade. Outro negócio não recebe a reserva | `agendamentoOperacionalAtivo`, services de cancelamento e reagendamento |
| Atualizar atendimento | Dona ou profissional ativa, conforme ação | Concluir atendimento exige ser a profissional responsável; estado e horário são revalidados | `agendamentoLifecycleService` |
| Consultar / cancelar reserva como cliente | Conta proprietária da reserva | Filtro por identidade do cliente; aplica política / estado da reserva | `agendamentoCancelamentoRepository` / `agendamentoCancelamentoService` |
| Operar checkout, assinatura ou renovação | Dona | Pagamento / assinatura do próprio negócio; regras financeiras validadas no backend | `checkoutService`, `checkoutRepository`, `assinaturaContaService` |
| Encerrar negócio | Dona | Próprio negócio e ausência de impedimentos; arquivamento inativa os vínculos | `encerramentoService` / `encerramentoRepository` |
| Editar conta, preferências, favoritos e notificações | Conta autenticada | Identidade vem de `req.user.id`; notificações e favoritos são filtrados pelo usuário | Services e repositories de conta, favoritos e notificações |
| Consultar administração e operar campanhas / mídia autorizadas | Admin ou superadmin | Permissão administrativa ativa, independentemente de vínculo com um negócio | `auth` + `authAdmin` |
| Consultar / revisar auditoria administrativa | Superadmin | Nível revalidado pelo service | `adminAuditService` |
| Escrever fontes, custos, cobertura e integrações de contribuição | Superadmin | Flag vem de `req.admin`, não do payload; tentativas registradas antes da escrita | Controllers de contribuição, `adminContributionOperationsService`, `contributionCostSyncService` |

## Fronteiras de segurança verificadas

- **Claims e payload:** a identidade operacional deriva da sessão. `auth` não
  copia claims de papel para `req.user`; controllers recebem identidade / nível
  administrativo de `req.user` e `req.admin`, mantendo dados do formulário em
  campos separados. O teste de administração rejeita o uso do legado
  `usuario.tipo` como autorização.
- **Isolamento:** configuração recorrente usa `profissional_id + negocio_id`;
  serviços e fotos são consultados pelo recurso e pelo negócio derivado do vínculo.
  A consulta de pagamento exige a dona correspondente. Notificações e favoritos
  usam a identidade autenticada na consulta ou atualização.
- **Responsabilidade:** os services rejeitam cancelamento / reagendamento de
  reserva atribuída a outra profissional. A conclusão de atendimento possui uma
  verificação adicional de profissional responsável.
- **Redação entre contextos:** a agenda profissional considera ocupação global
  para impedir dupla reserva; `agendaContextoRepository` remove identificação de
  reserva, negócio, cliente, telefone, serviço e valor de outro contexto.
- **Revogação:** novas requisições consultam sessão, conta e vínculo atuais.
  Remoção de vínculo não pode provocar fallback silencioso para o papel de dona.
  Esta auditoria não certifica revogação atômica durante uma operação já iniciada.
- **Auditoria administrativa:** rotas administrativas mutáveis registram tentativa
  antes do controller. Falha ao iniciar a auditoria impede a escrita. O POST de
  teste de acesso a provider é a exceção explícita de operação sem mutação de estado.

### Exceções que não são concessão de papel

| Caminho | Autoridade usada |
| --- | --- |
| Callbacks OAuth TikTok / Pinterest | `state` aleatório, hash persistido, expiração e consumo único; `adminAuditOAuthService` revalida o administrador do estado antes de executar a troca / gravação de credenciais |
| Reserva de visitante | Capability HMAC vinculada ao ID da reserva; os caminhos de visitante também restringem o tipo de reserva |
| Reserva de cliente desativado | Capability de acesso específico preservada pelo fluxo de encerramento; a conta desativada não recupera acesso geral |
| Webhooks Asaas / WhatsApp | Token / assinatura do provider nos middlewares próprios |
| Catálogo, planos públicos, cadastro, login e telemetria pública | APIs deliberadamente públicas ou com autenticação opcional, sem conceder administração |

As duas rotas OAuth de callback não usam `auth` / `authAdmin` diretamente.
Foram verificadas separadamente para evitar confundir esse desenho com uma rota
administrativa aberta. A revalidação do administrador está coberta por
[admin-audit-oauth-service.test.js](../tests/admin-audit-oauth-service.test.js).

## Achados e encaminhamentos

### RBAC-01 — Permissões mínimas de profissional inativa não estão implementadas

**Prioridade:** P2. **Categoria:** divergência funcional de autorização.
**Referência:** RN50. **Status na base auditada:** confirmada no seletor de acesso,
sem correção naquela auditoria. A evolução posterior está registrada no início
deste documento.

RN50 prevê que a profissional inativa preserve histórico e permissões mínimas
necessárias às reservas existentes. Os controles atuais de leitura de agenda e
de ação operacional exigem `un.ativo = TRUE`. Não foi localizado um caminho
específico que conceda essas permissões mínimas à profissional inativa responsável
por uma reserva já existente.

Evidência: [agendaContextoRepository.js](../src/repositories/agendaContextoRepository.js),
funções `buscarVinculoProfissionalAtivo` e
`buscarVinculoOperacionalDoAgendamento`, consumidas pelos middlewares de agenda.
[ciclo-atendimento.md](./ciclo-atendimento.md) também documenta a recusa de
vínculos inativos; portanto, existe uma divergência entre o contrato RN50 e a
implementação / documentação operacional atual.

Reprodução controlada: foram executados os SELECTs reais dessas funções em
SQLite em memória, com os placeholders adaptados e fixtures de conta / negócio
ativos e reserva confirmada. O teste muda apenas a atividade do vínculo da
profissional. Esse diagnóstico verifica o predicado de acesso; não substitui
uma execução HTTP com PostgreSQL.

| Vínculo da responsável | Contexto profissional | Contexto da reserva existente | Dona do negócio | Profissional de outro negócio |
| --- | --- | --- | --- | --- |
| Ativo | Permitido | Permitido | Permitido | Negado |
| Inativo | Negado | Negado | Permitido | Negado |

A reserva permanece sob gestão da dona. O achado não concede acesso indevido;
ele retira da profissional inativa todo o acesso operacional, incluindo o mínimo
previsto para reservas existentes.

Encaminhamento: definir quais ações de reserva permanecem permitidas após cada
tipo de inativação e implementar uma autorização restrita à reserva existente,
ao negócio e à responsável. Essa exceção deve preservar os bloqueios de novas
reservas, configuração de disponibilidade, equipe, serviços e assinatura.
Validar inativação manual, downgrade e espera de vaga, além de vínculo removido
e negócio arquivado, sem tratar todos esses estados como equivalentes.

### RBAC-02 — Consolidar regressão negativa da matriz de acesso

**Prioridade:** P3. **Categoria:** melhoria de cobertura. **Status:** recomendação.

Existem testes de negação por papel, responsável, negócio e nível administrativo.
Não foi localizado um teste único que percorra a matriz das rotas privadas e
verifique, para cada família de escrita, ausência de sessão, papel inadequado,
vínculo inativo, recurso de outro negócio e tentativa de forjar identidade / papel.
A autorização distribuída exige revisar o service e o repository além do middleware.

Encaminhamento: manter uma matriz de testes por família de recurso, com controles
de papel e propriedade, e uma verificação de novas rotas administrativas. As
exceções OAuth, capabilities e operação de teste de provider precisam permanecer
explícitas. A falta desse consolidado não foi tratada como prova de bypass.

## Validação e limites

| Evidência | Resultado | Alcance |
| --- | --- | --- |
| Inventário estático de rotas | 145 declarações em 24 módulos; 113 com `auth`, das quais 39 com `authAdmin` | Presença de guards e exceções; não mede cobertura de cenários de autorização |
| Jest com configuração do repositório, sem cenários que exigem PostgreSQL real | 24 suítes, 174 testes passaram | Middleware, service, controller e repositories com doubles, conforme cada suíte |
| `admin-contribution-cost-sync.test.js` | 1 suíte, 4 testes passaram com double explícito do repository de auditoria | Controllers encaminham nível resolvido no backend; não valida persistência real da auditoria |
| Diagnóstico dos SELECTs de vínculo | Resultado da tabela RBAC-01 | SQL de seleção em SQLite em memória, não integração PostgreSQL |
| CI da base auditada | Backend, frontend, E2E, Quality Gate e CodeQL aprovados no PR #387 | Evidência anterior das suítes existentes, incluindo PostgreSQL; não cobre um cenário novo de RN50 |

Total local aprovado: **178 testes em 25 suítes**, contando as duas execuções
distintas da tabela. Esses números incluem testes funcionais adjacentes e não
representam 178 cenários exclusivos de RBAC nem uma porcentagem de segurança.

Na primeira tentativa de `admin-contribution-cost-sync.test.js`, três escritas
retornaram 503 porque o middleware real tentou persistir auditoria sem um banco
local disponível. O rerun com double explícito passou. O comportamento observado
é de impedir a ação quando a auditoria não pode iniciar.

Os três cenários de `cliente-agendamentos.test.js` falharam no setup por
`ECONNREFUSED 127.0.0.1:5432`, antes de exercer suas asserções. Eles não foram
contados como aprovação local. Suites de integração com PostgreSQL foram
inspecionadas e possuem a evidência de CI abaixo, mas não foram reexecutadas
localmente. Nenhuma requisição de auditoria foi enviada à produção.

CI de referência: [PR #387](https://github.com/Tivytinz/agenda-fashion/pull/387),
[Backend CI](https://github.com/Tivytinz/agenda-fashion/actions/runs/38439219463)
e [Security CI](https://github.com/Tivytinz/agenda-fashion/actions/runs/38439219446).
O conteúdo de backend da base auditada corresponde ao conteúdo validado nesse PR.

### Suítes locais usadas

| Área | Arquivos em `tests/` |
| --- | --- |
| Sessão e administração | `auth-admin.test.js`, `auth-session-hardening.test.js`, `sessao-contextos.test.js`, `sessao-admin-context.test.js` |
| Agenda e responsável | `agenda-vinculo-contexto-middleware.test.js`, `agenda-configuracao-hardening.test.js`, `agenda-seguranca-unit.test.js`, `agendamentoCancelamentoService.test.js`, `agendamentoReagendamentoService.test.js`, `agendamentoVisitante.test.js` |
| Administração e auditoria | `admin-audit-service.test.js`, `admin-audit-routes.test.js`, `admin-audit-route-coverage.test.js`, `admin-operation-routes.test.js`, `admin-contribution-operations-service.test.js`, `admin-contribution-cost-sync.test.js` |
| OAuth | `admin-audit-oauth-service.test.js`, `tiktok-marketing-oauth-service.test.js`, `pinterest-marketing-oauth-service.test.js` |
| Negócio e conta | `configuracoes.test.js`, `servicos.test.js`, `servicos-edicao-completa.test.js`, `checkout-idempotencia.test.js`, `assinatura-conta-service.test.js`, `favoritos.test.js` |

Exemplos de evidência de integração existente:
[agenda-profissional-autorizacao-integracao.test.js](../tests/agenda-profissional-autorizacao-integracao.test.js),
[agenda-configuracao-equipe-rota.integration.test.js](../tests/agenda-configuracao-equipe-rota.integration.test.js),
[agendamento-cancelamento-operacional.test.js](../tests/agendamento-cancelamento-operacional.test.js),
[profissional-servicos-integracao.test.js](../tests/profissional-servicos-integracao.test.js)
e [admin-audit.integration.test.js](../tests/admin-audit.integration.test.js).

## Inventário por módulo

Contagem de declarações método / caminho em `src/routes`, incluindo aliases
declarados em arrays. Exclui o agregador `index.js`, assets, páginas estáticas,
healthchecks e infraestrutura registrada fora desses módulos. A coluna `auth`
conta autenticação obrigatória; autenticação opcional, capability e autenticação
de provider estão classificadas nas exceções acima.

| Módulo | Declarações | `auth` | `authAdmin` |
| --- | ---: | ---: | ---: |
| `adminAnalyticsV2Routes.js` | 1 | 1 | 1 |
| `adminRoutes.js` | 40 | 38 | 38 |
| `agendaConfiguracaoRoutes.js` | 3 | 3 | 0 |
| `agendaPublicaRoutes.js` | 10 | 3 | 0 |
| `agendaRoutes.js` | 8 | 8 | 0 |
| `analyticsV2Routes.js` | 1 | 0 | 0 |
| `assinaturaRoutes.js` | 3 | 3 | 0 |
| `authRoutes.js` | 8 | 1 | 0 |
| `checkoutRoutes.js` | 2 | 2 | 0 |
| `configuracoesRoutes.js` | 5 | 5 | 0 |
| `contaRoutes.js` | 8 | 8 | 0 |
| `dashboardRoutes.js` | 5 | 5 | 0 |
| `eventoProdutoRoutes.js` | 1 | 0 | 0 |
| `favoritosRoutes.js` | 4 | 4 | 0 |
| `googleMeasurementRoutes.js` | 2 | 1 | 0 |
| `metaAdsRoutes.js` | 2 | 1 | 0 |
| `negocioRoutes.js` | 5 | 5 | 0 |
| `notificacoesRoutes.js` | 2 | 2 | 0 |
| `perfilNegocioRoutes.js` | 8 | 0 | 0 |
| `planosRoutes.js` | 2 | 1 | 0 |
| `profissionaisRoutes.js` | 11 | 11 | 0 |
| `servicosRoutes.js` | 10 | 10 | 0 |
| `sessaoRoutes.js` | 1 | 1 | 0 |
| `webhookRoutes.js` | 3 | 0 | 0 |
| **Total** | **145** | **113** | **39** |
