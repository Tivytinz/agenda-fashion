# Arquitetura do frontend — Agenda Fashion

> **Papel documental:** referência técnica para a implementação do frontend React do Agenda Fashion.
>
> A semântica dos contextos visuais permanece em
> [`ux-contextos-visuais.md`](./ux-contextos-visuais.md), o ownership de CSS em
> [`frontend-estilos.md`](./frontend-estilos.md) e a experiência pública em
> [`public-shell.md`](./public-shell.md). Regras de produto continuam nos
> documentos canônicos de cada domínio e em `AGENTS.md`.

## 1. Objetivo e fonte de verdade

Este documento explica como o frontend atual é organizado e quais contratos
técnicos devem ser preservados ao evoluir páginas, componentes, navegação,
sessão, estados assíncronos, estilos, analytics e testes.

A ordem de precedência do repositório continua sendo:

1. código executável e migrations representam o estado implementado;
2. testes representam o comportamento esperado;
3. `AGENTS.md` e `docs/` representam decisões, regras e intenção do produto.

Este arquivo não transforma uma decisão de apresentação em regra de segurança e
não redefine regras de negócio que pertencem ao backend.

## 2. Stack atual

O frontend está em `frontend/` e usa:

| Área | Implementação atual |
| --- | --- |
| UI | React 19 |
| Roteamento | React Router 7 |
| Build/dev server | Vite 7 |
| Estilos | CSS organizado por fundação, shell e feature |
| Testes de componente/unidade | Vitest + Testing Library |
| E2E | Playwright |
| Qualidade estática | ESLint + Knip |
| Analytics no navegador | camada própria em `src/analytics/` + integrações permitidas |

Não existe uma aplicação separada para cliente, profissional, dona ou Admin.
Esses são contextos da mesma SPA React.

## 3. Estrutura principal

A estrutura relevante é:

```text
frontend/
├── e2e/
├── public/
├── scripts/
├── src/
│   ├── analytics/
│   ├── api/
│   ├── assets/
│   ├── auth/
│   ├── components/
│   ├── config/
│   ├── hooks/
│   ├── pages/
│   ├── styles/
│   ├── utils/
│   ├── App.jsx
│   └── main.jsx
├── eslint.config.js
├── knip.json
├── package.json
├── playwright.config.js
└── vite.config.js
```

Responsabilidades gerais:

- `pages/`: composição de telas, carregamento de dados e fluxos de feature;
- `components/`: componentes reutilizáveis, shells, primitives e partes de
  telas extraídas quando isso melhora clareza e teste;
- `api/`: primitive HTTP compartilhada;
- `auth/`: sessão, resolução de contexto e proteção de rotas;
- `analytics/`: telemetria comportamental e bridges de marketing permitidas;
- `utils/`: lógica reutilizável que não pertence a um componente;
- `styles/`: fundações, design systems contextuais e refinamentos de feature;
- `assets/`: recursos visuais versionados junto do frontend.

A extração de código deve resolver um problema de ownership, teste ou
reutilização. Criar arquivos apenas para aumentar granularidade não é objetivo.

## 4. Bootstrap da aplicação

O ponto de entrada é `frontend/src/main.jsx`.

A composição atual é:

```text
createRoot
  └─ StrictMode
      └─ ErrorBoundary
          └─ BrowserRouter
              └─ SessionProvider
                  └─ PublicShell
                      └─ App
```

Consequências desse desenho:

- `BrowserRouter` existe antes de sessão e shells, portanto esses componentes
  podem resolver contexto pela rota;
- `SessionProvider` é a fonte React compartilhada da sessão carregada;
- `PublicShell` decide se a composição visual pública deve estar ativa;
- `ErrorBoundary` protege falhas de renderização no topo da árvore;
- `App.jsx` concentra a composição das rotas e o lazy loading principal.

`main.jsx` também instala a recuperação de runtime e importa as fundações CSS
realmente globais. CSS específico de shell ou feature deve preferir carregamento
contextual quando já existe ownership claro.

## 5. Roteamento

Os caminhos React são centralizados em `src/config/reactRoutes.json` na raiz do
repositório e consumidos por `frontend/src/App.jsx`.

Os grupos principais são:

### Público e cliente

```text
/
├── /para-profissionais
├── /servicos/:categoria/em/:localidade
├── /negocio/:slug
├── /confirmar
├── /sucesso
├── /minha-agenda
├── /favoritos
├── /conta
├── /entrar
├── /cadastro
├── /esqueci-senha
├── /redefinir-senha
├── /privacidade
└── /termos
```

Também existem rotas específicas para acesso seguro a agendamentos de visitante
e conta inativa.

### Dona do negócio

```text
/painel
├── /painel/agenda
├── /painel/servicos
├── /painel/servicos/novo
├── /painel/servicos/:id/editar
├── /painel/profissionais
├── /painel/horarios
├── /painel/negocio
└── /painel/assinatura
```

### Profissional

```text
/profissional/agenda
/profissional/horarios
/convites
/conta
```

### Administração

A navegação principal usa:

```text
/admin
├── /admin/aquisicao
├── /admin/jornada
├── /admin/retencao
├── /admin/receita
└── /admin/operacao
```

Rotas especializadas, como auditoria, Marketing, saúde e WhatsApp, continuam
existindo fora dessa hierarquia principal quando a tarefa exige.

Uma rota não concede autorização. Ela apenas seleciona navegação e experiência.
Permissões reais continuam sendo validadas pelo backend.

## 6. Lazy loading e carregamento de estilos

`App.jsx` usa `React.lazy` e `Suspense` para carregar várias páginas sob
demanda.

Há dois padrões principais:

- lazy loading apenas do módulo;
- lazy loading do módulo junto do CSS da feature.

Exemplos de CSS contextual por feature incluem dashboard, agenda, horários,
serviços, negócio, assinatura, planos, equipe e áreas administrativas
especializadas.

O objetivo é:

- reduzir CSS global desnecessário;
- manter ownership visual explícito;
- evitar flash de conteúdo sem estilo quando página e CSS precisam chegar
  juntos;
- impedir que uma feature privada aumente o acoplamento visual de outra rota.

Detalhes de ownership e cascata ficam em
[`frontend-estilos.md`](./frontend-estilos.md).

## 7. Contextos e shells

A SPA possui quatro contextos visuais principais.

| Contexto | Resolução atual |
| --- | --- |
| Público/cliente | `PublicShell` |
| Dona | `WorkspaceLayout → OwnerShell` |
| Profissional | `WorkspaceLayout → ProfessionalShell` |
| Admin | `AdminLayout → AdminShell` |

### PublicShell

`PublicShell` considera como operacional qualquer rota `/admin/*`,
`/painel/*`, `/profissional/*` e a rota `/conta` quando a sessão possui
Admin ou negócio.

Fora desses casos, o shell adiciona:

```html
data-frontend-context="public"
```

e ativa a classe de raiz `public-context-active`.

Esse marcador é um contrato visual e de teste, não uma permissão.

### WorkspaceLayout

`WorkspaceLayout` usa o contexto de negócio resolvido pela sessão.

- vínculo com `papel === "dono"` → `OwnerShell`;
- demais contextos profissionais válidos → `ProfessionalShell`.

Os shells carregam seus CSS de forma contextual.

### OwnerShell

A área da dona apresenta o negócio atual, navegação de gestão, acesso ao perfil
público, conta e navegação mobile.

A navegação canônica inclui visão geral, agenda, serviços, horários, equipe,
negócio, plano/assinatura e conta.

### ProfessionalShell

A área profissional prioriza a rotina individual. A navegação atual inclui
agenda, horários, convites e conta.

Funções exclusivas da dona não devem aparecer apenas porque a pessoa participa
do mesmo negócio.

### AdminShell

O Admin possui shell e design system próprios para densidade operacional,
métricas, tabelas e ações internas.

A semântica visual completa desses contextos pertence a
[`ux-contextos-visuais.md`](./ux-contextos-visuais.md).

## 8. Sessão e resolução do negócio

`SessionProvider` vive em `frontend/src/auth/SessionContext.jsx`.

O refresh da sessão consulta:

```text
GET /minha-sessao
```

e normaliza no contexto React:

- usuário;
- negócio principal;
- vínculos;
- presença de negócio;
- acesso administrativo.

A propriedade `negocio` exposta ao restante da aplicação é resolvida também
pela rota atual. Isso é necessário porque a mesma conta pode possuir mais de um
contexto de uso.

A resolução do frontend melhora navegação, mas não pode ser tratada como
autorização.

O provider também centraliza login, cadastro, login com Google e logout. O
logout local é efetivado mesmo quando a chamada ao backend falha, para não
prender a pessoa em uma sessão visualmente ativa por erro de rede.

## 9. ProtectedRoute

`ProtectedRoute` cobre gates de navegação como:

- autenticação;
- acesso administrativo;
- existência de negócio;
- contexto de dona;
- contexto profissional;
- negócio publicado quando a rota exige essa condição.

Durante o carregamento da sessão, a rota usa `LoadingState`.

Se a pessoa não estiver autenticada, a navegação preserva o caminho de origem e,
quando aplicável, a intenção de plano.

Esses gates são UX. Requisições diretas ao backend continuam obrigadas a
revalidar usuário, vínculo, negócio, publicação, plano e permissão.

## 10. Cliente HTTP

A primitive HTTP compartilhada é `frontend/src/api/client.js`.

O contrato atual inclui:

- base opcional por `VITE_API_URL`;
- `Accept: application/json`;
- serialização automática de objetos para JSON;
- preservação de `FormData`;
- `credentials: "include"`;
- compatibilidade com token armazenado quando presente;
- `AbortController`;
- timeout padrão de 20 segundos;
- `ApiError` com `status` e dados da resposta;
- limpeza da sessão local quando a resposta é HTTP 401.

O servidor não usa prefixo global `/api`; o frontend não deve introduzir esse
prefixo unilateralmente.

Novos wrappers de rede devem ser evitados quando `apiRequest` já cobre o caso,
pois múltiplas primitives concorrentes dificultam timeout, sessão, erros e
observabilidade.

## 11. Estado assíncrono de interface

A primitive compartilhada `ScreenState.jsx` possui:

- `LoadingState`;
- `EmptyState`;
- `ErrorState`, com retry opcional.

Não existe um `SuccessState` global obrigatório. Sucesso pode ser representado
pela própria página ou feature quando a composição específica for mais clara.

Toda tela assíncrona deve considerar, conforme o fluxo:

```text
loading
  → conteúdo
  → vazio
  → erro recuperável
  → sessão expirada
  → permissão insuficiente
  → sucesso/transição concluída
```

A resposta do backend deve continuar sendo a autoridade para falhas de
autorização ou regra de negócio.

Mensagens ao usuário devem explicar o problema e indicar uma ação possível
quando houver recuperação disponível.

## 12. Estado local e lógica de página

O frontend atual usa estado e composição React sem introduzir um store global
adicional.

Como regra prática:

- estado puramente visual fica próximo do componente;
- sessão compartilhada fica no `SessionProvider`;
- transformação reutilizável deve preferir `utils/`;
- regras canônicas de negócio permanecem no backend;
- páginas podem coordenar carregamento e composição;
- componentes podem ser extraídos quando isso reduzir complexidade ou permitir
  teste isolado.

Não duplicar no navegador regras críticas de preço, plano, autorização,
disponibilidade ou estado financeiro como se fossem fonte de verdade.

## 13. CSS e design systems

A estratégia de estilos é incremental.

Fundações realmente compartilhadas continuam em arquivos globais como
`index.css`, enquanto shells e features com ownership claro podem carregar CSS
próprio.

Contextos possuem design systems separados:

- público: `public-design-system.css`;
- dona: `owner-design-system.css`;
- profissional: `professional-design-system.css`;
- Admin: `admin-design-system.css`.

Os shells usam tokens próprios (`--owner-*`, `--professional-*`,
`--admin-*`) quando isso melhora consistência e reduz acoplamento.

Não criar sequências de arquivos de versão apenas para sobrepor a cascata. Ao
tocar uma área, preferir consolidar ownership quando isso puder ser feito com
patch pequeno e testável.

## 14. Responsividade e mobile

Mobile faz parte do contrato do frontend, não é acabamento posterior.

A base atual contém regras específicas para:

- navegação mobile dos workspaces;
- safe area inferior;
- cards e rails da descoberta;
- booking público;
- tabelas com overflow controlado;
- horários;
- formulários;
- ações fixas/sticky quando a tarefa exige.

Campos `input`, `select` e `textarea` usam tamanho de fonte compatível com
mobile para reduzir zoom indesejado em navegadores móveis.

Ao alterar uma tela, validar pelo menos:

- ausência de overflow horizontal indevido;
- ação principal acessível;
- barras fixas sem encobrir conteúdo;
- textos reais maiores que o happy path;
- teclado e foco;
- safe areas;
- WebKit/Safari quando houver `sticky`, `fixed`, blur ou overflow.

## 15. Acessibilidade e movimento

O frontend deve perseguir WCAG 2.2 AA nos fluxos críticos.

A base atual possui foco visível global para controles comuns e uma regra de
`prefers-reduced-motion: reduce` que reduz animações, transições e
`scroll-behavior`.

Componentes interativos devem manter:

- nome acessível;
- semântica adequada;
- foco visível;
- operação por teclado quando aplicável;
- contraste suficiente;
- feedback de erro compreensível.

Conteúdo com movimento automático deve continuar oferecendo controle e
respeitando a preferência de redução de movimento.

## 16. Imagens e assets

Assets versionados do produto ficam em `frontend/src/assets/` quando fazem
parte do código-fonte da interface.

A marca possui arquivos próprios em `assets/brand/`.

Imagens de negócio e serviço devem preservar a política de UX definida para o
contexto. Quando a visualização completa for necessária, evitar cortes
indevidos. Fallbacks devem continuar coerentes com a categoria/feature.

Não adicionar arquivos de mídia pesados sem considerar tamanho, formato,
carregamento e impacto no LCP.

## 17. Analytics no navegador

A pasta `frontend/src/analytics/` contém a telemetria de navegador e bridges
permitidas de marketing.

O frontend mede comportamento. Fatos transacionais canônicos, como booking
efetivamente criado, pagamento confirmado ou assinatura ativa, não devem ser
inventados a partir de clique ou navegação.

A aplicação também monta `FirstPartyAnalyticsBridge` no topo do `App` e
carrega a bridge de Meta de forma adiada.

Mudanças de analytics precisam preservar:

- consentimento aplicável;
- separação entre comportamento e fato de backend;
- identificadores e nomes documentados;
- ausência de dados pessoais desnecessários;
- fail-soft: falha de analytics não pode derrubar o fluxo principal.

## 18. Build e desenvolvimento local

Scripts principais do frontend:

```bash
npm --prefix frontend run dev
npm --prefix frontend run build
npm --prefix frontend run lint
npm --prefix frontend run check:dead-code
npm --prefix frontend run test
npm --prefix frontend run test:e2e
```

Na raiz do repositório existem aliases para build e testes do frontend.

O build Vite produz atualmente o artefato em:

```text
agendamento-nails/react-app
```

relativo à raiz do projeto.

O bundle separa React, React DOM e React Router em um chunk manual
`vendor-react`.

## 19. Testes

A estratégia possui três níveis relevantes.

### Vitest e Testing Library

Testam componentes, páginas, sessão, utilitários, analytics e regressões de
comportamento sem depender do navegador completo.

Ao corrigir um bug de UI definido por requisito existente, adicionar teste de
regressão proporcional ao risco.

### Playwright

A configuração atual executa projetos móveis em:

- WebKit 360 px;
- WebKit 390 px;
- WebKit 430 px;
- Chromium mobile.

Também existem projetos de Admin desktop em Chromium e WebKit.

A suíte E2E cobre, entre outros:

- acessibilidade crítica;
- shell público;
- workspace mobile;
- booking mobile;
- ativação profissional;
- onboarding de horários;
- repetição de booking;
- assinatura e retenção paga;
- Admin mobile/desktop;
- carregamento de CSS por rota.

### CI

O Quality Gate do GitHub Actions executa para o frontend:

1. instalação determinística com `npm ci`;
2. ESLint;
3. Knip para código morto;
4. build Vite;
5. testes Vitest;
6. auditoria de dependências;
7. instalação de Chromium e WebKit;
8. Playwright.

Falha da suíte crítica deve impedir merge.

## 20. Vite e proxy local

O Vite usa porta 5173 no desenvolvimento.

O proxy local cobre endpoints públicos usados durante desenvolvimento, como
negócios públicos, perfil, agenda pública, agendamentos e eventos de produto.

A configuração de preview usa porta 4173 e aceita target de API para cenários de
performance.

Alterar o contrato de proxy não substitui alterar o backend. Ele existe para
desenvolvimento e validação local.

## 21. Fluxos críticos que o frontend deve preservar

Mudanças de UI precisam considerar o fluxo completo, principalmente:

### Ativação profissional

```text
cadastro profissional
  → negócio criado
  → serviço ativo
  → negócio publicado
  → horários apresentados/ajustados sem virar gate de publicação
  → divulgação
  → primeiro agendamento válido
```

A interface deve apresentar uma próxima ação clara e não reintroduzir agenda
como pré-condição de publicação.

### Booking público

```text
perfil
  → serviço
  → profissional quando necessário
  → data/horário
  → confirmação
  → sucesso
```

Quando houver apenas uma profissional elegível, a UX pode evitar uma escolha
redundante, mas a elegibilidade real continua sendo validada pelo backend.

### Operação da dona

A dona gerencia negócio, agenda, serviços, horários, equipe, assinatura e
crescimento no `OwnerShell`.

### Operação profissional

A profissional atua principalmente sobre a própria agenda, horários, convites e
conta no `ProfessionalShell`.

### Monetização

Checkout iniciado, pagamento confirmado e assinatura ativa são estados
distintos. A UI não pode liberar benefício pago por retorno do navegador ou
clique no checkout.

## 22. Convenções para novas telas

Ao criar ou alterar uma tela:

1. confirmar o contexto correto: público, dona, profissional ou Admin;
2. verificar se a rota já existe no contrato central;
3. usar `apiRequest` para rede salvo motivo técnico documentado;
4. reutilizar `ScreenState` quando a primitive atender ao caso;
5. não confiar em IDs, preços, plano, papel ou permissão vindos do navegador;
6. tratar loading, vazio, erro e sucesso aplicáveis;
7. preservar navegação por teclado e foco;
8. validar mobile e WebKit;
9. escolher CSS pelo ownership: fundação, shell ou feature;
10. adicionar teste proporcional ao risco;
11. revisar analytics quando a mudança altera uma etapa relevante do funil;
12. atualizar documentação canônica quando a mudança alterar uma decisão
    durável.

## 23. Compatibilidade e evolução

O frontend possui camadas históricas de CSS e features com diferentes níveis de
migração. A política é evolução incremental.

Não reescrever uma área grande apenas para uniformizar nomes ou estrutura.

Ao tocar código legado:

- preservar o fluxo funcional existente;
- reduzir duplicação somente quando o ganho for concreto;
- manter compatibilidade quando uma migração ampla aumentar risco sem benefício
  proporcional;
- usar testes para proteger comportamento antes de consolidar;
- remover código apenas depois de confirmar que não há import, rota ou selector
  dependente.

## 24. Documentos relacionados

- [`frontend-mapa-telas-jornadas.md`](./frontend-mapa-telas-jornadas.md): inventário de rotas, telas e jornadas implementadas;
- [`frontend-componentes-primitives.md`](./frontend-componentes-primitives.md): catálogo de componentes compartilhados, ownership e critérios de reutilização;
- [`frontend-formularios-estado-api.md`](./frontend-formularios-estado-api.md): formulários, estado, rede, erros, uploads e mutações;
- [`frontend-analytics-observabilidade.md`](./frontend-analytics-observabilidade.md): analytics first-party/legado, consentimento, Ads e fronteira de conversões;
- [`frontend-seguranca.md`](./frontend-seguranca.md): sessão, autorização, storage, CORS/CSP, uploads, secrets e hardening;
- [`frontend-entrega-runtime.md`](./frontend-entrega-runtime.md): build, chunks, cache, recovery, SEO e metadata;
- [`frontend-qa-prontidao.md`](./frontend-qa-prontidao.md): QA, acessibilidade, mobile/WebKit, performance e prontidão;
- [`arquitetura.md`](./arquitetura.md): arquitetura geral do AF;
- [`ux-contextos-visuais.md`](./ux-contextos-visuais.md): semântica dos
  contextos;
- [`frontend-estilos.md`](./frontend-estilos.md): CSS, tokens e ownership;
- [`public-shell.md`](./public-shell.md): experiência pública;
- [`ativacao-profissional-ux.md`](./ativacao-profissional-ux.md): jornada de
  ativação;
- [`ciclo-atendimento.md`](./ciclo-atendimento.md): lifecycle de booking;
- [`planos.md`](./planos.md): planos e monetização;
- [`session-security.md`](./session-security.md): segurança de sessão;
- [`qualidade-codigo.md`](./qualidade-codigo.md): guardrails de qualidade;
- [`performance-qa.md`](./performance-qa.md): validação de performance.

## 25. Critério de manutenção deste documento

Atualizar este arquivo quando mudar de forma durável:

- bootstrap da aplicação;
- estratégia de roteamento;
- contexto/shell principal;
- contrato de sessão no frontend;
- primitive HTTP;
- estratégia de estado compartilhado;
- estrutura de testes;
- build ou ownership técnico relevante do frontend.

Mudanças puramente cosméticas ou temporárias não precisam virar regra
arquitetural.
