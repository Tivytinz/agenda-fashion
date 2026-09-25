# Mapa de telas e jornadas do frontend — Agenda Fashion

> **Papel documental:** inventário técnico especializado das rotas, telas e
> transições de UX implementadas no frontend.
>
> Este documento não redefine regras de produto. Para cada jornada, a regra
> canônica continua no documento de domínio correspondente. A arquitetura técnica
> geral do frontend fica em [`frontend-arquitetura.md`](./frontend-arquitetura.md).

## 1. Objetivo

Este mapa responde, para uma mudança de frontend:

1. qual rota e página participam da tarefa;
2. qual contexto visual deve renderizar a tela;
3. qual gate de navegação existe no React;
4. quais telas vêm antes e depois no fluxo;
5. qual documento de domínio deve ser consultado antes de alterar comportamento.

O mapa é derivado de `src/config/reactRoutes.json`,
`frontend/src/App.jsx`, dos shells atuais e dos documentos canônicos do
repositório.

## 2. Legenda dos contextos

| Contexto | Shell/composição |
| --- | --- |
| Público/cliente | `PublicShell` |
| Dona | `WorkspaceLayout → OwnerShell` |
| Profissional | `WorkspaceLayout → ProfessionalShell` |
| Admin | `AdminLayout → AdminShell` |
| Dinâmico | contexto escolhido pela sessão e rota |

`ProtectedRoute` é um gate de navegação. Ele não substitui autorização do
backend.

## 3. Inventário de rotas públicas e de cliente

| Rota | Página | Proteção React | Contexto | Responsabilidade principal |
| --- | --- | --- | --- | --- |
| `/` | `HomePage` | pública | Público | entrada, descoberta e navegação para oferta |
| `/para-profissionais` | `ProfessionalLandingPage` | pública | Público | aquisição e apresentação da proposta para profissionais |
| `/servicos/:categoria/em/:localidade` | `LocalCatalogPage` | pública | Público | catálogo local por categoria/localidade |
| `/negocio/:slug` | `ProfilePage` | pública | Público | perfil público, serviços e início de booking |
| `/confirmar` | `ConfirmPage` | pública | Público | confirmação dos dados antes da criação do booking |
| `/sucesso` | `SuccessPage` | pública | Público | conclusão do booking e próximos passos |
| `/minha-agenda` | `MyAppointmentsPage` | pública no router | Público | histórico/agenda da cliente, com comportamento conforme identidade disponível |
| `/agendamento-acesso/:id` | `InactiveBookingAccessPage` | pública | Público | acesso específico a booking em cenário de conta inativa |
| `/agendamento-visitante/:id` | `GuestBookingAccessPage` | pública | Público | consulta/cancelamento por capability de visitante |
| `/favoritos` | `FavoritesPage` | autenticada | Público | favoritos da cliente |
| `/planos` | `PlansPage` | pública | Público | catálogo de planos e entrada de intenção de upgrade |
| `/privacidade` | `PrivacyPage` | pública | Público | política de privacidade |
| `/termos` | `TermsPage` | pública | Público | termos de uso |

### Contratos importantes

- perfil publicado pode permanecer acessível sem serviço ativo, mas não deve
  permitir novo booking de oferta inativa;
- ausência de slot mantém oferta visível e bloqueia confirmação;
- cliente autenticada pode reaproveitar dados persistidos da própria conta na
  confirmação;
- visitante informa seus dados e usa capability limitada ao próprio booking;
- disponibilidade e elegibilidade são recalculadas no backend antes da criação.

Fonte de domínio:
[`public-shell.md`](./public-shell.md),
[`agendamento-integridade.md`](./agendamento-integridade.md) e
[`ciclo-atendimento.md`](./ciclo-atendimento.md).

## 4. Autenticação e recuperação de acesso

| Rota | Página | Contexto | Papel no fluxo |
| --- | --- | --- | --- |
| `/entrar` | `AuthPage` | Público | login |
| `/cadastro` | `AuthPage mode="register"` | Público | criação de conta |
| `/esqueci-senha` | `PasswordResetPage` | Público | solicitação de recuperação |
| `/redefinir-senha` | `PasswordResetPage mode="reset"` | Público | definição da nova senha |
| `/conta` | `AccountPage` | Dinâmico | perfil/conta conforme contexto da sessão |

### Resolução especial de `/conta`

`AccountRoute` resolve a composição desta forma:

```text
ehAdministrador
  → AdminLayout + AccountPage

senão, temNegocio
  → WorkspaceLayout + AccountPage

senão
  → AccountPage no contexto público
```

Essa resolução visual não altera as permissões persistidas.

Fonte de domínio:
[`session-security.md`](./session-security.md) e
[`ux-contextos-visuais.md`](./ux-contextos-visuais.md).

## 5. Primeira jornada profissional

### Fluxo principal

```text
/para-profissionais
  → /cadastro?tipo=profissional
  → /criar-negocio
  → /painel/servicos/novo?onboarding=servico
  → publicação automática confirmada pelo backend
  → /painel/horarios
  → /painel
      ou
    /checkout quando existe intenção válida de plano pago
```

O contrato canônico é:

```text
conta
  → negócio completo
  → primeiro serviço
  → publicação automática
  → confirmação rápida de horários
  → compartilhar perfil / checkout
  → primeiro agendamento válido
```

### Telas envolvidas

| Etapa | Rota | Página | Gate |
| --- | --- | --- | --- |
| aquisição | `/para-profissionais` | `ProfessionalLandingPage` | pública |
| conta | `/cadastro` | `AuthPage` | pública |
| negócio | `/criar-negocio` | `BusinessPage create` | autenticada |
| primeiro serviço | `/painel/servicos/novo` | `ServiceEditorPage` | dona + negócio |
| horários | `/painel/horarios` | `ScheduleSettingsPage` | dona + negócio |
| missão pós-publicação | `/painel` | `DashboardPage` | dona + negócio |
| plano pago opcional | `/checkout` | `BillingCheckoutPage` | dona + negócio publicado |

### Invariantes de UX

- apenas `Negócio` e `Serviço` preparam a publicação;
- `Horários` aparece depois que o backend já confirmou a publicação;
- horário não volta a ser gate de publicação;
- `Confirmar horários` e `Pular por agora` persistem a sugestão atual;
- falha ao salvar horários impede avanço;
- intenção de plano pode atravessar Negócio → Serviço → Horários, mas checkout só
  entra depois da passagem pela agenda e continua revalidado pelo backend;
- a missão pós-publicação prioriza divulgação e primeiro booking antes de
  métricas sem amostra suficiente.

Fonte canônica:
[`ativacao-profissional-ux.md`](./ativacao-profissional-ux.md) e
[`ativacao-proxima-acao.md`](./ativacao-proxima-acao.md).

## 6. Workspace da dona

Rotas de gestão usam `WorkspaceLayout`, que resolve `OwnerShell` quando o
vínculo atual possui `papel === "dono"`.

| Rota | Página | Responsabilidade |
| --- | --- | --- |
| `/painel` | `DashboardPage` | visão geral, próxima ação e crescimento |
| `/painel/agenda` | `AgendaWorkspacePage owner` | operação da agenda do negócio |
| `/painel/servicos` | `ServicesPage` | catálogo e gestão de serviços |
| `/painel/servicos/novo` | `ServiceEditorPage` | criação de serviço |
| `/painel/servicos/:id/editar` | `ServiceEditorPage` | edição de serviço |
| `/painel/horarios` | `ScheduleSettingsPage` | disponibilidade da dona/contexto atual |
| `/painel/profissionais` | `ProfessionalsPage` | equipe, convites e elegibilidade de serviços |
| `/painel/negocio` | `BusinessPage` | dados e publicação do negócio |
| `/painel/assinatura` | `SubscriptionPage` | plano atual, uso e lifecycle financeiro |
| `/conta` | `AccountPage` | conta da pessoa dentro do shell da dona |

Todas as rotas de `/painel/*` listadas acima exigem contexto de negócio; as
rotas de gestão da dona usam também `ownerOnly`.

Fontes de domínio variam por módulo:

- ativação/publicação:
  [`ativacao-profissional-ux.md`](./ativacao-profissional-ux.md);
- agenda:
  [`ciclo-atendimento.md`](./ciclo-atendimento.md);
- equipe:
  [`convites-profissionais.md`](./convites-profissionais.md);
- plano:
  [`planos.md`](./planos.md).

## 7. Agenda operacional

`AgendaWorkspacePage` é compartilhada por dois contextos:

```text
/painel/agenda
  → dona
  → <AgendaWorkspacePage owner />

/profissional/agenda
  → profissional
  → <AgendaWorkspacePage />
```

A UI pode diferenciar ações disponíveis, mas o backend continua decidindo
escopo, atribuição e transições permitidas.

Estados persistidos relevantes:

- `agendado`;
- `confirmado`;
- `cancelado`;
- `realizado`;
- `falta`.

O início real do atendimento é um marco separado e não cria um sexto status.

A tela operacional deve respeitar, entre outras, estas regras:

- falta somente depois da tolerância de 15 minutos;
- realizado somente conforme regra temporal e autorização;
- cancelamento operacional possui fluxo próprio;
- reagendamento usa operação própria e não é troca de status;
- estado terminal não pode ser reescrito para outro terminal;
- frontend pode esconder ações inviáveis, mas não é autoridade para autorizá-las.

Fonte canônica:
[`ciclo-atendimento.md`](./ciclo-atendimento.md).

## 8. Workspace profissional

As rotas `/profissional/*` passam por `WorkspaceLayout` e devem resolver
`ProfessionalShell` para um vínculo profissional válido.

| Rota | Página | Responsabilidade |
| --- | --- | --- |
| `/profissional/agenda` | `AgendaWorkspacePage` | agenda individual |
| `/profissional/horarios` | `ScheduleSettingsPage` | horários do vínculo profissional |
| `/conta` | `AccountPage` | conta da pessoa no contexto do workspace |

A navegação do `ProfessionalShell` também oferece `/convites`, mas a rota de
convites é montada fora do `WorkspaceLayout` no router atual. Portanto, ao
entrar em `/convites`, a página é uma tela autenticada de transição e não uma
subrota `/profissional/*`.

Esse detalhe deve ser considerado antes de mover a rota ou alterar seu shell,
pois muda composição visual sem mudar a regra de convite.

## 9. Convites e equipe

### Dona

```text
/painel/profissionais
  → localizar conta por identificador permitido
  → enviar convite
  → acompanhar equipe
  → ativar explicitamente vínculo aguardando vaga quando houver capacidade
```

### Profissional convidada

```text
/convites
  → listar convites próprios
  → aceitar ou recusar
  → refresh de /minha-sessao
  → workspace somente quando vínculo ativo estiver permitido
```

A rota `/convites` exige autenticação, mas não exige negócio existente. Isso é
necessário para uma pessoa aceitar convite antes de possuir outro contexto de
negócio.

Sem capacidade do plano, aceite não permanece pendente: o vínculo pode ficar
inativo com estado de espera, sem liberar workspace.

Fonte especializada:
[`convites-profissionais.md`](./convites-profissionais.md).

## 10. Configuração de horários

A mesma `ScheduleSettingsPage` atende dona e profissional, com contexto
resolvido pela rota/sessão.

```text
/painel/horarios
/profissional/horarios
```

Na primeira jornada da dona, a tela também participa da confirmação rápida da
disponibilidade sugerida.

Requisitos de UX:

- dias ativos e fechados precisam ser distinguíveis;
- horários de início/fim e pausa devem permanecer legíveis;
- composição mobile não deve exigir scroll horizontal desnecessário;
- salvar precisa permanecer acessível;
- customização de horário não é gate de publicação.

Fonte canônica:
[`ativacao-profissional-ux.md`](./ativacao-profissional-ux.md) e
[`ux-contextos-visuais.md`](./ux-contextos-visuais.md).

## 11. Serviços e oferta

O módulo da dona usa um arquivo de página compartilhado para lista e editor:

```text
ServicesPage.jsx
├── ServicesPage
└── ServiceEditorPage
```

Rotas:

```text
/painel/servicos
/painel/servicos/novo
/painel/servicos/:id/editar
```

Na primeira ativação, o editor recebe o marcador navegável
`?onboarding=servico`.

A criação do primeiro serviço ativo participa da publicação automática. Depois
da primeira publicação válida, desativar o último serviço não deve ser
interpretado pela UI como autorização para criar bookings sem oferta ativa.

A matriz profissional↔serviço é administrada no contexto da equipe e continua
backend-authoritative.

Fonte canônica:
[`ativacao-profissional-ux.md`](./ativacao-profissional-ux.md) e
[`agendamento-integridade.md`](./agendamento-integridade.md).

## 12. Monetização e assinatura

### Entrada pública

```text
/planos
```

é pública e pode registrar intenção de plano.

### Checkout

```text
/checkout
```

é protegido por:

- autenticação;
- `ownerOnly`;
- `businessRequired`;
- `publishedBusinessRequired`.

O gate React melhora a navegação; o backend revalida todas as condições.

### Gestão da assinatura

```text
/painel/assinatura
```

usa `SubscriptionPage`.

Contratos críticos da UX financeira:

- plano gratuito não exige checkout;
- checkout iniciado não é pagamento confirmado;
- retorno do navegador não ativa plano;
- PIX pendente não substitui visualmente o entitlement vigente;
- renovação cancelada mantém acesso até o fim do período pago;
- atraso recuperável, estorno/disputa e checkout expirado são situações
  distintas;
- CTA de regularização só deve aparecer quando o estado realmente permite;
- benefícios e limites continuam determinados pelo backend.

Fonte canônica:
[`planos.md`](./planos.md) e documentos financeiros especializados.

## 13. Administração

Todas as rotas administrativas passam por:

```text
ProtectedRoute adminOnly
  → AdminLayout
      → AdminShell
```

| Rota | Página |
| --- | --- |
| `/admin` | `AdminOverviewV2Page` |
| `/admin/aquisicao` | `AdminAcquisitionV2Page` |
| `/admin/jornada` | `AdminJourneyV2Page` |
| `/admin/retencao` | `AdminRetentionV2Page` |
| `/admin/receita` | `AdminRevenueV2Page` |
| `/admin/operacao` | `AdminOperationPage` |
| `/admin/auditoria` | `AdminAuditPage` |
| `/admin/trafego-pago` | `AdminMarketingPage` |
| `/admin/trafego-pago/custos` | `AdminMarketingCostsPage` |
| `/admin/trafego-pago/profissionais` | `AdminAcquisitionV2Page` por compatibilidade |
| `/admin/saude` | `AdminSaasHealthPage` |
| `/admin/whatsapp` | `AdminWhatsAppPage` |

Admin possui documentação própria; este mapa não redefine métricas, semântica ou
permissões administrativas.

Fonte canônica:
[`admin-console.md`](./admin-console.md).

## 14. Jornada pública de booking

O caminho principal de conversão da cliente é:

```text
descoberta
  → perfil público
  → serviço
  → profissional quando necessário
  → data
  → horário
  → confirmação
  → booking criado
  → sucesso
  → gestão posterior pela cliente/visitante
```

Mapeamento aproximado de tela:

```text
HomePage / LocalCatalogPage
  → ProfilePage
      → fluxo de BookingFlow dentro do perfil
          → ConfirmPage
              → SuccessPage
                  → MyAppointmentsPage
                     ou GuestBookingAccessPage
```

Quando só existe uma profissional elegível, a UX pode pular escolha redundante.
Quando não há slot, não deve liberar confirmação.

A criação final continua sujeita à disponibilidade e concorrência validadas no
backend.

## 15. Pós-booking da cliente

### Cliente autenticada

A experiência principal está em `/minha-agenda`.

A interface pode apresentar ações conforme estado persistido, incluindo
cancelamento permitido e avaliação de atendimento realizado.

Avaliação só fica disponível para `status = realizado`; horário passado não é
prova de atendimento.

### Visitante

O link seguro usa `/agendamento-visitante/:id` com capability no fragmento.
Esse acesso não cria sessão, não amplia acesso e não remove cutoff de
cancelamento.

Fonte canônica:
[`ciclo-atendimento.md`](./ciclo-atendimento.md) e
[`cancelamento-agendamento-visitante.md`](./cancelamento-agendamento-visitante.md).

## 16. Estados mínimos por tipo de tela

### Lista/carregamento remoto

```text
loading
  → itens
  → vazio
  → erro + retry quando possível
```

### Mutação

```text
idle
  → submitting
  → sucesso/transição
  → erro recuperável
```

### Sessão protegida

```text
session loading
  → autenticada + autorizada na UX
  → login
  → redirecionamento por contexto
```

### Dados que mudam em background

Quando a tela permite retry ou refresh, preservar os dados anteriores durante
revalidação é preferível a apagar toda a interface se isso não induzir a pessoa
a executar ação sobre informação obsoleta.

A escolha concreta depende do risco da operação.

## 17. Navegação e retorno

Mudanças em jornada devem preservar intenção quando ela já faz parte do
contrato.

Exemplos implementados:

- `ProtectedRoute` pode guardar `state.from` para login;
- intenção de plano pode ser carregada durante a primeira jornada;
- `?onboarding=servico` é marcador navegável da primeira missão de serviço;
- links públicos compartilháveis devem usar os mecanismos rastreáveis existentes.

Não depender exclusivamente de state transitório do React Router quando refresh
ou reabertura do link precisa preservar o passo.

## 18. Matriz de ownership por mudança

| Mudança desejada | Ver primeiro |
| --- | --- |
| criar/mover rota | `reactRoutes.json` + `App.jsx` |
| alterar contexto/shell | `WorkspaceLayout`, shells e `ux-contextos-visuais.md` |
| autenticação/sessão | `auth/` + `session-security.md` |
| chamada HTTP | `api/client.js` + endpoint backend |
| booking | `ProfilePage` / `BookingFlow` + docs de agendamento |
| onboarding | `BusinessPage`, `ServicesPage`, `ScheduleSettingsPage`, `DashboardPage` |
| equipe | `ProfessionalsPage`, `ProfessionalInvitesPage`, `convites-profissionais.md` |
| plano/checkout | `PlansPage`, `BillingPages`, `SubscriptionPage`, `planos.md` |
| componentes/primitives | `frontend-componentes-primitives.md` + implementação atual |
| formulários/estado/API | `frontend-formularios-estado-api.md` + endpoint/backend correspondente |
| analytics/observabilidade | `frontend-analytics-observabilidade.md` + contrato backend de eventos |
| segurança frontend | `frontend-seguranca.md` + `session-security.md` + autorização backend |
| entrega/runtime/SEO | `frontend-entrega-runtime.md` + Vite/Express + testes HTTP |
| QA/prontidão | `frontend-qa-prontidao.md` + testes da jornada |
| CSS | `frontend-estilos.md` + dono do estilo |
| Admin | docs `admin-*` + páginas administrativas |
| analytics | `analytics/` + documentação de atribuição/growth |

## 19. Checklist de revisão de uma jornada

Antes de considerar uma alteração de UX concluída:

1. confirmar que rota, shell e papel estão coerentes;
2. verificar a regra real no backend antes de alterar decisão do frontend;
3. testar loading, vazio, erro, sucesso e sessão expirada aplicáveis;
4. validar retorno/refresh quando a jornada possui estado navegável;
5. confirmar que a ação principal não fica encoberta no mobile;
6. testar WebKit quando houver sticky, fixed, blur, safe-area ou overflow;
7. verificar foco, rótulos e teclado;
8. preservar analytics do funil sem promover clique a fato transacional;
9. adicionar ou atualizar teste de regressão proporcional ao risco;
10. atualizar a documentação canônica se a regra de produto tiver mudado.

## 20. Manutenção

Atualizar este mapa quando:

- uma rota for criada, removida ou mudar de página;
- um shell/contexto mudar;
- um gate de navegação mudar;
- uma jornada ganhar ou perder uma etapa visível relevante;
- uma página assumir responsabilidade diferente de forma durável.

Alterações cosméticas locais não exigem atualização deste inventário.
