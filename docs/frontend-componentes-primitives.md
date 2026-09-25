# Componentes e primitives do frontend — Agenda Fashion

> **Papel documental:** referência especializada para ownership, reutilização e
> criação de componentes React compartilhados no frontend.
>
> A arquitetura geral fica em
> [`frontend-arquitetura.md`](./frontend-arquitetura.md), o mapa de telas em
> [`frontend-mapa-telas-jornadas.md`](./frontend-mapa-telas-jornadas.md) e o
> ownership de CSS em [`frontend-estilos.md`](./frontend-estilos.md).

## 1. Objetivo

Este documento evita dois problemas opostos:

1. duplicar componentes que já resolvem bem um padrão recorrente;
2. transformar qualquer trecho visual em uma "primitive global" sem ownership
   claro.

A pasta `frontend/src/components/` contém componentes com níveis diferentes de
generalidade. Estar nessa pasta não significa que o componente seja genérico.

A regra principal é:

> reutilizar quando o contrato visual e comportamental é realmente o mesmo;
> extrair quando existe ganho claro de ownership, teste ou manutenção; manter
> local quando a abstração aumentaria acoplamento.

## 2. Classificação de componentes

Para manutenção, usamos quatro classes conceituais.

| Classe | Significado | Exemplos atuais |
| --- | --- | --- |
| Primitive neutra | resolve um comportamento pequeno e reutilizável sem regra de domínio forte | `BackLink`, `AppIcon`, partes de `WorkspaceNavigation` |
| Primitive de produto | padrão compartilhado, mas com identidade/semântica AF | `ScreenState`, `BrandProgressMark`, `FlowSteps`, `MediaThumb` |
| Componente de domínio | reutiliza UI, mas conhece regras/semântica de um domínio | `PublicShareButton`, `BusinessCard`, `ServiceCard`, `BookingFlow` |
| Infraestrutura React | não é UI de feature; integra runtime, sessão, analytics ou recuperação | `ErrorBoundary`, `FirstPartyAnalyticsBridge`, `MetaAdsBridge`, `GoogleLoginButton` |

A classificação é sobre responsabilidade, não sobre diretório físico.

## 3. Inventário rápido

### Fundação e feedback

- `ScreenState.jsx`
  - `LoadingState`;
  - `EmptyState`;
  - `ErrorState`.
- `ErrorBoundary.jsx`
- `BackLink.jsx`
- `ConfirmationIcon.jsx`
- `AppIcon.jsx`

### Navegação e shell

- `AppHeader.jsx`
- `WorkspaceNavigation.jsx`
- `workspaceNavigation.js`
- `OwnerShell.jsx`
- `ProfessionalShell.jsx`
- `AdminShell.jsx`
- `PublicShell.jsx`
- `LegalFooter.jsx`

### Marca e progresso

- `BrandProgressMark.jsx`
- `FlowSteps.jsx`

### Descoberta e mídia

- `BusinessCard.jsx`
- `ServiceCard.jsx`
- `profile/MediaThumb.jsx`
- `profile/ProfileHero.jsx`

### Booking e compartilhamento

- `profile/BookingFlow.jsx`
- `PublicShareButton.jsx`

### Integrações e observabilidade

- `FirstPartyAnalyticsBridge.jsx`
- `MetaAdsBridge.jsx`
- `GoogleLoginButton.jsx`

Componentes administrativos e de growth específicos, como painéis de custos,
métricas e sincronização, continuam pertencendo ao domínio Admin/Marketing e não
devem ser promovidos automaticamente a primitives globais.

## 4. ScreenState

Arquivo:

```text
frontend/src/components/ScreenState.jsx
```

### LoadingState

Contrato atual:

```jsx
<LoadingState>Carregando sua conta...</LoadingState>
```

Características:

- usa `role="status"`;
- inclui spinner decorativo;
- aceita conteúdo textual por `children`;
- possui texto padrão `Carregando...`.

Use quando a tela ou seção ainda não possui dados suficientes para renderizar o
conteúdo principal.

Não use para uma mutação pequena que pode manter o restante da página visível.
Nesse caso, prefira feedback local no botão/controle.

### EmptyState

Contrato:

```jsx
<EmptyState
  title="Nenhum item"
  action={...}
>
  Explique o que significa e o próximo passo.
</EmptyState>
```

Use quando a leitura foi concluída com sucesso e o resultado realmente está
vazio.

Não use `EmptyState` para falha de API, permissão negada ou estado ainda
carregando.

### ErrorState

Contrato:

```jsx
<ErrorState
  message={mensagem}
  onRetry={recarregar}
/>
```

Características:

- `role="alert"`;
- título padrão;
- retry opcional.

Use para erro recuperável de leitura quando repetir a operação faz sentido.

Não use como substituto para erros de formulário específicos de campo nem para
falhas fatais de renderização.

## 5. ErrorBoundary

`ErrorBoundary` protege a árvore React no topo da aplicação.

Quando uma falha inesperada de renderização ocorre:

- registra a falha no console;
- tenta detectar assets obsoletos por `runtimeRecovery`;
- troca a tela por um estado fatal;
- oferece atualização da página;
- oferece retorno ao início.

Esse componente não substitui tratamento de erro de API.

Regra:

```text
erro esperado de rede/regra
  → tratar na feature

erro inesperado de renderização/runtime
  → ErrorBoundary
```

Ao criar um novo fluxo, não lançar erro deliberadamente para acionar o
`ErrorBoundary` quando existe um estado de UI recuperável.

## 6. AppIcon

`AppIcon` é a primitive atual de ícones SVG usada principalmente em navegação
operacional.

Ícones atuais incluem conceitos como:

- conta;
- negócio;
- calendário;
- relógio;
- custos;
- funil;
- início;
- saúde;
- marketing;
- mais;
- plano;
- serviços;
- equipe;
- WhatsApp.

Os SVGs são decorativos por padrão:

```text
aria-hidden="true"
focusable="false"
```

Portanto, o significado acessível deve vir do botão, link ou rótulo que contém o
ícone.

### Atenção ao fallback

Quando o nome não existe, `AppIcon` usa atualmente o ícone de `services`
como fallback.

Por isso:

- não inventar um nome sem adicionar o ícone correspondente;
- não depender do fallback como comportamento semântico;
- ao adicionar um ícone, testar o contexto em que ele será lido.

## 7. ConfirmationIcon

`ConfirmationIcon` representa conclusão/seleção confirmada em fluxos como
booking.

Ele é decorativo e deve acompanhar texto, estado ou `aria-current` quando o
significado for importante.

O componente possui cores próprias no SVG atual. Ele não deve virar uma
primitive de status genérica para sucesso, warning e erro sem uma evolução
deliberada do contrato.

## 8. BackLink

`BackLink` encapsula o padrão simples:

```jsx
<BackLink to="/destino">
  Voltar
</BackLink>
```

Use quando existe um destino determinístico dentro da aplicação.

Não use automaticamente `navigate(-1)` quando o fluxo exige retorno previsível
ou quando a pessoa pode ter aberto a página por link externo.

## 9. BrandProgressMark

`BrandProgressMark` transforma o símbolo visual do AF em indicador de
progresso.

Props principais:

- `current`;
- `total`;
- `complete`;
- `className`.

O componente normaliza limites e calcula quantas partes do símbolo recebem estado
ativo.

Use quando o progresso de jornada deve reforçar a identidade AF.

Não use como substituto de texto. O componente já fornece `aria-label`, mas a
tela deve continuar explicando qual etapa está ativa.

## 10. FlowSteps

`FlowSteps` é a primitive de etapas lineares usada no booking e pode receber
uma lista customizada.

Contrato:

```jsx
<FlowSteps
  current={2}
  steps={["Serviço", "Horário", "Confirmar"]}
/>
```

Comportamentos:

- indica `Etapa X de N`;
- marca etapas anteriores como concluídas;
- usa `aria-current="step"` na etapa atual;
- adapta a quantidade via custom property `--flow-step-count`.

O default atual é orientado ao booking:

```text
Serviço → Profissional → Horário → Confirmar
```

Portanto, em outra jornada, passe `steps` explicitamente.

Não criar um segundo stepper apenas por diferença de labels ou quantidade, a
menos que o comportamento visual/semântico realmente seja diferente.

## 11. MediaThumb

Arquivo:

```text
frontend/src/components/profile/MediaThumb.jsx
```

É a primitive preferida para thumbnail/avatar quando existe:

- URL remota opcional;
- fallback visual;
- retry/normalização de mídia via `useRetryingMedia`.

Props relevantes:

- `src`;
- `alt`;
- `className`;
- `emoji`;
- `loading`;
- `fetchPriority`.

Quando existe imagem, o `alt` é aplicado ao `img`. Quando não existe, o
fallback é decorativo.

Use para avatar/foto simples.

Não use quando o layout exige composição própria de cover, backdrop desfocado,
`object-fit` específico ou múltiplas camadas de imagem. `BusinessCard` e
`ServiceCard` são exemplos de composição mais especializada.

## 12. WorkspaceNavigation

`WorkspaceNavigation.jsx` é a primitive neutra compartilhada entre os
workspaces da dona e da profissional.

Expõe:

- `WorkspaceLinks`;
- `MobileWorkspaceNavigation`.

O comportamento de rota ativa e divisão do menu mobile é apoiado por
`workspaceNavigation.js`.

### WorkspaceLinks

Recebe uma lista no formato:

```js
[
  ["/rota", "Rótulo", "icone"]
]
```

Usa `NavLink` e delega semântica visual às classes de shell/contexto.

### MobileWorkspaceNavigation

Responsabilidades:

- mostrar os primeiros links diretamente;
- agrupar excedentes em `Mais`;
- fechar menu após navegação;
- fechar ao clicar fora;
- fechar com `Escape`;
- devolver foco ao botão ao fechar por teclado;
- indicar quando uma rota secundária está ativa.

Esse comportamento é deliberadamente compartilhado entre dona e profissional.

Não mover identidade visual do `OwnerShell` para essa primitive. Ela deve
continuar neutra.

## 13. workspaceNavigation.js

A lógica de navegação fora do JSX fica em
`frontend/src/components/workspaceNavigation.js`.

Hoje ela concentra:

- rotas que exigem match exato;
- divisão entre links primários e secundários;
- resolução manual de rota ativa para o menu `Mais`.

Ao alterar a hierarquia de navegação, revisar esse utilitário junto com os links
dos shells.

Não duplicar a regra de "rota ativa" em cada shell.

## 14. AppHeader

`AppHeader` é um componente global sensível ao contexto.

Ele resolve diferenças entre:

- home;
- landing profissional;
- público/cliente;
- área de negócio/profissional;
- Admin;
- pessoa autenticada ou visitante.

Também contém:

- marca;
- navegação pública;
- busca;
- menu de conta;
- atalhos para convites;
- entrada em workspace/Admin;
- logout.

Por essa quantidade de responsabilidade, ele não deve ser tratado como primitive
pequena.

Ao alterar `AppHeader`, testar pelo menos:

- visitante na home;
- visitante em `/para-profissionais`;
- cliente autenticada;
- conta com negócio;
- Admin;
- `/conta` em contextos diferentes;
- mobile.

Antes de adicionar lógica nova ao header, avaliar se a responsabilidade pertence
ao shell contextual em vez de aumentar o componente global.

## 15. OwnerShell e ProfessionalShell

Os shells são componentes de composição, não primitives genéricas.

Eles compartilham apenas comportamento de navegação neutro.

### OwnerShell

Owns:

- identidade da área da dona;
- contexto do negócio;
- sidebar;
- topbar;
- acesso ao perfil público;
- área de conteúdo;
- navegação mobile.

### ProfessionalShell

Owns:

- identidade da área profissional;
- contexto do negócio;
- navegação curta;
- topbar;
- área de conteúdo;
- navegação mobile.

Não introduzir controles da dona no `ProfessionalShell` apenas por conveniência
de código.

A separação de contexto é uma decisão de produto/UX.

## 16. PublicShell e AdminShell

`PublicShell` e `AdminShell` também são composições contextuais.

### PublicShell

Marca a raiz pública e aplica ownership visual público sem conceder permissão.

### AdminShell

Owns a navegação e composição operacional do Admin.

Componentes específicos do Admin podem consumir primitives administrativas, mas
não devem forçar o design system Admin sobre páginas públicas ou workspaces.

## 17. LegalFooter

`LegalFooter` é compartilhado globalmente e adapta o texto ao Admin.

Ele fornece:

- copyright dinâmico;
- link de Privacidade;
- Termos de uso;
- e-mail de suporte.

Links legais não devem ser duplicados manualmente em cada tela quando o footer
global já atende ao caso.

Fluxos que legalmente precisam de contexto adicional, como checkout ou
consentimento, podem exibir links próximos da ação além do footer.

## 18. BusinessCard

`BusinessCard` é um componente de domínio de descoberta.

Conhece conceitos como:

- disponibilidade de serviços;
- especialidades;
- avaliação;
- localização;
- origem de descoberta;
- construção do link de perfil;
- cover/fallback por categoria.

Por isso, não deve virar um `Card` genérico.

Use `BusinessCard` quando a entidade é um negócio na descoberta pública.

Se uma tela interna precisa exibir um negócio operacionalmente, crie uma
composição adequada ao contexto em vez de adicionar dezenas de props ao card
público.

## 19. ServiceCard

`ServiceCard` é o card público de serviço na descoberta.

Responsabilidades atuais:

- imagem/fallback de categoria;
- categoria;
- descrição;
- negócio;
- localização;
- duração;
- preço;
- estado de agenda online;
- destino de perfil ou booking;
- preservação da origem de descoberta.

Também conhece catálogo local e rastreamento da origem no link.

Use para resultado público de serviço.

Não usar como editor/linha de serviço do painel da dona.

## 20. PublicShareButton

`PublicShareButton` é um componente de domínio, não apenas um botão visual.

Ele concentra:

- construção do link público;
- parâmetros próprios de aquisição;
- compartilhamento nativo;
- fallback de cópia;
- estado `busy/copied/shared/error`;
- texto/título de compartilhamento;
- eventos de analytics;
- diferenciação entre negócio e serviço.

Modos atuais:

- `share`;
- `copy`.

Use este componente para compartilhar negócio/serviço em vez de criar um novo
mecanismo com `navigator.share` diretamente.

Motivo: o componente preserva link rastreável e instrumentação.

Observabilidade opcional em `onIntent` é fail-soft e não pode bloquear o
compartilhamento.

## 21. BookingFlow

`BookingFlow` é a composição principal do booking dentro do perfil público.

Ele não é uma primitive genérica de formulário.

Responsabilidades:

- seleção de serviço;
- seleção de profissional quando necessária;
- seleção de data/horário;
- resumo do booking;
- stepper;
- estado de edição de escolhas concluídas;
- compartilhamento secundário de serviço;
- tratamento de disponibilidade;
- CTA para revisão/confirmação.

### Profissional única

O componente calcula:

```text
professionals.length === 1
```

e remove a etapa de escolha redundante.

Essa regra é de UX e permanece subordinada à elegibilidade calculada pelo
backend.

### Estados de disponibilidade

O booking reutiliza:

- `LoadingState`;
- `ErrorState`;
- `EmptyState`.

Esse é um bom exemplo de composição de domínio usando primitives menores em vez
de duplicar feedback assíncrono.

## 22. ProfileHero

`ProfileHero` é a composição de cabeçalho do perfil público.

Inclui:

- foto/fallback via `MediaThumb`;
- especialidades;
- descrição;
- localização;
- avaliação;
- favorito;
- compartilhamento;
- WhatsApp;
- mapa;
- distância opcional via geolocation.

Não extrair geolocalização para uma primitive global apenas porque existe aqui.
Primeiro deve existir outro caso real com o mesmo contrato de permissão, fallback
e apresentação.

Acesso à localização é opcional e nunca deve bloquear booking.

## 23. FirstPartyAnalyticsBridge

`FirstPartyAnalyticsBridge` não renderiza UI.

Ele observa mudanças do React Router e inicia page view na camada first-party.

Deve permanecer próximo da raiz da aplicação para não depender de cada página
lembrar de registrar navegação.

Não disparar um segundo page view genérico manualmente dentro de páginas sem
verificar o contrato dessa bridge.

## 24. MetaAdsBridge

Apesar do nome histórico, `MetaAdsBridge` atualmente coordena consentimento e
medição de:

- Meta;
- Google Measurement;
- sincronização de consentimento;
- page views permitidos;
- banner de consentimento;
- aviso de sincronização pendente;
- atalho de privacidade.

Também bloqueia medição em rotas consideradas sensíveis ou administrativas de
acordo com o contrato atual.

É infraestrutura de privacidade/marketing, não componente reutilizável de tela.

Mudanças nele exigem revisão de:

- consentimento;
- privacidade;
- atribuição;
- rotas sensíveis;
- fail-soft;
- testes das integrações.

Não adicionar nova plataforma de anúncios diretamente a uma página. A
integração deve seguir o ownership da camada de analytics/consentimento.

## 25. GoogleLoginButton

`GoogleLoginButton` encapsula a integração visual com Google Identity Services.

Responsabilidades:

- obter configuração pública do backend;
- carregar o script oficial;
- inicializar a biblioteca;
- renderizar o botão;
- entregar credential ao chamador;
- esconder o recurso quando a integração não está disponível.

A autenticação real continua no fluxo de sessão/backend.

Não replicar carregamento do script Google em outra tela.

## 26. Quando reutilizar

Reutilize um componente existente quando estas condições forem verdadeiras em
conjunto:

1. a entidade/semântica é a mesma;
2. o comportamento de interação é o mesmo;
3. loading/erro/sucesso têm o mesmo contrato;
4. a diferença visual pode ser expressa pela API existente sem criar flags
   contraditórias;
5. o componente continua pertencendo ao mesmo contexto ou possui ownership
   neutro;
6. a reutilização preserva acessibilidade e analytics existentes.

Exemplos:

- novo estado vazio → avaliar `EmptyState`;
- novo thumbnail/avatar → avaliar `MediaThumb`;
- novo compartilhamento de perfil/serviço → `PublicShareButton`;
- nova navegação mobile de Owner/Professional → primitive existente;
- novo fluxo linear com mesma semântica de etapas → avaliar `FlowSteps`.

## 27. Quando não reutilizar

Não reutilize apenas para reduzir quantidade de arquivos quando isso exigir:

- prop booleana para cada tela;
- conhecimento de vários domínios incompatíveis;
- CSS condicional por rota espalhado no componente;
- regras financeiras/segurança no componente visual;
- callbacks que reimplementam completamente o comportamento;
- `if` por papel suficiente para transformar uma primitive em shell;
- analytics diferentes escondidos sob o mesmo componente.

Exemplo ruim conceitual:

```jsx
<Card
  admin
  booking
  owner
  compact
  financial
  client
  ...
/>
```

Uma abstração desse tipo reduz clareza em vez de reduzir duplicação.

## 28. Quando criar um componente novo

Crie componente novo quando houver pelo menos um ganho concreto:

- comportamento repetido;
- teste isolado importante;
- ownership visual claro;
- complexidade que está escondendo a intenção da página;
- integração externa que precisa ser encapsulada;
- primitive acessível que evita repetir semântica;
- composição de domínio usada em mais de um ponto coerente.

Antes de extrair, responder:

```text
qual responsabilidade estou nomeando?
quem será o dono?
a API do componente é menor que o código que estou escondendo?
ele conhece qual domínio?
como será testado?
```

Se essas respostas não estiverem claras, manter local pode ser melhor.

## 29. Props e contratos

Preferências:

- nomes orientados ao domínio;
- callbacks iniciados por `on...`;
- estado controlado quando a página precisa ser autoridade da seleção;
- estado local quando é puramente efêmero de apresentação;
- evitar props mutuamente contraditórias;
- usar valores default somente quando são semanticamente seguros.

Componentes não devem receber dados críticos apenas para "confiar" neles.

Exemplo: preço exibido pode vir da API, mas checkout continua revalidando o
preço no backend.

## 30. Estado local versus estado externo

Use estado local para:

- menu aberto/fechado;
- edição visual temporária;
- feedback de cópia;
- retry visual;
- controles sem impacto de domínio.

Suba o estado para a página/contexto quando:

- outra seção depende dele;
- rota/URL deve refletir a decisão;
- refresh precisa preservar a escolha;
- a mudança dispara carregamento remoto;
- a informação é parte real da jornada.

Não usar estado React local como persistência de regra de negócio.

## 31. Acessibilidade de primitives

Toda primitive compartilhada precisa ser mais rigorosa que um componente local,
porque o erro se multiplica.

Ao criar/revisar:

- botão real para ação;
- link real para navegação;
- `aria-label` somente quando o texto visível não basta;
- ícones decorativos com `aria-hidden`;
- `aria-current` em navegação/etapas quando aplicável;
- `aria-expanded` em menus expansíveis;
- foco devolvido quando menu modal/popover fecha por teclado quando necessário;
- `role="status"` para progresso não intrusivo;
- `role="alert"` para erro que exige atenção;
- `aria-live` para feedback assíncrono curto.

Não adicionar ARIA para compensar elemento HTML incorreto quando existe uma
semântica nativa melhor.

## 32. Mobile e WebKit

Componente compartilhado deve ser validado dentro da largura real do container,
não apenas em desktop amplo.

Atenção especial a:

- `position: fixed`;
- `sticky`;
- safe-area;
- overflow horizontal;
- menus ancorados;
- imagens;
- campos;
- foco visível;
- texto maior;
- orientação.

Se o comportamento depende do shell lateral, considerar container em vez de
inferir largura apenas pela viewport.

## 33. CSS de componente

Antes de adicionar classe/regra:

1. identificar se o dono é fundação, shell ou feature;
2. verificar token existente;
3. evitar seletor global para resolver detalhe local;
4. verificar cascata histórica;
5. validar se lazy loading da feature exige CSS contextual.

Componentes neutros não devem importar design system de contexto operacional
específico.

## 34. Testes proporcionais ao tipo

### Primitive simples

Testar semântica e interação principal.

Exemplos:

- link aponta para destino;
- botão chama callback;
- ARIA muda de acordo com estado.

### Navegação/shell

Testar:

- rota ativa;
- abertura/fechamento mobile;
- Escape;
- clique fora;
- contexto correto.

### Componente de domínio

Testar:

- estados relevantes da entidade;
- CTA correto;
- edge cases;
- integração com utilitários/analytics quando parte do contrato.

### Infraestrutura

Testar:

- fail-soft;
- rotas bloqueadas;
- ausência de configuração;
- recuperação;
- consentimento;
- eventos apenas quando autorizados.

Não perseguir cobertura numérica isolada. O teste deve proteger o risco real.

## 35. Anti-padrões a evitar

- criar `Button.jsx` genérico sem necessidade apenas para encapsular uma classe;
- duplicar `ScreenState` localmente;
- chamar `navigator.share` fora do contrato de `PublicShareButton` para o
  mesmo caso de negócio;
- criar outro menu mobile de Owner/Professional;
- colocar autorização real em shell/componente;
- importar CSS Admin em componente público;
- adicionar regra de negócio financeira em `PlansPage` ou card;
- duplicar formatação que já pertence a `utils/format.js`;
- criar componentes "universais" com dezenas de flags;
- mover componente só para adequar nome de pasta sem ganho técnico.

## 36. Critério para mover componente de pasta

Mover um componente só quando a nova localização representar melhor ownership e
o custo do patch for proporcional.

Exemplos possíveis:

- componente usado somente pelo perfil pode ficar em `components/profile/`;
- componente exclusivo do Admin pode permanecer próximo do Admin;
- primitive realmente transversal pode ficar no nível comum.

Antes de mover:

- localizar imports;
- verificar CSS;
- verificar testes;
- verificar lazy chunks;
- revisar dead-code/Knip;
- rodar build e testes afetados.

## 37. Checklist antes de criar uma nova primitive

Perguntas obrigatórias:

1. existe componente atual com contrato equivalente?
2. estou abstraindo comportamento ou apenas markup curto?
3. qual contexto será o owner?
4. essa API continuará simples com um segundo uso?
5. a primitive melhora acessibilidade?
6. ela preserva analytics existentes?
7. precisa de estado local?
8. precisa sobreviver a refresh/URL?
9. qual CSS é dono?
10. qual teste evitará regressão?

Se a resposta depender de "talvez no futuro", não antecipar a abstração.

## 38. Documentos relacionados

- [`frontend-arquitetura.md`](./frontend-arquitetura.md): arquitetura técnica;
- [`frontend-mapa-telas-jornadas.md`](./frontend-mapa-telas-jornadas.md):
  rotas e jornadas;
- [`frontend-estilos.md`](./frontend-estilos.md): CSS e ownership;
- [`ux-contextos-visuais.md`](./ux-contextos-visuais.md): semântica de
  contextos;
- [`public-shell.md`](./public-shell.md): shell público;
- [`qualidade-codigo.md`](./qualidade-codigo.md): guardrails de qualidade;
- [`marketing-attribution.md`](./marketing-attribution.md): atribuição;
- [`session-security.md`](./session-security.md): sessão e segurança.

## 39. Manutenção

Atualizar este documento quando:

- uma primitive compartilhada mudar de contrato;
- um componente de domínio passar a ser reutilizado estruturalmente;
- um comportamento comum for consolidado;
- ownership entre shell, feature e fundação mudar;
- uma integração de infraestrutura React mudar de responsabilidade.

Não atualizar por simples alteração de texto, cor ou espaçamento local.
