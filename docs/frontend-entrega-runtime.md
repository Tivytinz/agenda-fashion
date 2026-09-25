# Entrega e runtime do frontend — Agenda Fashion

> **Papel documental:** referência técnica especializada para build Vite,
> entrega pelo Express, cache HTTP, lazy loading, recuperação de chunks,
> SEO/noindex, sitemap, metadata e social preview.
>
> O fluxo operacional de release continua canônico em
> [`deploy-seguro.md`](./deploy-seguro.md). Metas de LCP e API continuam em
> [`performance-qa.md`](./performance-qa.md). Segurança do navegador e headers
> está em [`frontend-seguranca.md`](./frontend-seguranca.md).
>
> Este documento descreve o runtime executável atual e registra findings de
> entrega observados durante a auditoria. Nenhum finding descrito aqui foi
> corrigido silenciosamente nesta branch documental.

## 1. Objetivo

O frontend do AF não é publicado como aplicação separada no runtime atual.

O fluxo é:

```text
frontend/
   │
   ├── Vite build
   ▼
agendamento-nails/react-app/
   │
   └── servido pelo mesmo Express
          ├── APIs
          ├── documentos React
          ├── assets
          ├── SEO server-side pontual
          └── fallback 404 da SPA
```

Isso significa que build, roteamento HTTP, cache, metadata e recuperação de
assets precisam ser analisados como um único sistema.

## 2. Stack de entrega atual

Frontend:

- React 19;
- React Router 7;
- Vite 7.

Servidor:

- Node.js 22;
- Express 5;
- `express.static`;
- Helmet;
- rotas server-side específicas para SEO;
- fallback controlado da SPA.

Deploy:

- Railway;
- migrations antes do processo web;
- readiness em `/health/ready`.

## 3. Build de produção

O script frontend é:

```bash
npm --prefix frontend run build
```

que executa:

```text
vite build
```

O build Vite escreve em:

```text
agendamento-nails/react-app
```

a partir da opção:

```js
outDir: "../agendamento-nails/react-app"
```

## 4. Limpeza do diretório de build

O Vite está configurado com:

```text
emptyOutDir: true
```

Portanto um build novo substitui o conteúdo compilado anterior no diretório de
saída.

Isso é importante para chunks com hash:

- um deploy pode remover arquivos antigos;
- uma aba aberta antes do deploy pode ainda tentar carregar o chunk antigo;
- o runtime possui recuperação específica para esse cenário.

## 5. Script raiz de build

Na raiz do projeto:

```bash
npm run build
```

executa:

```text
npm --prefix frontend ci
→ npm run frontend:build
```

Ou seja, o build de entrega instala o grafo frontend de forma reprodutível antes
de compilar.

## 6. Runtime Express

O Express resolve o diretório publicado a partir de:

```text
<cwd>/agendamento-nails/react-app
```

e usa:

```js
express.static(reactDir, {
  index: false,
  ...
})
```

`index: false` é deliberado: documentos da SPA são entregues pelas rotas
controladas depois das APIs, em vez de o static middleware responder
automaticamente qualquer `index.html`.

## 7. APIs têm prioridade sobre a SPA

A ordem no servidor é:

```text
static assets
→ redirects legados
→ apiRoutes
→ Swagger fora de produção
→ documentos React
→ fallback HTML 404
→ notFound JSON
→ errorHandler
```

Essa ordem evita devolver HTML React para uma API real.

Também evita mascarar endpoint inexistente como status 200 de SPA.

## 8. Rotas React compartilhadas

A lista de rotas do navegador vem de:

```text
src/config/reactRoutes.json
```

Ela é consumida por:

- `frontend/src/App.jsx`;
- `src/server.js`.

Isso reduz divergência entre router do browser e servidor para rotas conhecidas.

## 9. Parâmetros dinâmicos

Rotas como:

```text
/negocio/:slug
/servicos/:categoria/em/:localidade
/painel/servicos/:id/editar
/agendamento-acesso/:id
/agendamento-visitante/:id
```

existem no mesmo contrato.

Express e React Router interpretam os parâmetros em seus próprios contextos.

Ao criar rota nova, atualizar o contrato compartilhado antes de depender de
deep link.

## 10. Fallback de rota desconhecida

Uma URL desconhecida com:

```text
Accept: text/html
```

recebe:

- documento React;
- HTTP 404;
- `noindex,follow`.

Assim o React ainda pode renderizar `NotFoundPage`, sem transformar URL
inexistente em 200.

## 11. Endpoint inexistente continua JSON 404

Uma URL desconhecida com:

```text
Accept: application/json
```

não recebe o documento da SPA.

Ela segue para `notFound` e retorna erro JSON.

Esse comportamento é protegido por teste.

## 12. Accept genérico e rotas explícitas

Rotas React explicitamente registradas são respondidas como HTML mesmo quando
clientes como robôs usam Accept genérico.

Exemplo coberto:

```text
GET /planos
Accept: */*
→ documento React 200
```

A resolução de API ocorre antes desse estágio.

## 13. Vite dev server

Desenvolvimento local usa:

```text
porta 5173
```

e proxies selecionados para:

```text
localhost:3000
```

Rotas atualmente proxied em dev incluem:

- negócios públicos;
- perfil;
- agenda pública;
- agendamentos;
- meus agendamentos;
- eventos de produto.

Uma nova API não precisa necessariamente entrar no proxy quando o projeto usa
`VITE_API_URL`; revisar o comportamento local antes de adicionar regra.

## 14. Vite preview

O preview usa:

```text
porta 4173
```

e possui proxies específicos de leitura pública para performance.

O alvo pode ser controlado por:

```text
PERF_API_PROXY_TARGET
```

Esse mecanismo serve ao QA de bundle/LCP.

Não é a topologia de produção.

## 15. Vendor chunk

A configuração atual separa manualmente:

```text
vendor-react
├── react
├── react-dom
└── react-router-dom
```

Isso evita misturar o runtime React em cada chunk de feature.

Não criar dezenas de `manualChunks` sem medir benefício.

## 16. Home é entrada síncrona

`HomePage` é importada diretamente por `App.jsx`.

Grande parte das demais páginas usa `React.lazy`.

Isso reflete o peso da home como entrada pública principal.

Ao tornar Home lazy ou mover dependências para o entry chunk, medir LCP antes de
concluir melhora.

## 17. Lazy pages

`App.jsx` usa helpers:

```text
lazyNamed
lazyNamedWithStyles
```

O primeiro carrega módulo.

O segundo carrega em paralelo:

```text
CSS da área + módulo da página
```

e só resolve o componente quando ambos concluíram.

## 18. CSS contextual lazy

Áreas com CSS lazy incluem, entre outras:

- Admin;
- dashboard;
- agenda;
- horários;
- serviços;
- negócio;
- assinatura;
- planos;
- equipe/convites.

Esse desenho reduz CSS inicial, mas cria dependência de chunk por rota.

Por isso existe `route-css-smoke.spec.js`.

## 19. CSS global

`main.jsx` ainda carrega fundações globais como:

- `index.css`;
- consentimento;
- legal;
- responsive;
- experiência;
- home discovery;
- profile polish;
- account polish;
- lifecycle.

A arquitetura atual é incremental.

Não mover tudo para lazy em uma única reescrita apenas para perseguir
uniformidade.

## 20. Suspense

As rotas lazy ficam dentro de:

```jsx
<Suspense fallback={...}>
```

O fallback atual mostra:

```text
Carregando...
```

O Meta Ads bridge usa Suspense próprio com fallback nulo.

## 21. Ads diferido

O bridge de Meta/Google é montado depois de aproximadamente:

```text
500 ms
```

e ainda é carregado por lazy import.

Objetivo:

- não colocar marketing na cadeia inicial crítica;
- preservar produto em falha de integração;
- reduzir impacto de terceiros no LCP.

Detalhes de consentimento pertencem ao documento de analytics.

## 22. Preload da Home

`frontend/index.html` injeta preload de imagem para `/`.

Mobile:

```text
/assets/home/salon-hero-mobile.webp
```

Desktop:

```text
/assets/home/salon-hero-wide.webp
```

A decisão usa `matchMedia("(max-width: 767px)")`.

A primeira imagem do hero também usa:

```text
fetchPriority=high
loading=eager
```

## 23. Preload do perfil

Para path:

```text
/negocio/:slug
```

o HTML inicial cria preload:

```text
as=fetch
/perfil-negocio/:slug
```

com credenciais.

O objetivo é começar a leitura do perfil antes de React terminar de carregar a
página.

## 24. Preload precisa acompanhar o contrato

Se a API do perfil mudar de rota ou de credenciais, revisar simultaneamente:

- `frontend/index.html`;
- `ProfilePage.jsx`;
- Vite proxy;
- performance QA.

Um preload órfão gasta rede e não acelera a request real.

## 25. Cache do documento HTML

Documentos React passam por:

```text
disableDocumentCache
```

que aplica:

```text
Cache-Control: no-store, no-cache, must-revalidate
Pragma: no-cache
Expires: 0
```

Isso vale para:

- fallback React;
- perfil público server-rendered de metadata;
- catálogo local server-rendered de metadata;
- HTML 404 dessas áreas.

## 26. Por que o HTML não é imutável

O documento contém referências para o build atual.

Se `index.html` ficasse preso em cache enquanto chunks antigos fossem removidos,
a probabilidade de erro de asset aumentaria.

A estratégia atual é:

```text
HTML sempre fresco
+
assets versionados com cache longo
```

## 27. Cache de assets

A política agora distingue duas classes.

Assets versionados do build continuam recebendo:

```text
Cache-Control: public, max-age=31536000, immutable
```

Assets públicos de filename estável que podem mudar entre deploys não podem usar
`immutable`.

Os heroes públicos:

```text
assets/home/salon-hero-mobile.webp
assets/home/salon-hero-wide.webp
```

recebem:

```text
Cache-Control: public, max-age=0, must-revalidate
```

Assim o navegador pode reaproveitar validação condicional/ETag, mas não assume
que o conteúdo daquele URL ficará imutável por um ano.

## 28. Assets de bundle Vite

Imports processados pelo Vite normalmente entram no grafo de build e recebem
nome de saída associado ao build.

O contrato do AF depende desse versionamento para JS/CSS/assets compilados.

Não remover hash/versionamento do bundle mantendo `immutable` por um ano.

## 29. Wave C: heroes públicos com revalidação

A Wave C mantém as URLs estáveis usadas pelo preload e pela Home, mas separa sua
política de cache dos assets versionados.

Contrato:

```text
URL estável de hero
→ public, max-age=0, must-revalidate

asset versionado/hash
→ public, max-age=31536000, immutable
```

Isso evita imagem antiga presa por um ano sem exigir renomear o arquivo ou
limpar cache global. O preload continua apontando para o mesmo recurso usado pela
primeira imagem do hero.

`tests/http-cache.test.js` cobre as duas classes.

Esta branch documental não alterou o cache.

Patch futuro deve escolher uma estratégia explícita:

- versionar o nome desses assets; ou
- não aplicar `immutable` a public assets estáveis; ou
- mover os heroes para o grafo de imports do Vite.

Qualquer mudança precisa revalidar LCP.

## 30. Cache do social preview padrão

`/social-preview.png` usa:

```text
Cache-Control: public, max-age=86400
```

ou 24 horas.

Essa imagem é gerada em memória no backend.

## 31. Cache do sitemap

`/sitemap.xml` usa:

```text
public, max-age=3600
```

ou uma hora.

Isso equilibra crawl e atualização de oferta pública.

## 32. Cache de robots

`/robots.txt` usa:

```text
public, max-age=86400
```

ou 24 horas.

Mudança de política de crawl pode demorar até a expiração do cache já entregue.

## 33. HTML base em memória

`socialPreviewService.lerHtmlReact()` lê:

```text
agendamento-nails/react-app/index.html
```

Em produção, mantém esse HTML em memória depois da primeira leitura.

Como cada deploy inicia um novo processo com novo build, o cache em memória fica
associado ao ciclo de vida daquele processo.

Não compartilhar esse cache entre versões de build.

## 34. Cenário de stale asset

O cenário protegido é:

```text
aba abriu build A
→ deploy B remove chunk A
→ pessoa navega para página lazy
→ browser tenta /assets/Page-A.js
→ arquivo não existe
```

Sem recovery, a interface pode cair em tela de erro até reload manual.

## 35. runtimeRecovery

Arquivo:

```text
frontend/src/utils/runtimeRecovery.js
```

reconhece mensagens como:

- failed to fetch dynamically imported module;
- importing a module script failed;
- unable to preload CSS;
- chunk load failed;
- ChunkLoadError.

Ele não tenta recarregar para erro funcional comum.

## 36. Evento Vite de preload

`main.jsx` instala:

```text
vite:preloadError
```

globalmente.

Quando o evento representa asset obsoleto:

```text
recoverFromStaleAssets(...)
```

tenta uma recarga controlada.

## 37. Cache busting de recovery

A URL recebe temporariamente:

```text
?_af_reload=<timestamp>
```

preservando:

- pathname;
- demais queries;
- hash.

O reload usa `location.replace`, evitando empilhar uma entrada de histórico
apenas para recovery.

## 38. Proteção contra loop

O recovery guarda:

```text
af_runtime_asset_recovery
```

em sessionStorage quando disponível.

Janela atual:

```text
60 segundos
```

Se a URL ou storage indicarem tentativa recente, uma segunda recarga automática
é bloqueada.

## 39. Storage bloqueado no recovery

Se sessionStorage estiver indisponível, o parâmetro da própria URL ainda evita
loop imediato.

Isso é coberto por teste.

## 40. markRuntimeReady

Depois que um módulo lazy resolve com sucesso:

```text
markRuntimeReady()
```

faz:

- remover a marca de recovery do storage;
- retirar apenas `_af_reload` da URL;
- preservar demais query params e hash.

Isso devolve a URL limpa para a pessoa.

## 41. ErrorBoundary

O topo do React é:

```text
StrictMode
→ ErrorBoundary
→ BrowserRouter
→ SessionProvider
→ PublicShell
→ App
```

Um erro inesperado de render não precisa terminar em página branca.

## 42. ErrorBoundary e stale asset

`componentDidCatch` chama:

```text
recoverFromStaleAssets(error)
```

Se for chunk obsoleto, recovery pode recarregar.

Se não for, a boundary mostra estado fatal com:

- atualizar página;
- voltar ao início.

## 43. Texto do erro fatal

A tela fatal afirma:

```text
Seu agendamento ainda não foi confirmado.
```

Esse copy é conservador para evitar induzir a pessoa a acreditar que um booking
foi persistido só porque a interface falhou.

Uma feature com mutação idempotente ainda deve reconciliar estado no backend
quando houver ambiguidade.

## 44. Recovery não prova rollback

Falha de chunk ou reload não diz se uma request anterior foi persistida.

Não usar recovery para repetir automaticamente:

- booking;
- checkout;
- cancelamento;
- alteração financeira.

Essas operações precisam de seus próprios mecanismos de idempotência/reconsulta.

## 45. SEO híbrido

O AF não é SSR geral de React.

O desenho atual combina:

```text
SPA client-side
+
HTML base entregue pelo Express
+
metadata server-side em rotas públicas selecionadas
```

As duas rotas com metadata dinâmica server-side observadas são:

- perfil de negócio;
- catálogo local.

## 46. Metadata base

`frontend/index.html` contém:

```text
<title>Agenda Fashion</title>
description:
"Encontre profissionais e negócios de beleza e agende online."
```

Também possui:

- `lang="pt-BR"`;
- viewport com `viewport-fit=cover`;
- theme-color;
- favicon;
- apple-touch-icon.

## 47. SOCIAL_META

O HTML base contém o marcador:

```html
<!-- SOCIAL_META -->
```

`socialPreviewService.injetarMetadados()` remove metadata genérica e injeta
tags específicas antes de `</head>`.

## 48. Metadata do perfil público

Para:

```text
/negocio/:slug
```

o backend busca o negócio e, opcionalmente, o serviço informado por:

```text
?servico=<id>
```

e monta:

- title;
- description;
- canonical;
- Open Graph;
- Twitter card;
- imagem.

## 49. Serviço no social preview

Quando `servico` pertence ao negócio:

- título pode incluir serviço + negócio;
- descrição pode incluir preço/duração;
- imagem do serviço ganha preferência;
- canonical inclui `?servico=<id>`.

Quando o ID não corresponde a serviço do negócio, o backend ignora o serviço e
gera metadata do negócio.

## 50. Escaping de HTML

Textos usados nas tags server-side passam por escaping de:

- `&`;
- `<`;
- `>`;
- aspas.

Isso evita injetar nome/descrição do negócio diretamente como markup ativo.

## 51. URL de imagem social

A imagem social aceita apenas URL resolvível com:

```text
http:
https:
```

Quando não existe mídia válida, usa:

```text
/social-preview.png
```

## 52. Canonical do perfil

A origem vem de:

```text
PUBLIC_APP_URL
```

com fallback para:

```text
https://app.agendafashion.com.br
```

O canonical não carrega UTMs.

Pode carregar `servico` quando há serviço válido selecionado.

## 53. Slug antigo

Quando repository resolve um slug canônico diferente do solicitado:

```text
301 → /negocio/<slug-canônico>
```

O redirect preserva query params limitados pelo controller.

Isso evita manter múltiplas URLs permanentes para o mesmo perfil.

## 54. Perfil inexistente

Perfil não encontrado retorna:

- HTTP 404;
- documento React;
- title específico;
- description específica;
- canonical para a URL solicitada;
- `robots=noindex,follow`.

O browser ainda pode renderizar a experiência React correspondente.

## 55. Catálogo local server-side

A rota:

```text
/servicos/:categoria/em/:localidade
```

resolve:

- categoria canônica;
- cidade/UF pública;
- existência de oferta;
- metadata.

O HTML entregue já contém title/description/canonical/OG.

## 56. Canonical do catálogo

Se categoria/localidade não estão na forma canônica:

```text
301 → caminho canônico
```

A query original é preservada no redirect.

A metadata final usa a URL canônica sem transformar UTM em canonical.

## 57. Catálogo sem oferta

Combinação sem oferta retorna:

- 404;
- metadata específica;
- `noindex,follow`.

Isso evita indexar páginas locais vazias como sucesso.

## 58. Metadata client-side

O hook:

```text
usePageMetadata(title, description)
```

altera:

- `document.title`;
- meta description.

No unmount, restaura os valores anteriores.

É útil para navegação SPA depois que React carregou.

## 59. Client metadata não substitui HTML de crawler

Quando SEO/share preview depende do conteúdo **antes do JavaScript**, mudar
somente `document.title` não é equivalente a injeção server-side.

Perfil e catálogo já possuem suporte server-side.

Novas landing pages de SEO precisam decidir explicitamente se metadata
client-side é suficiente.

## 60. Professional Landing

`ProfessionalLandingPage` altera title e description no browser via
`useEffect`.

Ao mesmo tempo, `/para-profissionais` está no sitemap.

No caminho server-side genérico, a rota recebe o metadata base do
`index.html`, pois não possui renderer especializado como perfil/catálogo.

Isso é um finding de SEO:

> robôs que não executarem ou não aguardarem JavaScript podem observar title e
> description genéricos para uma landing explicitamente listada no sitemap.

Esta branch não alterou metadata server-side dessa landing.

## 61. Plans e institucionais

O sitemap inclui:

- `/`;
- `/para-profissionais`;
- `/planos`;
- `/privacidade`;
- `/termos`.

Entre essas rotas, o runtime server-side genérico não injeta metadata dedicada
por página.

A home possui metadata base coerente com descoberta geral.

Para páginas estratégicas como planos/landing, avaliar metadata server-side antes
de tratar SEO como otimizado.

## 62. Sitemap

O sitemap inclui URLs estáticas públicas e entradas dinâmicas.

Estáticas atuais:

- home;
- para profissionais;
- planos;
- privacidade;
- termos.

Dinâmicas:

- perfis públicos;
- combinações categoria/localidade com oferta.

## 63. lastmod

Perfis/catálogos podem usar:

```text
updated_at
```

normalizado para data ISO YYYY-MM-DD.

Quando a mesma URL aparece mais de uma vez, o gerador preserva a data mais nova.

## 64. robots.txt

O arquivo gerado atualmente permite crawl geral e bloqueia explicitamente
prefixos/rotas como:

- Admin;
- painel;
- profissional;
- checkout;
- conta;
- favoritos;
- minha agenda;
- recuperação/redefinição de senha;
- convites;
- acessos de booking por capability.

Também aponta para `/sitemap.xml`.

## 65. noindex server-side

Além de robots.txt, o servidor injeta:

```text
noindex,follow
```

em rotas privadas/sensíveis selecionadas.

O conjunto atual contém:

- login;
- cadastro;
- confirmar;
- sucesso;
- minha agenda;
- favoritos;
- criar negócio;
- conta;
- checkout;
- recuperação/redefinição de senha;
- convites;
- `/painel*`;
- `/admin*`;
- `/profissional/*`;
- `/agendamento-acesso/*`;
- `/agendamento-visitante/*`.

## 66. Wave A: rotas sensíveis cobertas por noindex

A Wave A incorporou ao contrato HTTP:

```text
/esqueci-senha
/redefinir-senha
/convites
/agendamento-acesso/:id
/agendamento-visitante/:id
```

Essas rotas agora recebem `noindex,follow` no documento React e também são
bloqueadas no `robots.txt`.

O segredo de reset/capability continua no fragmento e não é enviado ao crawler.
`noindex` e robots continuam sendo mecanismos de crawl, não autorização.

`tests/spa-seo-http.test.js` cobre deep links e o arquivo de robots. A branch
permanece em validação até Quality Gate/merge.

## 67. noindex não é autorização

Mesmo depois de corrigir o finding anterior:

```text
noindex
robots.txt
```

continuam sendo mecanismos de crawl.

Não substituem:

- auth;
- capability;
- ownership;
- backend.

## 68. Redirects legados

O servidor mantém redirects 301 para URLs históricas como:

- `/login`;
- páginas `.html`;
- dashboards antigos;
- checkout antigo;
- planos antigos.

O destino é restrito a path interno.

## 69. Query em redirect legado

O helper preserva a query original.

Isso mantém, por exemplo:

- intenção;
- campanha;
- parâmetros compatíveis.

Ao criar redirect permanente, avaliar se toda query deve realmente ser
preservada.

## 70. Compatibilidade /app/*

`/app/*` é convertido para rota raiz equivalente.

Cada segmento é passado por `encodeURIComponent`.

O destino final permanece interno.

## 71. Canonical e redirects

Regra prática:

```text
URL antiga conhecida
→ 301

URL pública canônica
→ 200 + canonical

URL inexistente
→ 404 + noindex
```

Evitar 200 silencioso para slug inexistente.

## 72. Social preview padrão

Quando negócio/serviço não possui imagem utilizável, o backend gera uma PNG:

```text
1200 × 630
```

com identidade visual AF.

A imagem é construída sem depender de provider externo.

## 73. Teste de social preview

`tests/social-preview.test.js` protege:

- escaping;
- serviço válido;
- serviço inválido ignorado;
- slug antigo;
- 404;
- Open Graph;
- canonical;
- remoção de UTM do canonical;
- imagem padrão;
- cache da imagem.

Mudança na rota pública deve revisar esse teste.

## 74. Teste HTTP/SEO

`tests/spa-seo-http.test.js` protege:

- noindex de algumas rotas;
- rota pública indexável;
- JSON de API;
- Accept genérico;
- HTML 404;
- JSON 404.

O finding das rotas sensíveis existe porque a matriz atual desse teste não cobre
todos os paths do contrato.

## 75. Teste de metadata client-side

`usePageMetadata.test.jsx` protege:

- alteração de title;
- alteração de description;
- restauração no unmount.

Não prova metadata server-side.

## 76. Performance QA

Mudanças em entrega podem exigir revalidação quando tocam:

- entry HTML;
- hero;
- preload;
- chunk inicial;
- CSS inicial;
- Home;
- Profile;
- lazy loading;
- cache;
- assets públicos.

Meta atual:

```text
LCP mobile mediano ≤ 2,5 s
```

nas páginas críticas definidas pelo runbook.

## 77. Evidência histórica de performance

Resultados históricos documentados pertencem aos commits medidos.

Mudança documental não invalida bundle.

Mudança futura no runtime de entrega não pode citar resultado antigo como prova
automática do novo commit.

## 78. Deploy

O fluxo canônico continua:

```text
branch
→ PR
→ Quality gate
→ diff review
→ merge autorizado
→ Railway
→ migrations
→ readiness
→ smoke
```

Este documento não altera essa ordem.

## 79. Railway

`railway.json` configura:

```text
healthcheckPath: /health/ready
healthcheckTimeout: 120
restartPolicy: ON_FAILURE
maxRetries: 3
```

O build/start real também depende da configuração operacional do serviço.

Não inferir estado do dashboard Railway apenas pelo arquivo.

## 80. Start de produção

O script raiz é:

```text
npm run migrate:deploy
→ node src/server.js
```

A migration de deploy possui guarda adicional para Railway production.

## 81. Migration guard

`scripts/migrate-deploy.js` exige:

```text
RAILWAY_ENVIRONMENT_NAME=production
```

antes de aplicar a migração automática de deploy.

Essa proteção evita executar esse comando por acidente em ambiente Railway
nomeado diferente.

## 82. Readiness antes do listen

`iniciarServidor()` verifica a versão do banco antes de abrir a porta.

Se migration esperada não estiver aplicada, o processo falha.

Depois de subir, `/health/ready` continua verificando banco/migration.

## 83. Graceful shutdown

O servidor trata:

- SIGTERM;
- SIGINT.

Fluxo:

```text
parar workers
→ server.close
→ limite 10 s
→ fechar conexões restantes se necessário
→ db.end
```

Isso reduz corte abrupto durante restart/deploy.

## 84. Workers e frontend

Workers não fazem parte do bundle React, mas compartilham o processo por padrão.

`BACKGROUND_WORKERS_ENABLED` pode separá-los.

Mudança nessa topologia é operacional/backend e não deve ser confundida com
entrega do frontend.

## 85. Readiness não é smoke test

`/health/ready = 200` prova que:

- processo responde;
- banco está acessível/pronto na verificação definida.

Não prova que:

- chunks carregam;
- login funciona;
- perfil renderiza;
- booking funciona;
- CSS lazy está disponível.

Após deploy relevante, ainda realizar smoke dirigido.

## 86. Smoke de frontend após deploy

Dependendo do diff, verificar:

- `/`;
- rota lazy alterada;
- deep link;
- refresh da rota;
- asset/CSS;
- login;
- perfil público;
- WebKit/mobile;
- console/rede;
- rota 404.

Para mudança de SEO:

- status HTTP;
- title/description server-side;
- canonical;
- robots/noindex;
- OG.

## 87. Smoke de stale asset

Mudança na estratégia de chunks/cache deve simular:

```text
cliente com HTML/runtime antigo
+
deploy novo
+
navegação para chunk lazy
```

e confirmar que a recuperação não entra em loop.

Teste unitário atual cobre o algoritmo, mas smoke de deploy pode validar
comportamento de infraestrutura.

## 88. Build verde não prova runtime

`vite build` comprova que:

- imports foram resolvidos;
- bundler produziu saída.

Não comprova:

- Express serve o arquivo esperado;
- cache headers corretos;
- deep links;
- SEO;
- Railway;
- CDN/proxy;
- assets disponíveis depois de deploy.

## 89. E2E e entrega

Playwright usa Vite preview nos testes atuais.

Isso protege boa parte do browser/runtime React.

Entretanto, regras exclusivas do Express, como:

- social metadata;
- noindex server-side;
- cache headers;
- redirects;

são cobertas principalmente por Jest/Supertest backend.

Usar a camada correta para cada contrato.

## 90. Route CSS smoke

Como preview Vite e produção Express não têm exatamente a mesma camada HTTP,
`route-css-smoke.spec.js` verifica o ponto que interessa ao browser:

> o CSS do chunk foi realmente aplicado na rota.

Isso complementa o teste de build.

## 91. Asset 404

Se um asset versionado válido retorna 404 logo após deploy:

- revisar build artifact;
- revisar ordem do deploy;
- revisar cache/CDN;
- revisar cliente antigo;
- revisar recovery.

Não resolver desligando cache global sem entender a causa.

## 92. Documento obsoleto

Se HTML antigo está sendo entregue depois de deploy, revisar:

- Cache-Control;
- proxy/CDN;
- domínio correto;
- instância antiga;
- health/readiness.

O Express atual explicitamente marca documentos como `no-store`.

## 93. Asset público estável

Para arquivo com nome sem hash que precisa mudar no futuro:

- versionar URL;
- usar TTL compatível;
- ou importá-lo pelo grafo do build.

Não combinar nome estável mutável com `immutable` longo.

Esse princípio é diretamente aplicável ao finding dos heroes.

## 94. Canonical e campanhas

UTM e click IDs não devem virar canonical.

Social preview do perfil preserva apenas a dimensão `servico` quando válida.

Catalog metadata usa o caminho canônico.

Isso evita proliferar URLs indexáveis por campanha.

## 95. Client navigation e canonical

React pode atualizar title/description durante navegação.

O canonical server-side pertence ao documento recebido inicialmente.

O runtime atual não mantém um gerenciador client-side genérico de
`<link rel="canonical">`.

Para páginas em que canonical varia durante SPA navigation sem novo request,
avaliar necessidade explicitamente.

## 96. SEO de paginação

Catálogo local carrega mais resultados client-side.

A metadata canônica representa a página local principal.

O runtime atual não cria URLs SEO separadas por `pagina` no documento público.

Isso evita indexar cada "carregar mais" como página independente.

## 97. SEO e estado autenticado

Conteúdo de dashboard/Admin não deve ser otimizado para indexação.

Prioridades:

- noindex;
- auth;
- performance operacional;
- privacidade.

Metadata de marketing pertence ao contexto público.

## 98. Social preview não substitui página real

OG pode anunciar:

- nome;
- descrição;
- foto;
- serviço.

O clique ainda precisa passar pela API real do perfil.

Não persistir regra de booking apenas em metadata.

## 99. Imagem social e cache

Ao trocar identidade visual da imagem padrão, lembrar que:

```text
/social-preview.png
```

pode ficar em cache por 24 horas.

A mudança não será necessariamente instantânea em crawlers/providers que também
mantêm caches próprios.

## 100. Preview de terceiro

Meta/WhatsApp/Telegram/Google podem manter cache próprio de link.

O AF controla o HTML e headers que entrega, mas não controla imediatamente o
cache externo depois que o crawler já buscou uma versão.

Ao validar mudança, distinguir:

- resposta atual do servidor;
- cache do provider.

## 101. Metadata de negócio alterada

HTML de perfil é `no-store` no AF, então nova request pode montar metadata a
partir do estado atual.

Crawler externo ainda pode usar cache próprio.

Não confundir esses dois níveis.

## 102. Social preview e mídia externa

A metadata pode apontar para foto pública HTTPS de negócio/serviço.

Ao mudar provider de mídia, revisar:

- URL pública;
- disponibilidade para crawler;
- Content-Type;
- HTTPS;
- dimensões;
- privacidade.

## 103. Favicon

O HTML fonte referencia assets de marca por caminho de source.

O Vite processa o `index.html` durante o build.

Ao trocar favicon:

- confirmar output;
- cache;
- Safari/iOS;
- apple touch icon;
- build.

## 104. viewport-fit

O HTML usa:

```text
viewport-fit=cover
```

Isso habilita layout até safe areas em dispositivos compatíveis.

CSS de navegação precisa continuar usando os insets quando encosta nas bordas.

## 105. theme-color

A cor base do browser chrome é:

```text
#c5246b
```

Mudança de identidade global deve revisar esse valor junto dos tokens visuais.

Não é necessário mudar por ajuste local de componente.

## 106. Lang

O documento declara:

```text
lang="pt-BR"
```

Isso ajuda acessibilidade e interpretação do conteúdo.

Se o produto ganhar internacionalização real, lang precisa acompanhar a página,
não apenas o bundle.

## 107. Conteúdo gerado server-side

Metadata dinâmica usa dados persistidos de negócio/serviço.

Sempre:

- limitar comprimento;
- escapar;
- validar URLs;
- não incluir campo livre não necessário.

O service atual normaliza espaços e limita título/descrição.

## 108. PUBLIC_APP_URL

A origem pública para canonical/social/sitemap vem de `PUBLIC_APP_URL`.

Em produção, runtime validation exige HTTPS.

Configuração incorreta pode gerar canonical para domínio errado mesmo que a
página abra normalmente.

Depois de alterar domínio, validar:

- canonical;
- OG URL;
- sitemap;
- robots.

## 109. Domínio canônico de performance

O runbook de performance usa:

```text
app.agendafashion.com.br
```

como domínio canônico observado na evidência registrada.

Esse fato histórico não impede mudança futura, mas qualquer troca de domínio
precisa revisar SEO, cache, CORS, cookies e medição.

## 110. Finding histórico do domínio raiz

O runbook registra que o domínio raiz:

```text
agendafashion.com.br
```

entregava HTML, mas respondeu 403 para assets JS/CSS no navegador sintético
durante a investigação da Wave 15.

A medição válida usou:

```text
app.agendafashion.com.br
```

Não assumir que esse finding histórico continua igual sem revalidar o domínio
atual.

## 111. Deep link

Como BrowserRouter usa History API, refresh de uma rota precisa chegar ao
Express e receber HTML React.

Ao criar nova rota fora de `reactRoutes.json`, o deep link pode cair no
fallback 404 mesmo que uma navegação interna pareça funcionar.

Por isso rota nova precisa atualizar o contrato compartilhado.

## 112. 404 React e SEO

O fallback 404 permite uma página visual amigável sem sacrificar status HTTP
correto.

Não transformar fallback geral em 200.

Soft 404 prejudica diagnóstico e indexação.

## 113. Rota dinâmica especializada versus genérica

Perfil e catálogo têm controller server-side antes do fallback React.

Isso permite:

- status real;
- redirect canônico;
- metadata dinâmica.

Ao criar landing local/dinâmica de SEO, esse é o padrão de referência.

## 114. API do perfil versus documento do perfil

São endpoints diferentes:

```text
GET /negocio/:slug
→ documento HTML/social preview

GET /perfil-negocio/:slug
→ JSON da aplicação
```

O preload e `ProfilePage` usam o segundo.

Crawler/social share usa o primeiro.

Não fundir os contratos sem revisar os dois consumidores.

## 115. API de catálogo versus documento do catálogo

Também existe separação:

```text
GET /servicos/:categoria/em/:localidade
→ HTML

GET /catalogo-local/:categoria/:localidade
→ JSON
```

O React carrega dados do JSON depois do documento inicial.

## 116. Canonical redirect também existe no client

Profile e LocalCatalog verificam resposta JSON e podem navegar para slug/path
canônico.

Isso cobre navegação SPA.

O servidor também redireciona deep links.

Ambas as camadas precisam continuar coerentes.

## 117. Não duplicar regra canônica

A regra de descobrir qual slug/caminho é canônico pertence ao backend/service.

Frontend consome a decisão.

Não copiar algoritmos completos de canonicalização no React.

## 118. Checklist de mudança no build

1. build Vite passa;
2. imports lazy resolvem;
3. CSS chunks carregam;
4. Home continua dentro da meta;
5. deep link funciona;
6. stale recovery continua válido;
7. cache headers continuam coerentes;
8. source/public assets foram classificados corretamente;
9. Playwright relevante passa;
10. diff do output não introduz bundle inesperado.

## 119. Checklist de cache

1. HTML mutável → no-store;
2. asset hash/versionado → immutable longo;
3. asset estável mutável → TTL/versionamento apropriado;
4. sitemap → TTL deliberado;
5. robots → TTL deliberado;
6. imagem social → TTL deliberado;
7. conteúdo privado → não colocar em cache público;
8. CDN/proxy não sobrescreve política sem decisão.

## 120. Checklist de SEO

1. status HTTP correto;
2. title;
3. description;
4. canonical;
5. robots/noindex;
6. OG;
7. Twitter card;
8. imagem;
9. redirect canônico;
10. sitemap quando indexável;
11. robots coerente;
12. query de campanha fora do canonical.

## 121. Checklist de rota privada

1. ProtectedRoute para UX;
2. backend auth/autorização;
3. noindex;
4. robots quando aplicável;
5. ausência do sitemap;
6. cache privado/no-store conforme resposta;
7. analytics externo coerente;
8. deep link não vaza dado.

## 122. Checklist de deploy frontend

1. quality gate verde;
2. build correspondente ao commit;
3. migrations concluídas;
4. readiness verde;
5. HTML novo sendo servido;
6. assets do build acessíveis;
7. rota lazy crítica abre;
8. refresh de deep link;
9. console sem ChunkLoadError persistente;
10. smoke do fluxo alterado;
11. performance se aplicável;
12. SEO se aplicável.

## 123. Findings desta auditoria

### 123.1 Hero público com cache immutable e nome estável

Status: **resolvido na Wave C e mergeado na main**.

Os dois heroes de filename estável agora usam revalidação obrigatória; assets
versionados continuam `immutable`.

### 123.2 Rotas sensíveis faltando no noindex server-side

Status: **resolvido na Wave A e mergeado na main**.

Recuperação/reset, convites e acessos por capability agora recebem noindex e
também foram adicionados ao robots.txt.

### 123.3 Landing profissional depende de metadata client-side

Status: **resolvido na Wave C e mergeado na main**.

`/para-profissionais` agora recebe no HTML inicial title/description dedicados,
canonical sem UTM, Open Graph e Twitter metadata, reutilizando a infraestrutura
mínima de metadata já existente no backend.

### 123.4 Páginas públicas estáticas compartilham metadata base

Status: **implementado na Wave D e em validação**.

`/planos`, `/privacidade` e `/termos` agora possuem title, description,
canonical e metadata social no HTML inicial. As páginas React usam os mesmos
titles/descriptions para preservar consistência em navegação SPA.

## 124. Prioridade técnica dos findings

Wave C executa os dois findings prioritários e dispara Performance QA para
revalidar o commit da branch.

Depois dela, permanece:

```text
1. observar LCP do commit validado
2. ampliar metadata estática somente onde houver objetivo real de aquisição
```

Não usar resultado histórico de outro commit como evidência da Wave C.

## 125. Ownership

| Responsabilidade | Dono |
| --- | --- |
| build | `frontend/vite.config.js` |
| entry HTML | `frontend/index.html` |
| bootstrap React | `frontend/src/main.jsx` |
| lazy routes/chunks | `frontend/src/App.jsx` |
| recovery | `frontend/src/utils/runtimeRecovery.js` |
| fatal UI | `frontend/src/components/ErrorBoundary.jsx` |
| static/cache HTTP | `src/server.js` + `src/utils/httpCache.js` |
| routes compartilhadas | `src/config/reactRoutes.json` |
| metadata perfil | `socialPreviewService` + perfil controller |
| metadata catálogo | `catalogoLocalService` + catálogo controller |
| client metadata | `usePageMetadata.js` |
| sitemap/robots | `catalogoLocalService.js` |
| deploy | `deploy-seguro.md` + Railway |
| performance | `performance-qa.md` |

## 126. Documentos relacionados

- [`frontend-arquitetura.md`](./frontend-arquitetura.md): arquitetura React;
- [`frontend-qa-prontidao.md`](./frontend-qa-prontidao.md): testes e prontidão;
- [`frontend-seguranca.md`](./frontend-seguranca.md): headers, sessão e
  segurança;
- [`frontend-estilos.md`](./frontend-estilos.md): CSS;
- [`public-shell.md`](./public-shell.md): contexto público;
- [`performance-qa.md`](./performance-qa.md): LCP/API;
- [`deploy-seguro.md`](./deploy-seguro.md): release;
- [`marketing-attribution.md`](./marketing-attribution.md): URLs de campanha;
- [`frontend-analytics-observabilidade.md`](./frontend-analytics-observabilidade.md):
  page views e sanitização;
- [`dependency-security.md`](./dependency-security.md): dependências.


> Findings abertos e prioridade de execução estão consolidados em [`frontend-pendencias-priorizadas.md`](./frontend-pendencias-priorizadas.md).

## 127. Manutenção

Atualizar este documento quando mudar de forma durável:

- build Vite;
- output;
- static serving;
- cache;
- lazy loading;
- recovery;
- entry HTML;
- metadata;
- canonical;
- noindex;
- robots;
- sitemap;
- social preview;
- domínio público;
- estratégia de deploy do frontend.

Mudança puramente visual que não altera entrega não exige atualização.
