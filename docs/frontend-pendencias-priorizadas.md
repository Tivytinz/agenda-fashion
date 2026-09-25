# Matriz priorizada de pendências do frontend — Agenda Fashion

> **Papel documental:** consolidação operacional dos findings encontrados na
> auditoria técnica do frontend em setembro de 2026.
>
> Este documento **não cria novas regras de produto** e não substitui as fontes
> canônicas de cada domínio. Ele existe para transformar achados dispersos em uma
> fila técnica verificável.
>
> Código executável, migrations e testes continuam tendo precedência sobre esta
> matriz. Quando um item for corrigido, a evidência deve ser revalidada no
> runtime e o item deve ser marcado como resolvido ou removido desta fila.

## 1. Objetivo

A auditoria de frontend passou por:

- arquitetura e rotas;
- jornadas;
- componentes;
- formulários/estado/API;
- analytics;
- segurança;
- QA;
- build/cache/runtime/SEO.

Os documentos especializados registraram findings locais.

Esta matriz responde quatro perguntas:

1. qual finding ainda está aberto;
2. qual risco real ele representa hoje;
3. qual patch é necessário;
4. qual evidência fecha o item.

## 2. Escala de prioridade

A prioridade desta matriz é de **execução técnica do AF**, não uma classificação
genérica de vulnerabilidade.

### P1 — próxima wave de hardening

Usar quando existe:

- divergência atual de segurança/privacidade;
- comportamento ativo que pode poluir medição relevante;
- página sensível com política HTTP inadequada;
- inconsistência que merece correção antes de ampliar a superfície.

P1 não significa automaticamente incidente ou exploração ativa.

### P2 — correção importante, mas não bloqueante no desenho atual

Usar quando:

- existe dívida de segurança/manutenção;
- há risco de cache/performance;
- aquisição pode perder qualidade;
- a topologia atual mitiga o problema, mas uma mudança futura pode ativá-lo.

### P3 — alinhamento e evolução

Usar quando:

- o comportamento é funcional;
- não existe evidência de quebra atual;
- a melhoria depende de decisão de produto/SEO/arquitetura;
- a dívida deve ser controlada antes de crescer.

## 3. Resumo executivo

| ID | Prioridade | Domínio | Finding | Estado observado |
| --- | --- | --- | --- | --- |
| FE-P1-01 | P1 | sessão | `optionalAuth` não verifica revogação por hash | resolvido (Wave A) |
| FE-P1-02 | P1 | privacidade/analytics | UTM V2 antes do consentimento diverge do texto de Privacidade | validando (Wave B) |
| FE-P1-03 | P1 | analytics/privacidade | Meta mede `/admin/*` enquanto Google/V2 excluem Admin | resolvido (Wave A) |
| FE-P1-04 | P1 | SEO/privacidade | rotas sensíveis não recebem `noindex` server-side | resolvido (Wave A) |
| FE-P2-01 | P2 | cache/performance | heroes públicos usam URL estável com cache `immutable` de 1 ano | aberto |
| FE-P2-02 | P2 | aquisição/SEO | landing `/para-profissionais` depende de metadata client-side | aberto |
| FE-P2-03 | P2 | privacidade | cache local de sessão mantém metadados pessoais desnecessários | hardening |
| FE-P2-04 | P2 | sessão | compatibilidade Bearer/localStorage permanece ativa | dívida de migração |
| FE-P2-05 | P2 | segurança | política CSRF depende implicitamente da topologia atual | validando (Wave B) |
| FE-P3-01 | P3 | CORS | `X-Agenda-Access` não está em `allowedHeaders` | latente em same-origin |
| FE-P3-02 | P3 | UX/arquitetura | `/convites` aparece no shell profissional mas monta fora dele | alinhamento |
| FE-P3-03 | P3 | SEO | páginas públicas estáticas compartilham metadata base | oportunidade |
| FE-P3-04 | P3 | analytics | V2 e `eventos_produto` coexistem | migração controlada |

## 4. Ordem recomendada de execução

A sequência sugerida minimiza raio de mudança:

```text
Wave A — segurança/privacidade de baixo raio
  FE-P1-01 optionalAuth/revogação
  FE-P1-03 Meta Admin
  FE-P1-04 noindex sensível

Wave B — decisão de privacidade
  FE-P1-02 UTM first-party × texto de Privacidade
  FE-P2-05 política CSRF explícita

Wave C — entrega e aquisição
  FE-P2-01 cache dos heroes
  FE-P2-02 metadata server-side da landing
  revalidar LCP/SEO

Wave D — redução de dívida
  FE-P2-03 storage
  FE-P2-04 Bearer legado
  FE-P3-01 CORS capability
  FE-P3-02 shell de convites
  FE-P3-03 metadata estática
  FE-P3-04 retirada futura do pipeline legado
```

A sequência é recomendação técnica. Cada wave executável ainda precisa de
autorização própria.

---

# P1 — próxima wave de hardening

## 5. FE-P1-01 — optionalAuth não verifica revogação do JWT

### Evidência que originou o finding

`src/middlewares/auth.js` consulta:

```js
buscarEstadoDaSessao(
  decoded.id,
  hashToken(token)
)
```

e rejeita:

```text
token_revogado === true
```

Já `src/middlewares/optionalAuth.js` consulta:

```js
buscarEstadoDaSessao(decoded.id)
```

sem fornecer o hash.

No repository:

```text
tokenHash = null
→ token_revogado = FALSE
```

### Superfície observada

No estado atual auditado, `optionalAuth` é usado em:

```text
POST /analytics/collect
```

Portanto o finding **não demonstra bypass de autorização de booking, painel ou
billing**.

O impacto atual é mais restrito:

- um JWT revogado ainda pode ser aceito como identidade opcional do collector;
- evento após logout pode ser vinculado a `usuario_id` enquanto o token ainda
  for criptograficamente válido;
- a semântica de revogação fica inconsistente entre middleware obrigatório e
  opcional.

### Causa

O middleware opcional reutiliza a leitura do estado da conta, mas não reutiliza
o hash do token.

### Implementação na Wave A

A branch `fix/frontend-wave-a-hardening` agora:

- envia `hashToken(token)` ao repository;
- rejeita identidade opcional quando `token_revogado=true`;
- mantém a rota pública como visitante;
- limpa o cookie quando a sessão revogada veio por cookie;
- adiciona regressões no hardening de sessão.

A implementação da Wave A foi validada e mergeada na `main`.

### Patch aplicado

Pequeno e localizado:

1. obter `hashToken` do token validado;
2. chamar `buscarEstadoDaSessao(decoded.id, hashToken(token))`;
3. não preencher `req.user` quando `token_revogado=true`;
4. limpar cookie quando a origem for cookie;
5. preservar visitante sem token;
6. preservar comportamento público quando JWT estiver expirado/inválido.

### Testes obrigatórios

Adicionar regressão para:

```text
sem token
→ next como visitante

token válido ativo
→ req.user

token revogado
→ sem req.user

token revogado em cookie
→ cookie limpo

token anterior à troca de senha
→ sem req.user
```

Também executar testes do collector Analytics V2.

### Critério de fechamento

O item fecha quando:

- `optionalAuth` aplica a mesma evidência de revogação do `auth`;
- rota pública continua utilizável anonimamente;
- testes passam;
- documentação de sessão deixa de marcar o gap como pendente.

---

## 6. FE-P1-02 — UTM first-party e texto de Privacidade divergem

### Evidência executável

`firstPartyAnalytics.test.js` garante explicitamente:

```text
sem consentimento de marketing:
UTM → capturada
gclid/fbclid → não capturados
```

O Analytics V2 pode capturar:

- `utm_source`;
- `utm_medium`;
- `utm_campaign`;
- landing page;
- host de referrer.

Click IDs só entram depois de consentimento.

### Texto atual da Política

`PrivacyPage.jsx` informa:

> Aquisição opcional: origem da campanha, identificadores de clique e
> identificador pseudônimo do Google Analytics, somente quando houver autorização
> para medição de marketing.

### Divergência

O grupo textual "origem da campanha" sugere que UTM também só é tratada depois
da autorização.

O runtime V2 trata UTM first-party antes disso.

### Impacto

Este documento **não conclui ilegalidade**.

O problema é:

- política exibida e comportamento não descrevem a mesma coisa;
- uma futura auditoria não consegue afirmar alinhamento completo;
- alterar apenas o texto ou apenas o código sem decisão de finalidade/base pode
  criar nova divergência.

### Decisão da Wave B

A Wave B adotou a opção B para alinhar o runtime ao texto de Privacidade já
exibido: origem de campanha e click IDs só são capturados/persistidos quando a
preferência de medição de marketing está em `GRANTED`.

Implementação:

- `captureAcquisition()` não inclui `utm_*` nem click IDs antes de consentimento;
- landing path e host externo de referência permanecem telemetria first-party técnica;
- revogação limpa a atribuição opcional do pipeline legado;
- revogação também remove campanha da sessão V2 e dos lotes pendentes do outbox;
- relatórios devem tratar ausência de evidência sem inferir origem.

### Testes obrigatórios

Depois da decisão:

- `UNKNOWN`;
- `DENIED`;
- `GRANTED`;
- UTM;
- click ID;
- revogação;
- storage anterior;
- cadastro/atribuição.

### Critério de fechamento

Código, testes e política descrevem exatamente o mesmo comportamento.

---

## 7. FE-P1-03 — Meta mede Admin enquanto Google e V2 bloqueiam

### Evidência que originou o finding

`MetaAdsBridge.jsx` calcula:

```text
adminMeasurementRoute
sensitiveMeasurementRoute
blockedGoogleMeasurementRoute =
  admin || sensitive
```

Google usa `blockedGoogleMeasurementRoute`.

Meta usa apenas:

```text
!sensitiveMeasurementRoute
```

para inicialização/page view.

Consequência:

```text
/admin/*
  Analytics V2 → excluído
  Google       → excluído
  Meta         → ainda elegível quando consentido/configurado
```

### Impacto

Pode:

- enviar operação interna ao Pixel;
- contaminar público/visita no Meta;
- misturar Admin com aquisição;
- tornar a reconciliação mais difícil.

Não há evidência de que isso altere autorização ou fatos financeiros.

### Implementação na Wave A

O bridge agora usa a mesma classificação de rota administrativa também para Meta, bloqueando inicialização e `PageView` em `/admin` e `/admin/*` sem apagar a preferência persistida.

Foi adicionada regressão específica em `MetaAdsBridge.test.jsx`.

A implementação da Wave A foi validada e mergeada na `main`.

### Patch aplicado

Alinhar Meta à política administrativa:

```text
blockedMetaMeasurementRoute =
  adminMeasurementRoute ||
  sensitiveMeasurementRoute
```

e usar esse gate para:

- inicialização;
- page view;
- eventual sync que não deva operar nessa rota.

A preferência persistida não deve ser apagada apenas por entrar no Admin.

### Testes obrigatórios

Adicionar ao `MetaAdsBridge.test.jsx`:

```text
/admin
/admin/saude
/admin/nova-rota
→ initializeMetaAds não chamado
→ trackMetaPageView não chamado
```

e confirmar que ao voltar para rota de produto a medição pode retomar conforme
consentimento salvo.

### Critério de fechamento

Admin deixa de gerar page view de Meta e testes demonstram simetria com a
política de medição interna.

---

## 8. FE-P1-04 — rotas sensíveis sem noindex server-side

### Evidência que originou o finding

`rotasReactNoindex` inclui rotas como:

- login;
- cadastro;
- checkout;
- conta;
- favoritos;
- minha agenda.

Também bloqueia por prefixo:

- `/painel`;
- `/admin`;
- `/profissional`.

Mas não cobre explicitamente:

```text
/esqueci-senha
/redefinir-senha
/convites
/agendamento-acesso/:id
/agendamento-visitante/:id
```

### Impacto

Não é bypass de segurança.

Auth/capability continuam no backend.

O risco é de higiene de indexação/privacidade:

- páginas de reset não são conteúdo público de descoberta;
- convites são transição autenticada;
- capabilities representam bookings específicos;
- crawler não deve tratar essas URLs como páginas indexáveis.

### Implementação na Wave A

O servidor agora aplica `noindex,follow` a reset/recuperação, convites e deep links de capability, e `robots.txt` também bloqueia esses caminhos.

`spa-seo-http.test.js` foi ampliado para cobrir as rotas e o arquivo de robots.

A implementação da Wave A foi validada e mergeada na `main`.

### Patch aplicado

Preferir regra declarativa que lide corretamente com paths dinâmicos.

Exemplo de intenção:

```text
forgotPassword/resetPassword → noindex
professionalInvites          → noindex
inactiveBookingAccess        → noindex por matcher
guestBookingAccess           → noindex por matcher
```

Revisar também `robots.txt`, sem confundir robots com autorização.

### Testes obrigatórios

Expandir `tests/spa-seo-http.test.js` com deep links reais:

```text
/esqueci-senha
/redefinir-senha
/convites
/agendamento-acesso/123
/agendamento-visitante/123
```

Assertions:

- HTTP apropriado;
- HTML;
- `robots=noindex,follow`.

### Critério de fechamento

Toda rota privada/sensível do contrato possui política de indexação deliberada e
teste HTTP.

---

# P2 — correções importantes

## 9. FE-P2-01 — heroes públicos com URL estável e cache immutable

### Evidência atual

Arquivos:

```text
frontend/public/assets/home/salon-hero-mobile.webp
frontend/public/assets/home/salon-hero-wide.webp
```

URLs:

```text
/assets/home/salon-hero-mobile.webp
/assets/home/salon-hero-wide.webp
```

O Express aplica a qualquer arquivo abaixo de `assets/`:

```text
public, max-age=31536000, immutable
```

### Problema

O contrato ideal de `immutable` é:

```text
conteúdo mudou
→ URL mudou
```

Esses heroes podem ser substituídos mantendo o mesmo path.

### Impacto

- branding/imagem antiga pode persistir;
- cache do navegador/CDN pode sobreviver a deploy;
- debugging de conteúdo fica confuso;
- tentativa de "corrigir" limpando cache global poderia prejudicar performance.

### Soluções aceitáveis

Preferência técnica:

1. trazer o hero para o grafo do Vite e usar URL versionada pelo build;

ou:

2. versionar filename/URL manualmente;

ou:

3. separar cache de public asset estável e remover `immutable` dessa classe.

### Validação

Depois do patch:

- build;
- teste de header/cache;
- home desktop/mobile;
- preload aponta para o mesmo asset efetivamente usado;
- Lighthouse comparável;
- mediana LCP ≤ 2,5 s.

### Critério de fechamento

Imagem pode mudar em deploy sem depender de limpeza manual de cache e sem
regredir LCP.

---

## 10. FE-P2-02 — metadata da landing profissional só no client

### Evidência atual

`/para-profissionais`:

- está no sitemap;
- é rota pública de aquisição;
- altera title/description em `ProfessionalLandingPage` via `useEffect`;
- deep link genérico do Express recebe title/description base do
  `frontend/index.html`.

### Impacto

Robô/crawler que:

- não executa JS;
- não aguarda a SPA;

pode observar metadata genérica em uma página destinada à aquisição profissional.

### Patch esperado

Se SEO orgânico dessa landing for objetivo real:

- criar metadata server-side dedicada;
- title/description coerentes com promessa da landing;
- canonical;
- OG/Twitter;
- imagem apropriada;
- manter UTM fora do canonical.

Não criar renderer amplo só para "ter SSR"; usar solução mínima.

### Testes

Supertest:

```text
GET /para-profissionais
→ 200
→ title específico
→ description específica
→ canonical
→ OG
```

Revisar LCP somente se entry HTML/assets forem alterados de forma material.

### Critério de fechamento

Metadata relevante existe no HTML inicial e permanece coerente com o conteúdo
React.

---

## 11. FE-P2-03 — metadados pessoais no cache local da sessão

### Evidência atual

O fluxo novo remove JWT do localStorage.

Porém o cache de sessão pode persistir:

```text
usuario
negocio
```

e o objeto de usuário pode conter:

- nome;
- e-mail;
- WhatsApp.

### Interpretação correta

Isso não é credencial de autorização.

`/minha-sessao` continua sendo a fonte server-side.

O finding é de **minimização de exposição**: qualquer script executando na
origem consegue ler localStorage.

### Próximo passo

Antes de remover campos, medir quais valores o bootstrap realmente precisa.

Possibilidades:

- persistir somente marcador de sessão;
- persistir perfil mínimo;
- mover contexto não necessário para memória;
- rehidratar sempre pelo backend.

### Risco de patch

Uma remoção agressiva pode criar:

- flash de estado;
- navegação incorreta;
- regressão multi-contexto.

Por isso não fazer sem mapear consumidores.

### Testes

- reload com sessão;
- storage indisponível;
- múltiplas abas;
- logout;
- conta cliente;
- Owner;
- Professional;
- Admin.

### Critério de fechamento

O storage contém somente os dados necessários para bootstrap, sem ampliar PII
por conveniência.

---

## 12. FE-P2-04 — compatibilidade Bearer/localStorage ainda ativa

### Evidência atual

O cliente ainda pode:

```text
ler localStorage.token
→ Authorization: Bearer
```

e o backend ainda aceita Bearer.

`saveSession()` novo remove esse token.

### Estado

Compatibilidade de migração.

Não há evidência, nesta auditoria, de feature nova emitindo JWT para
localStorage.

### Risco

Enquanto existir:

- há duas estratégias de sessão;
- caminhos de teste/manutenção aumentam;
- futuro código pode reutilizar o legado por engano.

### Plano de retirada

Não remover às cegas.

Primeiro:

1. confirmar por logs/telemetria segura se Bearer legado ainda chega;
2. confirmar clientes/versões suportadas;
3. remover leitura client-side;
4. remover aceitação server-side em wave separada;
5. atualizar testes/documentação.

### Critério de fechamento

Cookie HttpOnly é o único transporte de sessão web suportado pelo runtime
canônico.

---

## 13. FE-P2-05 — política CSRF precisa ficar explícita

### Estado atual

Não foi observado token CSRF dedicado.

Controles atuais incluem:

- cookie `SameSite=Lax`;
- `Secure` em produção;
- APIs predominantemente JSON;
- mesma origem como topologia canônica;
- CORS allowlist para chamadas cross-origin.

### Interpretação

A auditoria **não demonstrou exploração CSRF atual**.

O problema é arquitetural:

> a segurança depende de premissas que podem mudar sem que exista um contrato
> explícito dizendo quando o threat model precisa ser reaberto.

### Decisão da Wave B

A topologia atual permanece sem token CSRF dedicado, mas passa a ter defesa
explícita para autoridade ambiente de cookie:

- `SameSite=Lax` continua requisito da sessão web;
- CORS continua restrito;
- métodos unsafe com cookie de sessão passam por `csrfProtection`;
- `Sec-Fetch-Site: cross-site` é recusado;
- `Origin` e, na ausência dele, `Referer` são validados quando presentes;
- requests sem cookie não entram nessa barreira;
- clientes não-browser sem metadados de origem permanecem compatíveis.

Essa política deve ser reavaliada antes de qualquer mudança de SameSite,
topologia de origem, embedding cross-site ou mutação autenticada por formulário
tradicional.

### Gatilhos obrigatórios para reavaliação

- `SameSite=None`;
- novo domínio/subdomínio de frontend;
- endpoints state-changing form-urlencoded;
- mutação via GET;
- embedding cross-site;
- autenticação por cookie em terceiros.

### Critério de fechamento

Existe decisão arquitetural explícita e testes proporcionais ao modelo escolhido.

---

# P3 — alinhamento e evolução

## 14. FE-P3-01 — X-Agenda-Access ausente do CORS

### Evidência

Capability pages usam:

```text
X-Agenda-Access
```

para consultas específicas.

`src/config/cors.js` não inclui esse header em `allowedHeaders`.

### Por que é P3

O deploy canônico observado serve React e API no mesmo origin.

Request same-origin não depende de preflight CORS.

### Quando vira P1/P2

Se frontend/API forem separados por origem, este item precisa subir de
prioridade antes do corte.

### Patch futuro

Adicionar `X-Agenda-Access` à allowlist e teste de OPTIONS/preflight.

### Critério de fechamento

Ou:

- arquitetura permanece same-origin e a limitação fica deliberadamente
  documentada;

ou:

- cross-origin passa a ser suportado e preflight é coberto por teste.

---

## 15. FE-P3-02 — Convites na navegação profissional fora do shell

### Evidência

`WorkspaceLayout.PROFESSIONAL_LINKS` contém:

```text
/convites
```

Mas `App.jsx` monta:

```jsx
<Route
  path={reactRoutes.professionalInvites}
  element={
    <ProtectedRoute>
      <ProfessionalInvitesPage />
    </ProtectedRoute>
  }
/>
```

fora do grupo:

```text
WorkspaceLayout
```

### Efeito

A profissional clica em um item da navegação do workspace e entra em uma tela
autenticada que não pertence ao `ProfessionalShell`.

Isso pode ser intencional por ser uma tela de transição.

Não há evidência de falha funcional.

### Decisão futura

Escolher uma semântica:

#### manter transição fora do shell

Nesse caso:

- documentar como intenção;
- revisar affordance/retorno.

#### transformar em parte do workspace profissional

Nesse caso:

- mover a rota;
- validar vínculo/contexto;
- revisar mobile;
- atualizar E2E/shell docs.

### Critério de fechamento

Composição visual e intenção de produto passam a ser deliberadas, não apenas um
efeito da posição da rota.

---

## 16. FE-P3-03 — metadata base compartilhada em páginas estáticas públicas

### Estado atual

Páginas como:

- Planos;
- Privacidade;
- Termos;

não possuem renderer server-side dedicado por página.

Elas recebem metadata base e podem ajustar title client-side quando implementado.

### Por que não é P1/P2

Nem toda página pública precisa ser um alvo de aquisição orgânica.

Adicionar metadata dedicada só faz sentido onde existir:

- intenção de busca;
- compartilhamento;
- landing;
- benefício mensurável.

### Próximo passo

Priorizar páginas de aquisição primeiro.

Depois medir necessidade de:

- Planos;
- Termos;
- Privacidade.

### Critério de fechamento

Cada página indexável possui metadata proporcional ao objetivo real, sem
complexidade server-side desnecessária.

---

## 17. FE-P3-04 — dois pipelines de analytics continuam coexistindo

### Estado atual

O browser mantém:

```text
Analytics V2 first-party
+
eventos_produto legado
```

Uma chamada `track(...)` pode alimentar ambos quando existe mapeamento.

### Interpretação

Isso **não é bug atual**.

É migração controlada.

### Risco

Se a coexistência ficar indefinida:

- schema duplica;
- manutenção aumenta;
- analistas podem somar contagens;
- features novas podem ampliar o legado.

### Condições antes de retirar o legado

Seguir
[`analytics-pipeline-reconciliation.md`](./analytics-pipeline-reconciliation.md):

- paridade observada em produção;
- divergências investigadas;
- relatórios migrados;
- período suficiente de comparação;
- nenhuma dependência operacional remanescente.

### Critério de fechamento

Pipeline legado pode ser retirado com evidência de que consumidores e métricas
já usam o V2 corretamente.

---

# Itens que NÃO devem ser tratados como bugs confirmados

## 18. CSRF

Ausência de token dedicado, sozinha, não prova vulnerabilidade.

É finding de arquitetura porque a segurança depende da topologia atual.

## 19. X-Agenda-Access/CORS

Same-origin atual evita preflight CORS.

É risco latente se a topologia mudar.

## 20. Dois pipelines de analytics

Coexistência é deliberada durante reconciliação.

Não apagar o legado apenas para "limpar código".

## 21. Metadata estática

Title genérico em uma página que não é alvo de aquisição não é automaticamente
defeito.

Decidir pelo objetivo.

## 22. Convites fora do shell

A rota funciona autenticada.

A pendência é de intenção/composição visual, não autorização.

---

# Dependências entre findings

## 23. Relações importantes

```text
FE-P1-02 UTM/Privacidade
  ↔ frontend-analytics-observabilidade
  ↔ PrivacyPage
  ↔ marketing-attribution

FE-P1-03 Meta Admin
  ↔ MetaAdsBridge
  ↔ analytics quality

FE-P1-04 noindex
  ↔ server.js
  ↔ robots.txt
  ↔ capability/reset

FE-P2-01 cache hero
  ↔ index.html preload
  ↔ HomePage
  ↔ httpCache
  ↔ Performance QA

FE-P2-03 storage
  ↔ session.js
  ↔ SessionContext
  ↔ bootstrap UX

FE-P2-04 Bearer
  ↔ api/client.js
  ↔ sessionCookie.js
  ↔ auth middleware
```

Alterar apenas um lado de uma dessas relações pode gerar regressão nova.

---

# Waves propostas

## 24. Wave A — hardening de sessão/medição/SEO sensível

Escopo recomendado:

```text
optionalAuth/revogação
Meta Admin
noindex rotas sensíveis
```

Características:

- patches pequenos;
- pouco acoplamento entre si;
- testes claros;
- sem migration;
- sem mudança visual ampla.

Validação:

```text
Vitest/Jest direcionado
→ lint
→ build
→ suíte relevante
→ Playwright se bridge/rotas afetarem browser
→ diff
```

## 25. Wave B — privacidade e threat model

Escopo:

```text
UTM first-party
texto de Privacidade
política CSRF
```

Essa wave exige decisão antes de código.

Não misturar decisão legal/de produto com refactor técnico silencioso.

## 26. Wave C — runtime e aquisição

Escopo:

```text
cache heroes
metadata server-side /para-profissionais
```

Validação adicional:

- HTTP/cache;
- social/SEO;
- Lighthouse;
- WebKit/mobile.

## 27. Wave D — redução de dívida

Escopo seletivo:

- storage;
- Bearer legado;
- CORS capability;
- shell de convites;
- metadata estática;
- analytics legado.

Só puxar um item dessa wave quando existir evidência/benefício concreto.

---

# Matriz de testes para fechamento

## 28. Cobertura mínima

| Finding | Teste principal | Teste complementar |
| --- | --- | --- |
| FE-P1-01 | middleware optionalAuth | Analytics V2 collector |
| FE-P1-02 | firstPartyAnalytics consent | Privacy/attribution |
| FE-P1-03 | MetaAdsBridge | E2E Admin se necessário |
| FE-P1-04 | spa-seo-http | deep link browser |
| FE-P2-01 | cache header | Lighthouse Home |
| FE-P2-02 | Supertest metadata | navegação React |
| FE-P2-03 | session storage | multi-tab/session |
| FE-P2-04 | auth/client | integração de sessão |
| FE-P2-05 | testes conforme decisão | auth/security |
| FE-P3-01 | CORS preflight | capability page |
| FE-P3-02 | shell/router | workspace mobile |
| FE-P3-03 | HTTP metadata | SEO smoke |
| FE-P3-04 | reconciliação | consumidores Admin |

---

# Métrica de impacto no produto

## 29. Relação com as prioridades do AF

### Confiabilidade dos agendamentos

Nenhum finding desta matriz muda hoje a regra de slot, lifecycle ou
persistência do booking.

Por isso não foi criada artificialmente uma P0 de booking.

### Segurança e privacidade

Itens mais relevantes:

- FE-P1-01;
- FE-P1-02;
- FE-P1-03;
- FE-P1-04;
- FE-P2-03;
- FE-P2-05.

### Aquisição e ativação profissional

Itens:

- FE-P2-02;
- FE-P2-01 quando a imagem de aquisição muda;
- FE-P3-03.

### Conversão/retenção/receita

Não usar esta matriz para reclassificar:

- checkout visto;
- pagamento;
- assinatura;
- booking.

Nenhum finding autoriza alterar a semântica do funil.

### Mobile

Mudanças de shell/cache/landing precisam continuar cobertas por WebKit/mobile.

---

# Critério para executar um finding

## 30. Antes do patch

Para cada ID:

1. confirmar que o código ainda reproduz a evidência;
2. verificar se `main` mudou desde esta auditoria;
3. identificar arquivos atingidos;
4. identificar testes existentes;
5. definir comportamento esperado;
6. alterar em branch própria ou wave coerente;
7. rodar validação proporcional;
8. revisar diff;
9. atualizar os docs afetados;
10. só então considerar merge.

## 31. Depois do patch

Não deixar o finding marcado como "aberto" se já foi corrigido.

Atualizar:

- esta matriz;
- documento especializado;
- teste/contrato;
- `AGENTS.md` somente se a correção introduzir decisão durável nova.

Correção puramente técnica de um gap já definido normalmente não exige nova
regra no `AGENTS.md`.

---

# Critérios de status

## 32. Estados

Usar:

```text
aberto
decisão pendente
em implementação
validando
resolvido
aceito deliberadamente
obsoleto
```

Não usar "resolvido" apenas porque um patch foi escrito.

## 33. Evidência de resolvido

É necessário:

- diff correspondente;
- teste;
- build/CI proporcional;
- comportamento verificado;
- documentação reconciliada.

Para performance/SEO, incluir evidência específica da camada.

---

# Ownership documental

## 34. Fonte detalhada por finding

| Finding | Documento de detalhe |
| --- | --- |
| FE-P1-01 | `frontend-seguranca.md`, `session-security.md` |
| FE-P1-02 | `frontend-analytics-observabilidade.md` |
| FE-P1-03 | `frontend-analytics-observabilidade.md` |
| FE-P1-04 | `frontend-entrega-runtime.md` |
| FE-P2-01 | `frontend-entrega-runtime.md`, `performance-qa.md` |
| FE-P2-02 | `frontend-entrega-runtime.md` |
| FE-P2-03 | `frontend-seguranca.md` |
| FE-P2-04 | `frontend-seguranca.md`, `session-security.md` |
| FE-P2-05 | `frontend-seguranca.md` |
| FE-P3-01 | `frontend-seguranca.md` |
| FE-P3-02 | `frontend-mapa-telas-jornadas.md` |
| FE-P3-03 | `frontend-entrega-runtime.md` |
| FE-P3-04 | `analytics-pipeline-reconciliation.md` |

## 35. Manutenção

Esta matriz é intencionalmente mutável.

Ela deve ser revisada quando:

- um finding for corrigido;
- uma premissa mudar;
- uma nova auditoria encontrar gap relevante;
- o frontend/API mudar de topologia;
- uma decisão de privacidade/SEO for tomada.

Ela não deve acumular itens resolvidos indefinidamente.

Histórico de execução pertence a PRs/commits/waves, não a uma lista crescente de
dívida encerrada.
