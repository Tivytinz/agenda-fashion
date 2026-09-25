# QA e prontidão do frontend — Agenda Fashion

> **Papel documental:** referência técnica especializada para estratégia de
> testes, acessibilidade, mobile/WebKit, performance e critérios de prontidão de
> mudanças do frontend.
>
> Este documento descreve o estado executável atual e o processo de validação.
> Não substitui os contratos de produto nem transforma evidência histórica em
> garantia automática para commits futuros.

## 1. Objetivo

Uma mudança de frontend só está pronta quando existe evidência proporcional ao
risco de que ela:

- preserva o fluxo funcional;
- não quebra autenticação, autorização ou contexto;
- mantém estados de loading, vazio, erro e sucesso;
- funciona em celular;
- preserva Safari/WebKit quando aplicável;
- mantém acessibilidade;
- não cria overflow ou ação inacessível;
- não degrada a cadeia crítica de performance quando afetada;
- não quebra analytics ou integrações relevantes;
- possui teste automatizado adequado ao risco.

O objetivo não é maximizar quantidade de testes. O objetivo é proteger
comportamentos que custariam caro se regredissem.

## 2. Fontes de verdade para QA

A validação deve ser feita contra:

1. código executável;
2. migrations e contratos do backend quando a tela depende deles;
3. testes atuais;
4. documentação canônica do domínio;
5. critérios não funcionais e runbooks.

Documentos importantes:

- [`qualidade-codigo.md`](./qualidade-codigo.md);
- [`performance-qa.md`](./performance-qa.md);
- [`frontend-arquitetura.md`](./frontend-arquitetura.md);
- [`frontend-mapa-telas-jornadas.md`](./frontend-mapa-telas-jornadas.md);
- [`frontend-componentes-primitives.md`](./frontend-componentes-primitives.md);
- [`frontend-formularios-estado-api.md`](./frontend-formularios-estado-api.md);
- [`frontend-analytics-observabilidade.md`](./frontend-analytics-observabilidade.md);
- [`frontend-seguranca.md`](./frontend-seguranca.md);
- [`frontend-entrega-runtime.md`](./frontend-entrega-runtime.md);
- [`ux-contextos-visuais.md`](./ux-contextos-visuais.md);
- [`public-shell.md`](./public-shell.md).

## 3. Camadas de teste atuais

O frontend usa principalmente quatro camadas.

| Camada | Ferramenta | Papel |
| --- | --- | --- |
| utilitários e lógica | Vitest | funções puras, formatação, navegação, analytics, storage |
| componente/página | Vitest + Testing Library + jsdom | render, interação, estados, payloads e regressões |
| jornada/browser | Playwright | fluxo real, responsividade, WebKit, foco, overflow e integração de páginas |
| performance | scripts + Lighthouse | p95 da API e LCP de páginas públicas críticas |

Lint, dead-code, build e auditoria de dependências complementam essas camadas.

## 4. Vitest e Testing Library

O comando canônico é:

```bash
npm --prefix frontend test
```

No CI do repositório, o wrapper raiz também executa os testes do frontend.

Os testes de componentes/páginas usam majoritariamente:

- `vitest`;
- `@testing-library/react`;
- `@testing-library/user-event` quando necessário;
- ambiente `jsdom`.

O padrão é testar comportamento observável, não detalhes internos de React.

## 5. O que testar com Vitest

Vitest é adequado para:

- função pura;
- serialização/normalização;
- estados derivados;
- componente isolado;
- página com APIs mockadas;
- redirecionamento de router em memória;
- payload enviado;
- reação a erro HTTP;
- session refresh;
- analytics com mocks;
- regressão específica;
- idempotency key no cliente;
- timeout/abort no cliente HTTP.

Evite usar Playwright para tudo quando o risco pode ser protegido de forma mais
rápida e determinística em Vitest.

## 6. Exemplos reais de contratos unitários/integrados

### Cliente HTTP

`frontend/src/api/client.test.js` protege:

- envio de cookies com `credentials: "include"`;
- limpeza da sessão em 401;
- emissão do evento de sessão expirada;
- timeout convertido em erro 408 amigável.

### ProtectedRoute

Os testes protegem, entre outros:

- Admin versus conta comum;
- visitante versus rota autenticada;
- preservação da intenção de plano;
- redirecionamento para criação de negócio;
- bloqueio de checkout quando o negócio ainda não está publicado.

Isso valida UX de navegação. A autorização real continua no backend.

### SessionContext

Há cobertura para:

- expiração da sessão refletida imediatamente na UI;
- logout local antes da confirmação de rede;
- tentativa de encerramento da sessão no servidor.

### Formulários

Exemplos de regressão:

- `BusinessPage.dirty-state.test.jsx` garante que autocomplete de CEP não cria
  falso estado de alteração;
- `ScheduleSettingsPage.regression.test.jsx` protege comportamento responsivo,
  fail-soft de compartilhamento e ausência de divulgação quando a publicação não
  foi confirmada.

### Checkout

`BillingPages.test.jsx` protege:

- reutilização da mesma `Idempotency-Key` em retry da mesma tentativa;
- preservação do `event_id`;
- normalização de CPF/CNPJ;
- retry de verificação;
- pagamento confirmado mas assinatura ainda ativando;
- estado que exige atenção operacional;
- timeout do polling;
- cópia do PIX.

Esses exemplos ilustram o critério: testar fatos importantes de domínio e risco,
não apenas markup.

## 7. Regressão nomeada

Quando um bug real for corrigido, prefira teste que descreva a regressão
específica.

Exemplos atuais:

```text
BusinessPage.dirty-state.test.jsx
ScheduleSettingsPage.regression.test.jsx
ServicesPage.coverGallery.test.jsx
appointments.lifecycle.test.js
```

Um teste de regressão deve falhar com o comportamento antigo e proteger a causa
corrigida.

Evite criar testes que apenas reproduzem implementação sem provar o bug.

## 8. Testes de utilitários

Funções de domínio pequeno e estável devem ser testadas fora de páginas quando
possível.

Exemplos atuais incluem:

- agenda;
- lifecycle de appointments;
- browser storage;
- formatação;
- catálogo local;
- atribuição;
- custos/métricas;
- mídia;
- planos;
- origem de perfil;
- links públicos;
- runtime recovery;
- especialidades.

Isso reduz repetição de cenários em páginas.

## 9. Playwright

O comando canônico é:

```bash
npm --prefix frontend run test:e2e
```

A configuração atual usa:

```text
frontend/playwright.config.js
```

Características:

- testes paralelos;
- `forbidOnly` no CI;
- 2 retries no CI;
- screenshot somente em falha;
- trace retido em falha;
- base URL local em `127.0.0.1:4173`.

O servidor usado pelo Playwright é iniciado pelo Vite.

## 10. Matriz mobile atual

Os projetos mobile são:

| Projeto | Engine | Viewport |
| --- | --- | --- |
| `webkit-360` | WebKit | 360 × 740 |
| `webkit-390` | WebKit | 390 × 844 |
| `webkit-430` | WebKit | 430 × 932 |
| `mobile-chromium` | Chromium | 390 × 844 |

A prioridade de WebKit é deliberada porque o produto precisa preservar a
experiência em Safari/iOS.

Não substituir toda a matriz por Chromium apenas porque o comportamento é mais
fácil de depurar.

## 11. Admin desktop

Há dois projetos adicionais para o cenário
`admin-desktop.spec.js`:

| Projeto | Engine | Viewport |
| --- | --- | --- |
| `desktop-chromium-admin` | Chromium | 1366 × 768 |
| `desktop-webkit-admin` | WebKit | 1366 × 768 |

Isso dá cobertura desktop explícita ao Admin sem transformar toda a suíte em
duplicação desktop.

Se uma feature pública/owner/profissional passa a depender fortemente de
comportamento desktop específico, adicionar cobertura proporcional em vez de
presumir que mobile cobre tudo.

## 12. Jornadas E2E existentes

A suíte atual possui cenários especializados para áreas como:

- acessibilidade crítica;
- Admin desktop;
- Admin mobile;
- operação Admin mobile;
- agendamento mobile;
- retenção paga;
- assinatura paga;
- ativação profissional;
- landing profissional;
- shell público;
- reagendamento/repetição de booking;
- carregamento de CSS por rota;
- onboarding de horários;
- workspace mobile.

A lista de arquivos é inventário de implementação, não contrato imutável. Novas
features críticas devem adicionar cenários quando o risco justificar.

## 13. Booking mobile crítico

`agendamento-mobile.spec.js` protege o caminho público:

```text
perfil
  → serviço
  → horário
  → revisar
  → confirmar dados
  → criar agendamento
  → sucesso
```

O cenário também verifica:

- imagem;
- foco por teclado;
- ausência de overflow horizontal;
- visibilidade dos horários;
- CTA dentro da viewport;
- política de cancelamento;
- confirmação final.

Esse fluxo é P0 porque conecta descoberta diretamente ao valor principal do AF.

## 14. Ativação profissional crítica

`professional-activation-flow.spec.js` cobre a primeira jornada profissional
com APIs controladas.

O teste protege a sequência e o estado que sustentam:

```text
cadastro profissional
  → negócio
  → serviço
  → publicação
  → horários
  → divulgação
  → primeiro agendamento
```

A disponibilidade continua diagnóstico/configuração e não volta a ser gate de
publicação.

Mudança em onboarding deve revisar esse E2E mesmo que a tela isolada possua
teste unitário.

## 15. Workspace mobile

`workspace-mobile.spec.js` protege comportamento de Owner e Professional.

Entre os contratos relevantes estão:

- contexto visual correto;
- rotina profissional curta;
- ausência de links de dona no workspace profissional;
- foco visível;
- ausência de overflow;
- próxima ação de ativação sem ruído desnecessário.

Mudanças de shell ou navegação precisam revisar esse arquivo.

## 16. PublicShell

`public-shell.spec.js` protege:

- marcador do contexto público;
- ausência dos shells operacionais na rota pública;
- header/footer;
- foco visível;
- ausência de overflow;
- controle de pausa da rotação automática do hero.

Esse teste conecta arquitetura de shell com requisitos de acessibilidade e
movimento.

## 17. CSS carregado por rota

Como o frontend usa lazy loading de CSS em rotas específicas,
`route-css-smoke.spec.js` verifica que estilos esperados estão ativos quando a
página renderiza.

Hoje existem cenários para áreas como:

- Planos;
- dashboard;
- Admin Saúde/ativação;
- WhatsApp Admin.

Esse tipo de teste protege regressões em que o JSX aparece, mas o chunk de CSS
não foi carregado ou ownership de estilo mudou.

Ao mover imports de CSS lazy, revisar esse smoke test.

## 18. Mock de rede no E2E

Os E2E usam `page.route` para estabilizar contratos de API em muitos cenários.

Isso permite:

- testar frontend sem depender de estado externo;
- controlar edge cases;
- verificar payload;
- simular 401/erro/estado financeiro;
- reproduzir jornada de forma determinística.

Esse mock não substitui testes backend/integração reais.

Quando um bug nasce na interação front↔backend, proteger as duas camadas quando
necessário.

## 19. Teste contra backend real

Nem toda feature precisa de browser + backend real em cada commit.

Use integração mais completa quando:

- contrato de endpoint mudou;
- serialização front↔backend é a causa do bug;
- autenticação/cookie precisa ser demonstrada;
- multipart/upload depende do servidor;
- concorrência de booking depende do banco;
- webhook/billing não pode ser representado apenas pelo navegador.

O repositório já executa migrations e testes backend na mesma quality gate.

## 20. Acessibilidade: objetivo

A meta do produto é WCAG 2.2 AA.

Isso é um **objetivo de conformidade**, não uma certificação automática gerada
por um único teste.

QA deve combinar:

- semântica HTML;
- testes automatizados direcionados;
- teclado;
- foco;
- contraste;
- estados de erro;
- movimento;
- validação manual quando a mudança visual/interativa justificar.

## 21. Acessibilidade automatizada atual

`accessibility-critical.spec.js` verifica na autenticação:

- labels acessíveis;
- navegação por teclado;
- foco perceptível;
- contraste mínimo de 4.5 para o CTA testado;
- mensagem de erro exposta como alert.

Outros E2E também verificam foco, ausência de overflow e controle de movimento.

Essa cobertura é importante, mas não equivale a uma varredura completa de todos
os critérios WCAG em todas as páginas.

Não declarar conformidade total apenas porque esse teste passou.

## 22. Semântica antes de ARIA

Preferências do projeto:

- `button` para ação;
- `a`/`Link` para navegação;
- `label` associado a input;
- `fieldset/legend` para grupos;
- heading hierárquico;
- `dialog` quando o comportamento é de diálogo;
- `progress` quando realmente representa progresso.

ARIA complementa semântica nativa; não deve ser usada para mascarar elemento
HTML incorreto.

## 23. Foco

Mudanças interativas precisam preservar:

- foco visível;
- ordem lógica;
- acionamento por teclado;
- retorno de foco quando um menu/popover fecha quando aplicável;
- foco não aprisionado indevidamente.

`WorkspaceNavigation` já devolve foco ao botão `Mais` quando fecha por
`Escape`.

Componentes compartilhados multiplicam impacto; regressão de foco neles exige
prioridade alta.

## 24. Contraste

O teste automatizado atual possui cálculo explícito de contraste para um CTA
crítico.

Ao mudar tokens de:

- texto;
- ação;
- fundo;
- foco;
- estado;

verificar contraste em contexto real.

Não assumir que uma cor isolada é acessível sem considerar o fundo final e o
tamanho/peso do texto.

## 25. Erro acessível

Erros devem ser apresentados no menor escopo correto.

Padrões atuais:

- `role="alert"` para erro importante;
- `role="status"`/`aria-live="polite"` para progresso ou sucesso;
- `aria-invalid` no campo quando aplicável;
- helper próximo ao input.

Erro visual sem nome acessível é regressão.

## 26. Movimento

O frontend possui regras de `prefers-reduced-motion` na fundação pública e o
hero público oferece controle explícito de pausa da rotação automática.

Mudanças com:

- carousel automático;
- animação contínua;
- smooth scroll;
- transição decorativa intensa;

devem considerar redução de movimento.

Não remover o controle de pausa do hero sem substituir o requisito de controle
de conteúdo em movimento.

## 27. Mobile first

A revisão visual parte do celular.

Mínimo prático para área pública e workspaces:

- 360 px;
- 390 px;
- 430 px;
- WebKit;
- Chromium móvel para comparação.

A implementação usa `responsive.css` como uma camada responsiva transversal,
mas CSS contextual também pode possuir media queries próprias.

Não corrigir uma página adicionando patch global no fim de
`responsive.css` sem avaliar o dono real do componente.

## 28. Overflow horizontal

Overflow horizontal não intencional é falha de UX crítica no mobile.

Vários E2E usam a relação:

```text
document.documentElement.scrollWidth
===
document.documentElement.clientWidth
```

para detectar regressão.

Exceção: componentes que possuem scroll horizontal **interno e deliberado**,
como rails/chips/carrosséis. O documento inteiro ainda não deve ficar mais largo
que a viewport.

## 29. Scroll horizontal deliberado

A base responsiva já trata componentes como:

- chips;
- datas;
- tabs;
- segmented controls;
- rails de serviço;

com overflow interno.

Quando um componente precisa rolagem lateral:

- dar pista visual de que existem mais itens;
- manter o container dentro da viewport;
- não esconder CTA principal;
- testar gesto/scroll no WebKit;
- não transformar toda a página em scroll horizontal.

## 30. Ação principal na viewport

Fluxos críticos precisam garantir que a ação principal continua alcançável.

O E2E de booking verifica que `Revisar e confirmar` cabe dentro da viewport no
momento crítico.

Esse tipo de asserção deve ser usado quando sticky/fixed/layout pode cobrir CTA.

Em outras telas, uma ação pode exigir scroll vertical normal; o problema é estar
encoberta ou inacessível, não simplesmente aparecer abaixo da dobra.

## 31. Safe area

A fundação usa `env(safe-area-inset-bottom)` na altura da navegação mobile do
workspace.

Mudanças em barras inferiores, fixed actions ou overlays devem testar iPhone/
WebKit e considerar safe area.

Não usar altura fixa que ignore o inset inferior quando o controle encosta na
borda da tela.

## 32. Imagens

QA de imagem deve verificar:

- dimensão/layout sem quebra;
- `alt` quando informativa;
- fallback quando ausente/erro;
- `loading` adequado;
- cover versus contain correto;
- imagem inteira quando esse for o contrato da tela;
- não gerar overflow;
- LCP quando a imagem é candidata crítica.

`MediaThumb` e `useRetryingMedia` já oferecem primitives para retry/fallback.

## 33. Safari/WebKit

Problemas com maior chance de divergência precisam ser vistos em WebKit:

- sticky/fixed;
- `100vh`/dvh;
- safe area;
- `dialog`;
- inputs de data/hora;
- scroll horizontal;
- backdrop-filter;
- focus ring;
- overflow/clip;
- upload/file input;
- APIs de compartilhamento/clipboard.

O Playwright WebKit é proteção automatizada; quando o bug for específico de
Safari real, validação manual no dispositivo pode continuar necessária.

## 34. Loading, vazio, erro e sucesso

Uma nova tela remota deve considerar explicitamente:

```text
loading
vazio
erro
sucesso
sessão expirada
```

Quando existe mutação:

```text
idle
submitting
sucesso
erro recuperável
```

O QA precisa testar os estados relevantes, não apenas o happy path.

## 35. Sessão expirada

A camada HTTP limpa a sessão ao receber 401.

QA de rota protegida deve validar que:

- dado sensível não permanece operável;
- UI deixa o estado autenticado;
- navegação leva ao fluxo apropriado;
- intenção segura pode ser preservada quando aplicável.

Não testar apenas redirect visual se a mudança toca o contrato de sessão.

## 36. Erro fatal

`ErrorBoundary` existe para evitar tela branca diante de erro inesperado de
renderização.

Há teste que garante:

- alert de falha;
- ação para atualizar;
- retorno ao início.

Erros esperados de API devem continuar tratados na feature, não ser convertidos
em erro fatal.

## 37. Runtime recovery

O runtime possui mecanismo de recuperação de assets obsoletos ligado ao
`ErrorBoundary`.

Mudança em lazy loading/chunks/runtime precisa revisar:

- import dinâmico;
- build;
- recuperação;
- teste de `runtimeRecovery`;
- comportamento de atualização.

Isso é especialmente relevante depois de deploy em que cliente possui HTML/JS
de versões diferentes em cache.

## 38. Lint

Comando:

```bash
npm --prefix frontend run lint
```

O ESLint trata imports/variáveis não usados como erro conforme a configuração
atual.

Não silenciar warning estrutural com exceção ampla só para passar o gate.

## 39. Dead code

Comando:

```bash
npm --prefix frontend run check:dead-code
```

A checagem usa Knip em modo production e foca atualmente em arquivos de produção
não alcançáveis.

Ela não é uma prova de que todo export ou dependência está sendo usado.

Ao remover/renomear feature, esse gate ajuda a detectar arquivos órfãos.

## 40. Build

Comando:

```bash
npm --prefix frontend run build
```

O build Vite precisa concluir depois de:

- mudança de import;
- nova rota lazy;
- alteração de CSS importado por chunk;
- asset;
- configuração;
- dependência.

Teste unitário verde não prova que o bundler consegue resolver todos os imports.

## 41. Auditoria de dependências

O quality gate executa:

```text
npm audit --audit-level=high
npm audit --omit=dev --audit-level=high
npm --prefix frontend audit --audit-level=high
```

Uma vulnerabilidade alta deve ser investigada pela dependência e superfície
afetada.

Não atualizar major version às cegas em um patch de segurança sem revisar
compatibilidade.

## 42. Quality gate do CI

A workflow `Backend CI` é disparada em:

- pull requests;
- push para `main`.

A ordem relevante inclui:

```text
install
  → lint frontend
  → dead-code frontend
  → build frontend
  → Vitest frontend
  → migrations/testes backend
  → audits
  → instalar Chromium/WebKit
  → Playwright
```

Falha deve ser tratada pela causa.

O processo do projeto exige CI verde antes de considerar merge seguro; a
configuração de proteção de branch/ruleset é um mecanismo separado e não deve ser
inferida apenas desta workflow.

## 43. Artifacts de falha

Quando o Playwright falha no CI, a workflow envia:

```text
frontend/test-results
```

como artifact com nome baseado no run.

Como a configuração retém trace e screenshot de falha, esses artifacts devem
ser analisados antes de simplesmente rerodar.

Rerun é apropriado quando existe evidência de flake/infra, não como substituto
de diagnóstico.

## 44. Flakiness

A configuração permite até 2 retries no CI.

Isso não transforma teste instável em teste saudável.

Se um teste passa apenas no retry com frequência:

- identificar race/timing;
- remover espera arbitrária;
- usar locator/expect eventual;
- estabilizar rede mockada;
- corrigir dependência de animação/tempo;
- revisar estado compartilhado.

Não aumentar retries para esconder flake.

## 45. Esperas

Preferir:

- `expect(locator).toBeVisible()`;
- `expect.poll`;
- resposta/estado observável;
- fake timers em Vitest quando apropriado.

Evitar `waitForTimeout` como sincronização principal.

Em polling de produto, o teste pode usar fake timers no nível Vitest ou estado
controlado no E2E.

## 46. Seletores de teste

Preferência:

1. role + accessible name;
2. label;
3. texto semântico;
4. test id quando não existe semântica estável;
5. classe CSS somente quando o objetivo do teste é estilo/layout.

Isso faz o teste refletir mais de perto a experiência acessível.

`route-css-smoke` é uma exceção legítima para classes/computed style porque o
objeto do teste é justamente o carregamento visual.

## 47. Dados de teste

Use dados explícitos e determinísticos.

Evitar:

- depender do relógio real quando o domínio é temporal;
- depender de ordem não garantida;
- usar conta real;
- usar produção para mutações;
- compartilhar estado entre testes.

E2E mockado deve deixar claro no arquivo quais estados de domínio estão sendo
simulados.

## 48. Testes financeiros

Fluxos financeiros requerem rigor maior.

Frontend deve proteger:

- idempotency key;
- mesma tentativa versus nova intenção;
- estados PENDING/CONFIRMED/ACTIVE;
- falha de polling;
- retry sem cobrança duplicada;
- retorno sem promoção falsa a pago.

Backend deve proteger:

- preço;
- plano;
- ownership;
- idempotência real;
- webhook;
- reconciliação;
- entitlement.

Teste de frontend não substitui esses testes backend.

## 49. Testes de booking

Mudanças em booking precisam considerar:

- serviço ativo;
- profissional elegível;
- única profissional versus múltiplas;
- slots;
- horário que some;
- concorrência;
- confirmação;
- cliente autenticada;
- visitante;
- política de cancelamento;
- sucesso;
- pós-booking.

A criação final e corrida de slot pertencem ao backend/banco; o browser protege
a jornada e mensagens.

## 50. Testes de ativação

Mudanças no onboarding precisam considerar:

- conta;
- negócio;
- campos obrigatórios;
- serviço ativo;
- publicação automática;
- horários sem virar gate;
- plano opcional;
- refresh;
- retorno;
- próxima ação;
- primeiro booking.

O E2E deve proteger a ordem de UX e o backend deve proteger as regras.

## 51. Testes de shell e papel

Mudança em navegação precisa considerar pelo menos:

```text
cliente sem negócio
dona
profissional
Admin
conta com múltiplos contextos quando aplicável
```

O teste deve provar ausência de ações indevidas, não apenas presença das ações
corretas.

## 52. Testes de upload

Quando uma mudança toca mídia:

- tipo inválido;
- tamanho;
- preview;
- mesmo arquivo novamente;
- upload principal;
- falha parcial;
- galeria;
- capa;
- rollback;
- fallback de imagem.

Backend ainda deve validar o arquivo recebido.

## 53. Performance: critérios

O runbook de performance define:

- API crítica com p95 ≤ 2 s;
- páginas públicas críticas buscando LCP móvel ≤ 2,5 s no perfil definido.

A evidência histórica não deve ser reutilizada para afirmar performance de um
commit que alterou a cadeia crítica.

## 54. Performance QA separada

A workflow `Performance QA` é distinta da quality gate principal.

Ela pode ser:

- executada manualmente;
- disparada em PRs para `main` quando paths críticos de performance mudam.

Os paths incluem áreas como:

- `App.jsx`;
- Home;
- perfil público;
- componentes de perfil;
- assets públicos do hero;
- estilos públicos críticos;
- scripts/workflow de performance.

Mudança puramente documental não aciona essa revalidação.

## 55. Medição de API

O perfil padrão documentado usa:

- 3 warmups;
- 30 amostras;
- concorrência 3;
- timeout individual 15 s;
- limite p95 de 2.000 ms.

Endpoints públicos críticos:

- catálogo;
- perfil;
- disponibilidade.

É uma medição controlada de operação normal, não stress test de capacidade
máxima.

## 56. LCP móvel

A medição usa Lighthouse fixado e:

- três execuções frias;
- mediana;
- form factor mobile;
- throttling simulado;
- RTT e throughput definidos no runbook;
- CPU slowdown;
- limite de 2.500 ms.

O build da própria branch é servido localmente, com proxy para APIs do alvo
representativo.

Isso mede o frontend em avaliação em vez de medir apenas o bundle já implantado.

## 57. Quando revalidar performance

Revalidar quando a mudança tocar de forma material:

- hero;
- imagem LCP;
- fontes/asset crítico;
- CSS público bloqueante;
- chunk inicial;
- `App.jsx`;
- profile page;
- home;
- busca/catálogo crítico;
- endpoints públicos medidos;
- estratégia de mídia;
- lazy loading da cadeia pública.

Alteração de texto interno do painel, sem impacto no bundle público crítico,
normalmente não exige Lighthouse dedicado.

## 58. Performance e imagem

Para imagem candidata a LCP:

- não usar lazy loading indevido;
- definir prioridade quando necessário;
- evitar payload maior sem benefício;
- revisar dimensão;
- revisar transformação/otimização;
- comparar medição real.

Não assumir que WebP por si só garante bom LCP.

## 59. Performance e JS

Mudança em dependência ou chunk inicial deve considerar:

- bundle;
- execução;
- hidratação/render;
- import dinâmico;
- terceiro;
- analytics.

Integrações não críticas devem continuar adiáveis/fail-soft quando possível.

O Meta/Google bridge já é carregado de forma diferida no runtime atual.

## 60. Performance e regressão visual

Otimização que melhora LCP não pode:

- cortar imagem contra o contrato;
- esconder conteúdo;
- remover alt;
- quebrar mobile;
- retirar affordance necessária.

Performance é requisito junto com UX, não no lugar dela.

## 61. Critério de teste por risco

### Baixo risco

Exemplos:

- copy sem lógica;
- documentação;
- pequeno ajuste CSS isolado sem layout crítico.

Validação típica:

- inspeção/diff;
- lint/build quando executável;
- teste existente afetado se houver.

### Médio risco

Exemplos:

- componente compartilhado;
- form;
- rota;
- shell;
- estado assíncrono;
- CSS responsivo.

Validação típica:

- Vitest relevante;
- build;
- E2E da jornada/contexto;
- WebKit se visual/interativo.

### Alto risco

Exemplos:

- booking;
- autenticação;
- autorização/contexto;
- publicação/onboarding;
- checkout/billing;
- lifecycle;
- sessão;
- analytics de conversão;
- performance pública crítica.

Validação típica:

- testes unitários/integrados;
- backend correspondente;
- E2E;
- CI completo;
- performance quando aplicável;
- revisão manual dirigida;
- evidência antes de declarar concluído.

## 62. Matriz mínima por tipo de mudança

| Mudança | Vitest | Playwright | Backend | Performance |
| --- | --- | --- | --- | --- |
| util puro | obrigatório | normalmente não | não | não |
| componente visual compartilhado | sim | se afeta jornada/layout | não | se público crítico |
| página/form | sim | fluxo crítico | contrato correspondente | se crítico |
| rota/shell | sim | sim | autorização se mudar | não normalmente |
| booking | sim | sim | sim | se perfil/agenda pública afetados |
| checkout | sim | cenário crítico | sim | não, salvo impacto de página pública |
| sessão/auth | sim | sim | sim | não |
| CSS público crítico | regressão quando útil | sim | não | sim se cadeia LCP |
| Admin visual | sim | mobile/desktop conforme risco | endpoint se mudar | não |
| docs-only | não obrigatório | não | não | não |

A tabela é baseline. O risco concreto pode exigir mais cobertura.

## 63. Validação manual dirigida

Automação não substitui completamente inspeção.

Para alteração visual/interativa relevante, revisar manualmente:

- desktop;
- 360/390/430;
- WebKit;
- teclado;
- mensagens;
- scroll;
- imagens;
- estado de erro;
- sessão;
- fluxo de retorno.

Não fazer "QA manual genérico". Escolher cenários a partir do risco do diff.

## 64. Checklist mobile

Antes de concluir mudança mobile:

1. nenhuma largura global excede viewport;
2. CTA não está coberto;
3. bottom nav respeita safe area;
4. teclado não torna ação impossível;
5. inputs continuam usáveis;
6. texto não corta informação crítica;
7. carrossel/rail deixa claro que pode rolar;
8. foco é perceptível;
9. dialog/popover cabe e fecha;
10. imagem respeita o contrato visual.

## 65. Checklist de acessibilidade

1. heading principal existe;
2. inputs possuem label;
3. ações são buttons e destinos são links;
4. foco por teclado é visível;
5. ordem de tab é lógica;
6. ícone decorativo não vira ruído;
7. erro é anunciado;
8. estado assíncrono é perceptível;
9. contraste permanece adequado;
10. movimento pode ser reduzido/pausado quando aplicável.

## 66. Checklist de formulário

1. loading inicial;
2. valor inicial correto;
3. validação nativa;
4. validação local;
5. payload normalizado;
6. double submit bloqueado;
7. backend rejeitado aparece;
8. sucesso só depois da resposta;
9. baseline é atualizado;
10. refresh/navegação mantém coerência.

## 67. Checklist de sessão

1. bootstrap com sessão;
2. sem sessão;
3. 401;
4. logout;
5. refresh de sessão após mudança;
6. papel correto;
7. negócio correto;
8. rota owner/professional correta;
9. Admin não herda ação indevida;
10. destino pós-login é interno e seguro.

## 68. Checklist de booking

1. perfil carrega;
2. serviço elegível;
3. profissional única não cria escolha inútil;
4. múltiplas profissionais permitem seleção;
5. disponibilidade carrega;
6. vazio de slot é explícito;
7. horário seleciona;
8. CTA cabe no mobile;
9. confirmação cria booking;
10. sucesso não aparece antes da API.

## 69. Checklist financeiro

1. plano foi obtido da API;
2. mesmo plano é tratado;
3. documento é normalizado;
4. idempotency key existe;
5. retry da mesma intenção reutiliza a chave;
6. PIX gerado não vira plano ativo;
7. polling diferencia confirmado/ativando/ativo;
8. falha de consulta permite retry;
9. analytics não vira autoridade;
10. entitlement vem do backend.

## 70. Antes do merge

Para mudança executável:

```text
investigar
  → alterar
  → revisar diff
  → lint
  → testes proporcionais
  → build
  → E2E quando aplicável
  → performance quando aplicável
  → revisar evidência
  → só então considerar pronta para merge
```

Não fazer merge apenas porque o código "parece certo".

## 71. Depois de falha no CI

Classificar a falha antes de agir:

```text
falha determinística de código
falha de teste
flake
infra
dependência/audit
performance
```

A correção depende da classe.

Não alterar teste para fazê-lo passar sem verificar se o comportamento esperado
continua correto.

## 72. Rerun

Rerun isolado é adequado quando:

- o código não mudou;
- existe indício claro de instabilidade externa;
- artifact/trace não mostra bug determinístico;
- a execução anterior falhou por infra transitória.

Se o mesmo job falha novamente, tratar como problema real até evidência em
contrário.

## 73. Evidência para declarar correção

Antes de dizer "corrigido", guardar mentalmente ou no PR:

- qual era a causa;
- qual arquivo mudou;
- qual teste falhava/protege;
- qual comando passou;
- se houve E2E;
- se houve performance;
- se existe risco residual.

Se um passo não foi executado, dizer explicitamente.

## 74. Evidência para docs-only

Mudança exclusivamente documental não exige rodar a suíte inteira quando:

- nenhum arquivo executável/config/test/migration mudou;
- links e conteúdo foram revisados;
- o diff foi inspecionado.

Ainda assim, um documento técnico precisa ser comparado com o código atual antes
de afirmar comportamento.

## 75. Cobertura não é objetivo isolado

O projeto não deve otimizar para percentual de coverage sem contexto.

Uma linha coberta pode não provar:

- autorização;
- concorrência;
- mobile;
- WebKit;
- acessibilidade;
- idempotência;
- performance;
- UX de erro.

Priorizar cobertura de risco e invariantes.

## 76. Novo componente

Ao criar componente compartilhado:

- teste semântico;
- teste da interação;
- estados;
- acessibilidade;
- contexto onde será usado;
- E2E se impactar jornada.

Quanto mais transversal o componente, maior o raio de regressão.

## 77. Nova página

Para uma nova página remota:

- loading;
- erro;
- retry;
- vazio;
- sucesso;
- mobile;
- sessão;
- URL direta;
- back/refresh;
- permissões.

Se a página faz parte do funil, adicionar também evento/analytics correto e
teste da transição relevante.

## 78. Nova rota

Ao criar rota:

- adicionar ao contrato de rotas;
- montar no `App.jsx`;
- escolher shell;
- escolher `ProtectedRoute`;
- testar acesso permitido;
- testar acesso negado;
- testar URL direta;
- revisar lazy CSS;
- atualizar mapa de telas.

## 79. Mudança de CSS

Ao alterar CSS:

- identificar owner;
- testar viewport pequena;
- testar WebKit;
- verificar overflow;
- verificar foco;
- verificar estado disabled;
- verificar texto longo;
- revisar route CSS se lazy;
- medir performance se público crítico.

Não considerar screenshot desktop suficiente.

## 80. Mudança de analytics

Analytics deve ser testado como efeito secundário.

Proteger:

- evento após fato correto;
- ausência de PII;
- fail-soft;
- consentimento;
- rota sensível;
- não duplicação;
- diferença entre evento comportamental e transacional.

Falha do analytics não deve quebrar booking/checkout principal.

## 81. Dependência nova

Antes de introduzir dependência frontend:

- problema que resolve;
- tamanho/impacto de bundle;
- segurança;
- compatibilidade React 19;
- suporte WebKit;
- manutenção;
- tree-shaking;
- teste;
- alternativa nativa.

Nova dependência não entra só por conveniência sintática.

## 82. Mudança de design system

Tokens ou primitives visuais têm alto raio.

Validar:

- público;
- Owner;
- Professional;
- Admin quando compartilhar token;
- contraste;
- focus;
- disabled;
- hover;
- mobile;
- WebKit.

Não alterar token global para corrigir um caso local sem revisar consumidores.

## 83. Prontidão de release versus prontidão de merge

Um patch pode estar pronto para merge mas ainda depender de release/deploy
controlado.

Exemplos:

- migration;
- env;
- provider;
- feature flag;
- nova integração;
- performance dependente do alvo.

Este documento define QA de frontend. Deploy continua regido por
[`deploy-seguro.md`](./deploy-seguro.md).

## 84. Inventário observado nesta auditoria

Na revisão que originou este documento, a árvore da branch continha:

```text
113 arquivos de teste frontend
├── 99 em frontend/src
└── 14 em frontend/e2e
```

Esse número é **observacional**, não meta de qualidade e não precisa ser mantido
manualmente a cada novo teste.

O que deve permanecer atualizado são os contratos, comandos e responsabilidades
deste documento.

## 85. Critério de manutenção

Atualizar este documento quando mudar de forma durável:

- framework de teste;
- matriz de browsers/viewports;
- quality gate;
- política de artifacts;
- estratégia de acessibilidade;
- estratégia de performance;
- definição de prontidão;
- owners de testes;
- critérios de WebKit/mobile.

Adicionar um teste isolado não exige atualizar o documento, salvo se ele
introduzir uma nova categoria de garantia.
