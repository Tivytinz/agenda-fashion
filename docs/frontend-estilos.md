# Arquitetura de estilos do frontend

Este documento registra a direção adotada para evoluir o CSS do Agenda Fashion sem introduzir uma nova biblioteca visual ou reescrever o frontend.

## Princípios

1. A experiência pública e a área profissional preservam a identidade visual do Agenda Fashion.
2. O administrativo interno usa linguagem neutra, densa e operacional.
3. CSS global deve conter apenas fundações realmente compartilhadas.
4. Estilos específicos de uma feature não devem ser carregados globalmente quando a feature vive em rotas próprias.
5. Componentes dentro de workspaces com sidebar devem responder à largura real do container. `container queries` são preferíveis a aumentar breakpoints da viewport apenas para esconder overflow.
6. `media queries` continuam válidas para necessidades da viewport, mobile, safe areas e orientação.
7. Não criar novas camadas de versão como `v4`, `v5` ou equivalentes.
8. O shell administrativo fornece tokens e estrutura; cada feature é responsável por aplicar esses tokens aos próprios componentes.

## Marketing administrativo

A consolidação das antigas camadas `admin-marketing-professional.css`, `admin-marketing-v2.css` e `admin-marketing-v3.css` foi concluída sob uma única entrada canônica: `frontend/src/styles/admin-marketing.css`.

Os módulos internos ficam em `frontend/src/styles/admin-marketing/` e são organizados por responsabilidade:

- `campaigns-mobile.css`: UX específica das campanhas em telas estreitas, antes carregada diretamente pelo HTML;
- `core.css`: fundações compartilhadas das telas administrativas de Marketing;
- `reporting.css`: relatórios, custos, funil, gráficos e tabelas;
- `command.css`: visão geral, sincronização, campanhas e GA4;
- `overview.css`: jornada, confiabilidade, refinamentos do overview e responsividade baseada em container;
- `theme.css`: aplicação dos tokens neutros do console administrativo à feature.

O restante da aplicação importa somente `admin-marketing.css`. Os módulos internos não são entradas públicas da feature.

Os nomes internos antigos de alguns seletores e custom properties podem permanecer temporariamente como compatibilidade de markup, mas não representam novas camadas arquiteturais e não devem ser usados em código novo. A evolução deve convergir para nomes semânticos quando esses componentes forem tocados.

`admin-shell.css` não contém mais seletores específicos de Marketing. Ele é responsável por sidebar, header, footer, superfícies, controles e tokens do console.

As três rotas administrativas de Marketing carregam `admin-marketing.css` no mesmo `Promise` usado pelo `React.lazy`. Assim, página e estilos são resolvidos juntos antes da renderização da rota; o `AdminLayout` não baixa CSS de feature por `useEffect`.

A folha mobile de campanhas também deixou de ser referenciada diretamente por `frontend/index.html`, evitando carregar CSS administrativo na experiência pública ou profissional.

## Estilos específicos das rotas

Páginas já carregadas por `React.lazy` devem manter seus refinamentos visuais fora de `main.jsx` quando o ownership do CSS for exclusivo daquela feature. O carregamento do estilo deve acontecer junto da mesma rota, antes da renderização da página, evitando tanto CSS global desnecessário quanto flash de conteúdo sem estilo.

O primeiro grupo migrado segue esse padrão:

- `DashboardPage`: `dashboard-polish.css`;
- `AgendaWorkspacePage`: `agenda-polish.css`;
- `ScheduleSettingsPage`: `schedule-polish.css`;
- `ServicesPage` e `ServiceEditorPage`: `service-media-polish.css` e `service-catalog-polish.css`;
- `BusinessPage`: `business-polish.css`;
- `SubscriptionPage`: `subscription-polish.css`;
- `PlansPage`: `plans-polish.css`.

Esses estilos são carregados pelo mesmo helper `lazyNamedWithStyles` usado pelo Marketing administrativo. O Vite pode então associar os recursos ao carregamento das rotas correspondentes, enquanto `main.jsx` permanece responsável apenas por fundações e estilos realmente compartilhados.

Não mover um arquivo apenas pelo nome. Antes é obrigatório verificar seletores compartilhados, componentes usados em mais de uma rota e a ordem da cascata. Por isso `home-discovery.css`, `profile-polish.css`, `account-polish.css`, `admin-saas-health.css` e `admin-whatsapp.css` permanecem globais nesta etapa: eles ainda atravessam header global, confirmação de agendamento, conta em múltiplos shells ou o tema administrativo e exigem auditoria própria antes de qualquer isolamento.

O teste `tests/frontend-route-css-regressoes.test.js` protege esse ownership: estilos já migrados não podem voltar para `main.jsx`, e suas páginas devem continuar usando carregamento lazy sincronizado com o CSS.

## Responsividade do admin

O workspace administrativo possui sidebar fixa em desktop, portanto a largura útil de uma página é menor que a viewport. O Marketing define `admin-marketing-page` como container inline e reorganiza o cabeçalho conforme esse espaço real.

A regressão de overflow é protegida em 1024, 1280 e 1366 px, em Chromium e WebKit. A cobertura mobile existente permanece obrigatória.

## Critério de manutenção

Antes de adicionar CSS novo:

- identificar o dono do estilo: base, shell ou feature;
- reutilizar tokens do contexto quando aplicável;
- evitar sobrescrever uma regra antiga se ela puder ser substituída com segurança;
- não criar uma nova geração `vN` para corrigir outra geração;
- manter uma entrada canônica por feature e módulos internos com nomes de responsabilidade;
- carregar CSS exclusivo junto da rota lazy correspondente, em vez de adicioná-lo à entrada global;
- testar faixas intermediárias de largura, não apenas celular e desktop grande.
