# Contextos visuais do Agenda Fashion

Este documento registra a separação durável entre os contextos de uso do Agenda Fashion. A mesma conta pode atuar em contextos diferentes sem precisar se tornar um único "tipo de usuário" permanente.

## Princípio de contexto

O frontend deve diferenciar a experiência atual pela combinação entre sessão, vínculo com negócio e rota. A identidade da conta continua única; o contexto define navegação, prioridades e apresentação.

Os quatro contextos principais são:

1. **Cliente**: descoberta, favoritos, agendamentos e conta.
2. **Profissional**: própria agenda, próprios horários e conta.
3. **Dona do negócio**: gestão do negócio, serviços, equipe, agenda, assinatura e crescimento.
4. **Administração AF**: operação, aquisição, jornada, retenção, receita e saúde do SaaS.

Uma dona ou profissional pode navegar no contexto de cliente para contratar serviços de outro negócio. Essa troca de contexto visual não altera vínculos nem permissões persistidas no backend.

## Cliente

A experiência pública e de cliente deve preservar a identidade visual do Agenda Fashion:

- rosa como cor principal de marca e de ações primárias;
- branco e grafite suave como base de leitura;
- descoberta simples e visual de serviços e negócios;
- favoritos e agendamentos fáceis de acessar;
- fundos rosados leves e componentes arredondados quando contribuírem para acolhimento e clareza;
- prioridade para mobile e Safari/WebKit.

O cliente não deve receber controles de gestão de negócio apenas por possuir uma conta.

## Profissional

O contexto profissional deve priorizar execução do trabalho, sem expor decisões exclusivas da dona do negócio:

- agenda própria em primeiro plano;
- configuração dos próprios horários quando permitida pelo fluxo atual;
- conta pessoal acessível;
- navegação curta e objetiva;
- identidade do Agenda Fashion preservada.

Permissões continuam sendo validadas no backend. Esconder uma ação no frontend é UX, não autorização.

## Dona do negócio

O contexto da dona é um workspace de gestão do negócio e pode compartilhar fundações visuais com o contexto profissional, mas deve possuir navegação e prioridades próprias:

- visão geral e crescimento;
- agenda do negócio;
- serviços;
- horários;
- equipe;
- dados do negócio;
- plano e assinatura;
- conta.

A experiência deve tornar evidente quando a pessoa está administrando o negócio e quando voltou ao contexto de cliente.

## Administração AF

As rotas `/admin/*` e a conta quando acessada dentro da administração pertencem a um produto operacional interno do Agenda Fashion.

A administração possui **shell próprio e design system próprio**. Ela não deve depender estruturalmente de `WorkspaceLayout`, `NavigationShell` ou da aparência global das classes `workspace-*` para montar sidebar, topbar ou navegação mobile.

O Admin deve funcionar como um **Command Center do AF**:

- sidebar própria em grafite de alto contraste;
- rosa oficial do Agenda Fashion como assinatura de marca, ação e seleção, sem transformar toda a superfície em rosa;
- superfícies claras para leitura de dados;
- hierarquia forte para métricas, funis, tabelas e alertas;
- verde para saudável/sucesso, âmbar para atenção, vermelho para erro/risco e azul para informação;
- bordas, sombras e raios consistentes definidos por tokens `--admin-*`;
- navegação mobile própria;
- estados de carregamento, vazio, erro, atualização e sucesso integrados ao mesmo sistema visual;
- densidade suficiente para operação sem sacrificar legibilidade.

Componentes administrativos legados ainda podem usar classes `workspace-*` durante migração, mas qualquer compatibilidade deve ficar escopada dentro de `.admin-shell`. Novas estruturas administrativas devem preferir classes e componentes `admin-*`.

A separação é visual e arquitetural. Autenticação, autorização, isolamento entre negócios, métricas canônicas, planos, pagamentos e demais regras de negócio continuam sob autoridade do backend.

## Horários profissionais

A configuração de horários pertence ao produto profissional e deve continuar com identidade do Agenda Fashion. O editor deve:

- tornar dias ativos e fechados fáceis de distinguir;
- manter horários de início e fim sempre legíveis;
- nunca comprimir os campos de pausa a ponto de esconder o valor `HH:MM`;
- quebrar a composição em blocos no mobile em vez de criar scroll horizontal;
- deixar ajustes avançados visualmente secundários;
- manter a ação de salvar sempre acessível sem cobrir os controles essenciais.

Mudanças visuais nessa área não alteram as regras de disponibilidade do backend. A disponibilidade real continua sendo validada pelas regras canônicas da agenda.
