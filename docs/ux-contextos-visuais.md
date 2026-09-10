# Contextos visuais do Agenda Fashion

Este documento registra princípios de frontend e UX para manter o Agenda Fashion coerente entre seus diferentes contextos de uso. Ele orienta decisões de composição, ownership e responsividade; não substitui autenticação, autorização nem regras do backend.

## Princípio de contexto

O Agenda Fashion é uma única aplicação React. Cliente, profissional, dona do negócio e administração são contextos da mesma plataforma, e não quatro aplicações independentes.

A experiência apresentada considera principalmente:

1. rota acessada;
2. sessão autenticada;
3. vínculos da pessoa com negócios;
4. permissões e dados disponibilizados pelo backend.

Uma mesma conta pode existir em mais de um contexto. Trocar o shell visual não cria nem remove permissões.

## Resolução visual por shell

A arquitetura canônica do frontend passa a ser:

```text
Agenda Fashion
├── público / cliente  → PublicShell
├── /painel/*          → WorkspaceLayout resolve OwnerShell
├── /profissional/*    → WorkspaceLayout resolve ProfessionalShell
└── /admin/*           → AdminLayout + AdminShell
```

Os quatro shells compartilham a mesma aplicação React e podem reutilizar primitives neutras. Cada contexto, porém, é responsável por sua composição, navegação, tokens e regras visuais próprias quando isso melhora clareza e manutenção.

`PublicShell` envolve a experiência de entrada, descoberta e cliente. Nas rotas operacionais ele deixa o conteúdo ser assumido pelo shell correspondente. `WorkspaceLayout` continua resolvendo os dois papéis vinculados a negócio: dona → `OwnerShell`; profissional → `ProfessionalShell`.

Esse mapa descreve apresentação. Nomes de componentes e rotas não substituem os papéis persistidos nem os controles server-side.

## Segurança e autorização

As seguintes regras são obrigatórias:

- acessar uma URL manualmente não concede permissão;
- esconder um botão ou módulo no frontend não substitui autorização;
- IDs, papéis, limites, preços e permissões enviados pelo navegador não são autoridade;
- autenticação, autorização e isolamento entre negócios continuam no backend;
- o acesso administrativo depende do fluxo protegido e da autorização aceita pelo backend.

O shell pode orientar a pessoa para o contexto certo, mas nunca é a fronteira de segurança.

## Público e cliente

O `PublicShell` é a face mais acolhedora e visual do AF. Ele concentra a fundação usada por descoberta, perfil público, fluxo de agendamento, autenticação, favoritos, agendamentos do cliente, páginas institucionais e outras superfícies de entrada que ainda não possuem contexto operacional próprio.

O shell marca `data-frontend-context="public"` e ativa `public-context-active` apenas no contexto público. Rotas `/admin/*`, `/painel/*` e `/profissional/*` são delegadas aos seus shells. Em `/conta`, contas administrativas ou vinculadas a negócio também são delegadas; uma conta somente de cliente permanece pública.

Direção de UX:

- rosa como ação e assinatura de marca;
- superfícies claras e grafite suave para leitura;
- descoberta simples e visual;
- favoritos e agendamentos do cliente acessíveis;
- poucos passos até o agendamento;
- foco visível, contraste e alvos de toque adequados;
- mobile first e atenção especial a Safari/WebKit.

O contexto público usa tokens `--public-*`. Eles fazem parte do mesmo sistema visual do AF, não de uma biblioteca independente.

Detalhes: [`public-shell.md`](./public-shell.md).

## Profissional

As rotas `/profissional/*` usam o `ProfessionalShell`, escolhido pelo vínculo profissional carregado na sessão. A experiência favorece execução rápida do trabalho diário e não replica o painel de gestão da dona.

Navegação canônica:

- Minha agenda;
- Meus horários;
- Minha conta.

Controles de equipe, serviços do negócio, publicação, assinatura e crescimento não entram nesse shell apenas porque a conta pertence ao mesmo negócio.

O contexto possui tokens `--professional-*`, CSS próprio e pode reutilizar primitives neutras de navegação. Sidebar, topbar, foco, responsividade e ownership visual permanecem profissionais.

## Dona do negócio

As rotas `/painel/*` usam o `OwnerShell`, resolvido pelo vínculo de dona. O contexto funciona como workspace de gestão e normalmente reúne:

- visão geral e crescimento;
- agenda do negócio;
- serviços;
- horários;
- equipe;
- dados do negócio;
- plano e assinatura;
- conta.

O shell possui tokens `--owner-*`, identidade do negócio atual, navegação desktop/mobile e ações de gestão. Páginas históricas podem manter classes antigas enquanto uma migração ampla não trouxer benefício proporcional.

## Administração AF

As rotas `/admin/*` usam `AdminLayout` + `AdminShell`. O Admin é um Command Center operacional e possui maior densidade de dados do que os demais contextos.

A direção atual usa:

- sidebar em grafite;
- rosa AF como assinatura, seleção e ação;
- superfícies claras para métricas e tabelas;
- cores semânticas para sucesso, atenção, erro e informação;
- tokens `--admin-*` para a fundação administrativa;
- navegação mobile própria.

Os seis módulos principais recebem layout e densidade da camada administrativa. Features antigas podem manter compatibilidade escopada quando reescrever não reduzir risco ou complexidade.

## Design system e ownership

O AF não mantém quatro bibliotecas de UI independentes. Existe uma fundação compartilhada e quatro contextos de tokens:

```text
AF Design System
├── fundação compartilhada
├── --public-*
├── --owner-*
├── --professional-*
└── --admin-*
```

Componentes compartilháveis devem permanecer neutros quando isso evita duplicação. Tokens contextuais servem para adaptar superfície, foco, borda, sombra, densidade e assinatura de marca sem copiar regras de negócio.

CSS exclusivo deve ficar próximo do contexto ou feature que o possui quando isso melhora ownership. CSS histórico pode permanecer global até existir uma separação segura e útil.

## Responsividade e acessibilidade

Mobile, Safari/WebKit e acessibilidade fazem parte da definição de qualidade. Ao alterar qualquer contexto, verificar:

- ausência de overflow horizontal;
- conteúdo não encoberto por `fixed`/`sticky` e safe areas;
- foco visível e navegação por teclado;
- contraste suficiente;
- loading, vazio, erro, sucesso e sessão expirada;
- textos maiores e dados reais;
- comportamento de `sticky`, `fixed`, blur e overflow no WebKit.

Quando uma área útil é menor que a viewport por causa de sidebar, o componente deve responder à largura real disponível, usando container query quando fizer sentido e media query quando a regra depender da viewport.

## Horários profissionais

A configuração de horários pertence ao contexto profissional e deve favorecer leitura e edição sem esforço desnecessário. Dias ativos/fechados, horários, pausas e ação de salvar precisam permanecer legíveis no mobile e não podem ser cobertos por navegação fixa.

Essas escolhas não alteram a disponibilidade canônica. A validação real permanece no backend.

## Critério de decisão

Antes de alterar um contexto visual, responder:

1. está claro em qual contexto a pessoa está?
2. a mudança preserva os contratos e a autorização existentes?
3. reduz esforço na tarefa principal?
4. mantém mobile e WebKit saudáveis?
5. evita duplicação e acoplamento sem exigir reescrita desnecessária?

Decisões duráveis de shell, ownership ou contexto devem atualizar esta documentação ou o documento especializado correspondente.
