# Arquitetura de estilos do frontend

Este documento registra a direção atual para evoluir o CSS do Agenda Fashion sem exigir uma nova biblioteca visual ou uma reescrita do frontend.

Ele funciona como referência de ownership, carregamento e manutenção. A solução concreta pode variar quando acessibilidade, compatibilidade, simplicidade ou a tarefa da página justificarem uma composição diferente.

## Princípios

1. A experiência pública, profissional e de negócio preserva uma identidade reconhecível do Agenda Fashion sem exigir a mesma composição em todas as telas.
2. O Admin possui linguagem operacional própria, com densidade adequada para dados e identidade AF controlada por seu design system.
3. O contexto da dona possui shell e tokens próprios para gestão do negócio, podendo reutilizar primitivas neutras de navegação sem compartilhar ownership visual com o contexto profissional.
4. CSS global tende a concentrar fundações realmente compartilhadas; estilos exclusivos de uma feature ou contexto preferem ficar próximos do seu dono quando isso simplifica ownership e carregamento.
5. Componentes em workspaces com sidebar devem considerar a largura útil real do conteúdo. `container queries` são uma boa opção quando o comportamento depende do container; `media queries` continuam adequadas para viewport, mobile, safe areas e orientação.
6. Evitamos criar sucessivas camadas de versão (`v4`, `v5`, etc.) apenas para sobrepor estilos anteriores. Quando possível, consolidamos a responsabilidade existente.
7. Tokens do contexto são preferíveis quando reduzem duplicação e dão significado consistente, mas um componente pode manter valores específicos quando não existe benefício real em promover tudo a token global.

Mais detalhes sobre contextos visuais ficam em [`ux-contextos-visuais.md`](./ux-contextos-visuais.md).

## Admin e design system

O `AdminShell` fornece a estrutura global do contexto administrativo e os tokens `--admin-*`. A direção atual é um **Command Center do AF**: operação e leitura de dados em primeiro plano, grafite como base de navegação, rosa de marca como assinatura e cores semânticas quando ajudam a interpretar estado.

O design system não obriga todas as páginas a terem a mesma composição. Ele oferece uma fundação comum para superfícies, bordas, foco, raios, estados e componentes recorrentes.

Os seis módulos principais recebem layout e densidade diretamente das camadas administrativas. Compatibilidade com classes históricas pode permanecer em features antigas quando uma migração ampla não trouxer benefício proporcional.

Ao alterar uma tela administrativa, vale avaliar se o trecho tocado pode consumir tokens ou primitives `admin-*` sem aumentar desnecessariamente o tamanho e o risco do patch.

O objetivo é reduzir acoplamento e inconsistência gradualmente, não atingir uma porcentagem arbitrária de classes novas.

## Dona do negócio e OwnerShell

O `OwnerShell` concentra o contexto de gestão das rotas `/painel/*`. Sua identidade visual é mais próxima do produto principal do que a do Admin, mas possui ownership próprio por meio de `owner-shell.css`, `owner-design-system.css` e tokens `--owner-*`.

A navegação compartilhada foi isolada em uma primitive neutra para evitar duplicar lógica de rota ativa, menu mobile, clique fora e `Escape`. Reutilizar essa lógica não torna o shell visualmente dependente do workspace profissional.

O CSS do OwnerShell é carregado de forma contextual junto com o shell da dona, em vez de entrar diretamente no `main.jsx`. As páginas internas podem continuar usando classes históricas enquanto o design system da dona fornece uma ponte escopada ao contexto; a migração das features pode acontecer quando houver ganho real de clareza ou manutenção.

## Marketing administrativo

As antigas camadas `admin-marketing-professional.css`, `admin-marketing-v2.css` e `admin-marketing-v3.css` foram consolidadas sob a entrada canônica `frontend/src/styles/admin-marketing.css`.

Os módulos internos em `frontend/src/styles/admin-marketing/` são organizados por responsabilidade:

- `campaigns-mobile.css`: ajustes específicos de campanhas em telas estreitas;
- `core.css`: fundações compartilhadas das telas administrativas de Marketing;
- `reporting.css`: relatórios, custos, funil, gráficos e tabelas;
- `command.css`: visão geral, sincronização, campanhas e GA4;
- `overview.css`: jornada, confiabilidade, refinamentos do overview e responsividade baseada em container;
- `theme.css`: integração da feature com os tokens do contexto administrativo.

O restante da aplicação importa `admin-marketing.css`; os módulos internos são detalhes de implementação da feature.

Nomes antigos de seletores e custom properties podem permanecer enquanto houver markup dependente deles. Quando um componente for tocado, renomear ou consolidar pode ser útil se reduzir dívida sem transformar uma melhoria local em reescrita ampla.

## Estilos específicos das rotas

Páginas carregadas por `React.lazy` podem manter refinamentos visuais fora de `main.jsx` quando o CSS pertence claramente àquela feature. Carregar página e estilo juntos ajuda a evitar CSS global desnecessário e flash de conteúdo sem estilo.

O projeto já usa esse padrão em áreas como:

- `DashboardPage`: `dashboard-polish.css`;
- `AgendaWorkspacePage`: `agenda-polish.css`;
- `ScheduleSettingsPage`: `schedule-polish.css`;
- `ServicesPage` e `ServiceEditorPage`: estilos de mídia e catálogo de serviços;
- `BusinessPage`: `business-polish.css`;
- `SubscriptionPage`: `subscription-polish.css`;
- `PlansPage`: `plans-polish.css`;
- `AdminSaasHealthPage`: `admin-saas-health.css`;
- `AdminWhatsAppPage`: `admin-whatsapp.css`;
- `OwnerShell`: `owner-shell.css`, que importa seu design system contextual.

`admin-refinements.css` pertence ao contexto administrativo e deve permanecer fora do bundle profissional enquanto seus seletores forem exclusivos do Admin.

Antes de mover um arquivo somente pelo nome, é melhor verificar seletores compartilhados, componentes usados em mais de uma rota e a ordem da cascata. Arquivos que atravessam contextos podem continuar globais até existir uma separação segura e útil.

O teste `tests/frontend-route-css-regressoes.test.js` protege o ownership já migrado. O smoke test `frontend/e2e/route-css-smoke.spec.js` verifica no navegador que CSS exclusivo é solicitado nas rotas esperadas.

## Responsividade

O Admin, o OwnerShell e os workspaces possuem áreas úteis menores que a viewport quando existe navegação lateral. Para componentes sensíveis a esse espaço, medir o container costuma produzir um comportamento mais previsível que aumentar breakpoints globais apenas para esconder overflow.

Testes em larguras intermediárias continuam importantes, além de mobile e desktop amplo. WebKit merece atenção especial para `sticky`, `fixed`, safe-area, blur e combinações de overflow.

Não existe obrigação de converter toda tabela em um único padrão mobile. A composição pode ser tabela, cards, lista ou outro formato desde que a tarefa permaneça legível, navegável e sem conteúdo essencial inacessível.

## Cascata histórica

`index.css` continua como uma fundação importante da aplicação. `af-experience.css` ainda contém regras históricas que participam da cascata em várias rotas.

Novas mudanças devem evitar duplicar fundações sem necessidade. A remoção de sobreposições antigas pode acontecer por grupos de componentes, com testes e revisão visual proporcionais ao risco, em vez de uma limpeza total de CSS feita de uma vez.

## Componentes, utilitários e formatação

Conversões e formatações compartilhadas permanecem em `frontend/src/utils/format.js` quando forem realmente reutilizáveis. Componentes administrativos e de recorrência podem reutilizar `toFiniteNumber` para normalizar números recebidos pela API em vez de manter cópias locais equivalentes.

Páginas podem concentrar carregamento, estado e composição. Tabelas extensas ou regras puramente de apresentação tendem a ficar mais fáceis de testar quando extraídas para componentes ou utilitários próprios, mas a extração deve ocorrer quando houver ganho de clareza e não apenas para aumentar o número de arquivos.

Exemplos atuais incluem `ProfessionalCampaignDecisionTable`, `professionalCampaigns.js`, `MarketingCampaignCostTable`, `MarketingExpenseHistory` e `marketingCosts.js`.

## Critério de manutenção

Antes de adicionar ou mover CSS, vale responder:

- quem é o dono do estilo: fundação, shell ou feature?
- existe token ou primitive do contexto que reduz duplicação?
- a regra depende da viewport ou da largura do container?
- a mudança pode afetar outra rota pela cascata?
- manter compatibilidade temporária é mais seguro do que uma refatoração ampla agora?
- quais larguras, navegadores e estados precisam de validação?

A opção preferida é a que mantém a interface clara e o ownership compreensível com o menor acoplamento e complexidade necessários.
