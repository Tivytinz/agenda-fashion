# Contextos visuais do Agenda Fashion

Este documento registra a separação durável entre os contextos de uso do Agenda Fashion. A mesma conta pode atuar em contextos diferentes sem precisar se tornar um único "tipo de usuário" permanente.

## Princípio de contexto

O Agenda Fashion continua sendo **uma única aplicação React**. Cliente, profissional, dona do negócio e administração não são quatro aplicações independentes nem quatro identidades globais de usuário.

A identidade da conta é única. O frontend diferencia a experiência atual pela combinação entre:

1. rota acessada;
2. sessão autenticada;
3. vínculos da pessoa com negócios;
4. permissões devolvidas e validadas pelo backend.

A rota seleciona o **contexto visual** adequado; sessão, vínculos e permissões determinam o que aquela conta pode realmente acessar e executar.

Os quatro contextos principais são:

1. **Cliente**: descoberta, favoritos, agendamentos e conta.
2. **Profissional**: própria agenda, próprios horários e conta, quando existe vínculo profissional com negócio.
3. **Dona do negócio**: gestão do negócio, serviços, equipe, agenda, assinatura e crescimento, quando existe vínculo de dona.
4. **Administração AF**: operação, aquisição, jornada, retenção, receita e saúde do SaaS, exclusivamente para contas autorizadas como administração.

Esses contextos **não são mutuamente exclusivos**. Uma mesma conta pode, por exemplo, ser cliente em um agendamento, profissional em um negócio, dona de outro negócio e também possuir acesso administrativo quando o backend autorizar.

Uma dona ou profissional pode navegar no contexto de cliente para contratar serviços de outro negócio. Essa troca de contexto visual não altera vínculos nem permissões persistidas no backend.

### Resolução visual por rota

A aplicação deve resolver a experiência visual sem duplicar a aplicação:

```text
Agenda Fashion
├── experiência pública / cliente → CustomerShell ou contexto público equivalente
├── /profissional/*              → ProfessionalShell
├── /painel/*                    → OwnerShell
└── /admin/*                     → AdminShell
```

Os nomes dos shells representam responsabilidades de apresentação e navegação, não papéis globais persistidos no usuário.

A sessão pode orientar destinos padrão e esconder ações sem utilidade no contexto atual, mas **não transforma o frontend em autoridade de segurança**.

## Segurança e autorização

A separação de shells é uma decisão de arquitetura de frontend e UX. Ela nunca substitui autenticação ou autorização.

- acessar manualmente uma URL não pode conceder permissão;
- ocultar botão, link ou módulo não é controle de acesso;
- IDs, papéis, limites, preços e permissões enviados pelo navegador não são confiáveis;
- o backend continua responsável por autenticação, autorização, isolamento entre negócios e regras críticas;
- o `AdminShell` só deve ser alcançado por uma conta cuja sessão seja aceita pelo fluxo administrativo protegido.

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

### Hierarquia do shell administrativo

O `AdminShell` é responsável pela estrutura global da administração:

- marca e navegação lateral no desktop;
- contexto global do **Agenda Fashion Command Center** na topbar;
- ações globais, como voltar ao produto e acessar a conta;
- navegação mobile administrativa;
- superfície onde cada módulo renderiza seu conteúdo.

O **nome do módulo atual deve aparecer uma única vez como título principal da página**. A topbar não deve repetir `Visão geral`, `Aquisição`, `Jornada`, `Retenção`, `Receita` ou `Operação` quando o mesmo título já estiver no cabeçalho do conteúdo.

Os cabeçalhos das páginas administrativas devem ser mais compactos que uma hero de marketing. Eles existem para orientar operação e leitura de dados, não para consumir grande parte da primeira dobra.

Controles de período, filtros e ações específicas do módulo pertencem ao cabeçalho da página ou à área operacional correspondente. O recorte temporal deve permanecer visível, mas sem repetir a mesma informação em vários blocos próximos.

### Design system administrativo

Novas estruturas do Admin devem usar primitivas e classes `admin-*`, preferencialmente seguindo responsabilidades equivalentes a:

- `admin-page`;
- `admin-page-header`;
- `admin-panel`;
- `admin-command-metric` ou componente de métrica administrativo;
- estados e badges administrativos com tons semânticos.

Cores, bordas, raios, sombras, foco e superfícies devem vir dos tokens `--admin-*` sempre que existir token correspondente.

As cores semânticas representam significado operacional:

- `success`: saudável, concluído ou resultado positivo comprovado;
- `warning`: atenção, mensuração insuficiente ou risco que exige análise;
- `danger`: erro, falha ou condição crítica;
- `info`: informação operacional sem caráter de sucesso ou alerta.

Rosa de marca não deve substituir indiscriminadamente essas cores semânticas.

### Migração do legado visual

Componentes administrativos legados ainda podem usar classes `workspace-*` durante a migração, mas essa é **compatibilidade temporária**, não arquitetura de destino.

- qualquer compatibilidade deve ficar escopada dentro de `.admin-shell`;
- não criar novas estruturas administrativas baseadas em `workspace-*`;
- ao alterar uma página administrativa relevante, preferir migrar o trecho tocado para primitivas `admin-*` quando isso puder ser feito sem reescrita desnecessária;
- estilos específicos de funcionalidades, como marketing, saúde do SaaS e WhatsApp, podem continuar separados por ownership de rota, mas devem consumir os tokens administrativos quando estiverem dentro do Admin;
- a migração não deve alterar métricas canônicas, contratos de API ou regras de negócio apenas para satisfazer o visual.

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
