# Contextos visuais do Agenda Fashion

Este documento registra princípios de frontend e UX que ajudam a manter o Agenda Fashion coerente entre seus diferentes contextos de uso. Ele funciona como referência para decisões, não como uma especificação visual imutável.

A prioridade é preservar clareza, segurança, consistência e facilidade de uso. Quando uma solução diferente atender melhor ao produto, à acessibilidade, à compatibilidade entre navegadores ou à manutenção do código, ela pode ser adotada desde que a decisão seja compreensível e não quebre contratos importantes.

## Princípio de contexto

O Agenda Fashion é uma única aplicação React. Cliente, profissional, dona do negócio e administração representam contextos de uso da mesma plataforma, e não quatro aplicações ou quatro identidades globais independentes.

A experiência apresentada normalmente considera a combinação entre:

1. rota acessada;
2. sessão autenticada;
3. vínculos da pessoa com negócios;
4. permissões e dados disponibilizados pelo backend.

A rota ajuda a selecionar o contexto visual mais adequado. Sessão, vínculos e permissões determinam o que aquela conta pode realmente acessar e executar.

Os principais contextos são:

- **Cliente**: descoberta, favoritos, agendamentos e conta.
- **Profissional**: agenda própria, horários e conta quando existe vínculo profissional com um negócio.
- **Dona do negócio**: gestão do negócio, serviços, equipe, agenda, assinatura e crescimento quando existe vínculo de dona.
- **Administração AF**: operação, aquisição, jornada, retenção, receita e saúde do SaaS para contas com acesso administrativo.

Esses contextos podem coexistir. Uma mesma conta pode, por exemplo, atuar como cliente em um agendamento e também possuir vínculos profissionais ou administrativos.

Trocar de contexto visual não altera vínculos nem permissões persistidas no backend.

### Resolução visual por rota

A implementação atual do frontend segue este mapa:

```text
Agenda Fashion
├── experiência pública / cliente → páginas e componentes do contexto público
├── /painel/*                    → WorkspaceLayout com navegação da dona
├── /profissional/*              → WorkspaceLayout com navegação profissional
└── /admin/*                     → AdminLayout + AdminShell
```

`WorkspaceLayout` compartilha hoje a mesma fundação estrutural entre dona e profissional e muda a navegação de acordo com o vínculo carregado na sessão. O Admin possui shell separado porque sua necessidade operacional é diferente.

Esse mapa pode evoluir. Nomes de componentes descrevem a implementação atual, não papéis globais persistidos no usuário nem regras de autorização.

## Segurança e autorização

Aqui existem regras mais rígidas, porque são requisitos de segurança e não apenas preferências visuais.

- acessar uma URL manualmente não concede permissão;
- esconder um botão ou módulo no frontend não substitui autorização;
- IDs, papéis, limites, preços e permissões enviados pelo navegador não são tratados como autoridade;
- autenticação, autorização, isolamento entre negócios e demais regras críticas continuam sob responsabilidade do backend;
- o acesso administrativo depende do fluxo protegido e da autorização aceita pelo backend.

O frontend pode melhorar a experiência escondendo ações sem utilidade ou direcionando a pessoa ao contexto mais provável, mas essas decisões são de UX, não de segurança.

## Cliente

A experiência pública e de cliente tende a preservar a identidade mais acolhedora e visual do Agenda Fashion.

Como referência:

- rosa funciona bem como cor principal de marca e de ações importantes;
- branco e grafite suave favorecem legibilidade;
- descoberta de serviços e negócios deve permanecer simples;
- favoritos e agendamentos merecem acesso fácil;
- fundos rosados leves e componentes arredondados podem reforçar a identidade quando não prejudicam densidade ou leitura;
- mobile e Safari/WebKit merecem atenção especial.

Não é necessário aplicar todos esses elementos em todas as telas. O contexto da tarefa e a clareza da interface têm prioridade sobre uniformidade estética absoluta.

## Profissional

O contexto profissional favorece execução rápida do trabalho diário.

Em geral, vale priorizar:

- agenda própria em primeiro plano;
- configuração dos próprios horários quando fizer parte do fluxo atual;
- conta pessoal acessível;
- navegação curta e objetiva;
- identidade do Agenda Fashion reconhecível sem competir com a tarefa principal.

Controles exclusivos da dona do negócio podem ficar fora desse contexto quando não forem úteis para a profissional.

## Dona do negócio

O contexto da dona funciona como um workspace de gestão do negócio. Ele compartilha atualmente a fundação `WorkspaceLayout` com o contexto profissional, mas usa navegação e prioridades adequadas ao papel de dona.

Normalmente reúne:

- visão geral e crescimento;
- agenda do negócio;
- serviços;
- horários;
- equipe;
- dados do negócio;
- plano e assinatura;
- conta.

A interface deve ajudar a pessoa a perceber em qual negócio e contexto está trabalhando, especialmente quando ela também usa o AF como cliente ou profissional.

## Administração AF

As rotas `/admin/*` formam o contexto operacional interno do Agenda Fashion.

A administração possui shell próprio e um conjunto visual próprio porque sua necessidade de densidade, leitura de dados e operação é diferente da experiência pública e profissional. Isso não significa que cada página precise obedecer a uma composição única ou que todos os componentes tenham de ser migrados de uma vez.

A direção visual atual do Admin é a de um **Command Center do AF**. Como referência:

- sidebar em grafite ajuda a separar o ambiente interno;
- rosa oficial do AF funciona bem como assinatura de marca, seleção e ação;
- superfícies claras favorecem leitura de métricas e tabelas;
- cores semânticas podem diferenciar sucesso, atenção, erro e informação;
- tokens `--admin-*` são a fonte preferida para bordas, raios, sombras, foco e superfícies;
- navegação mobile própria ajuda a manter o contexto administrativo reconhecível;
- densidade operacional é desejável, desde que a interface continue legível.

Esses elementos são uma base, não uma obrigação de composição. Uma tela pode usar uma solução diferente quando isso melhorar significativamente a tarefa ou evitar complexidade desnecessária.

### Hierarquia do shell administrativo

O `AdminShell` concentra a estrutura global da administração, como navegação, marca, ações globais e a superfície onde os módulos são renderizados.

Como padrão, preferimos evitar que a topbar e o conteúdo repitam o mesmo título sem necessidade. Um título principal por módulo costuma produzir uma hierarquia mais limpa, mas informações adicionais podem aparecer no shell quando realmente ajudarem na orientação.

Cabeçalhos administrativos tendem a ser mais compactos que heroes de marketing porque o foco principal é operação e leitura de dados. Ainda assim, páginas introdutórias, estados especiais ou fluxos com forte necessidade de contexto podem usar composições mais amplas.

Filtros, controles de período e ações específicas do módulo podem ficar próximos ao cabeçalho ou à área que controlam. O importante é deixar claro o alcance da ação e evitar repetição que não acrescente informação.

### Design system administrativo

Para novas estruturas administrativas, preferimos componentes e classes `admin-*` quando isso melhora ownership e previsibilidade do CSS.

Primitivas comuns incluem conceitos equivalentes a:

- página;
- cabeçalho de página;
- painel;
- card de métrica;
- alerta;
- badge de estado;
- tabela ou lista operacional.

Os nomes concretos podem variar. Não é necessário criar um componente novo apenas para satisfazer nomenclatura se a abstração existente já resolver bem o problema.

Quando houver token `--admin-*` adequado, ele é preferível a valores visuais duplicados. Valores específicos continuam aceitáveis quando representam uma necessidade própria do componente e não justificam um token global.

As cores semânticas servem como orientação de significado:

- `success`: saudável, concluído ou resultado positivo comprovado;
- `warning`: atenção ou condição que merece análise;
- `danger`: erro, falha ou risco relevante;
- `info`: informação operacional neutra.

O rosa de marca pode coexistir com essas cores. A escolha deve priorizar entendimento, contraste e consistência.

### Evolução do legado visual

O Admin ainda possui componentes que usam classes `workspace-*` e estilos anteriores. A migração pode acontecer gradualmente.

Quando uma área for alterada, vale avaliar se migrar o trecho tocado para primitives `admin-*` simplifica a arquitetura. Se a migração aumentar muito o risco ou o tamanho do patch sem benefício proporcional, manter temporariamente a compatibilidade é aceitável.

Como boas práticas:

- manter compatibilidades visuais do Admin escopadas dentro de `.admin-shell` quando possível;
- evitar criar dependências novas e desnecessárias entre o Admin e o workspace profissional;
- manter estilos específicos de marketing, saúde do SaaS e WhatsApp próximos das funcionalidades que os utilizam;
- consumir tokens administrativos quando isso reduzir duplicação e melhorar consistência;
- não alterar métricas, contratos de API ou regras de negócio apenas para acomodar uma mudança visual.

O objetivo da migração é reduzir acoplamento com segurança, não atingir uma porcentagem arbitrária de classes `admin-*`.

## Responsividade e acessibilidade

Mobile, Safari/WebKit e acessibilidade fazem parte da definição de qualidade do frontend.

Ao criar ou alterar uma interface, é útil verificar:

- leitura e navegação em telas pequenas;
- ausência de conteúdo essencial encoberto por barras fixas;
- foco visível e navegação por teclado quando aplicável;
- contraste suficiente;
- estados de carregamento, vazio, erro e sucesso;
- componentes que possam quebrar com textos maiores ou dados reais;
- comportamento em WebKit quando a implementação usa recursos sensíveis de layout, `sticky`, `fixed`, blur ou safe-area.

A forma de resolver esses pontos pode variar conforme o componente.

## Horários profissionais

A configuração de horários pertence ao contexto profissional e deve favorecer leitura e edição sem esforço desnecessário.

Como referência, buscamos:

- dias ativos e fechados facilmente distinguíveis;
- horários de início e fim legíveis;
- campos de pausa que não escondam o valor `HH:MM`;
- composição mobile sem scroll horizontal desnecessário;
- ajustes avançados visualmente secundários quando não forem a tarefa principal;
- ação de salvar acessível sem cobrir controles importantes.

Essas orientações não alteram as regras de disponibilidade. A disponibilidade real continua sendo validada pelas regras canônicas do backend.

## Como usar este documento

Este documento ajuda a responder três perguntas durante uma mudança de frontend:

1. a solução deixa claro em qual contexto a pessoa está?
2. ela preserva segurança, contratos e fluxos que já funcionam?
3. a escolha visual melhora a tarefa sem introduzir acoplamento ou complexidade desnecessária?

Quando houver mais de uma solução razoável, a implementação mais simples, testável e coerente com o produto costuma ser a melhor escolha. Decisões relevantes podem atualizar este documento quando a direção do produto ou da arquitetura mudar de forma durável.
