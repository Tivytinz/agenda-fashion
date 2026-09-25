# Analytics e observabilidade do frontend — Agenda Fashion

> **Papel documental:** referência técnica especializada para instrumentação de
> navegador, consentimento, atribuição, reconciliação entre pipelines e entrega
> de conversões de marketing.
>
> A classificação canônica de aquisição continua em
> [`marketing-attribution.md`](./marketing-attribution.md). A coexistência entre
> telemetrias continua em
> [`analytics-pipeline-reconciliation.md`](./analytics-pipeline-reconciliation.md).
> Este documento descreve especificamente o **frontend e sua fronteira com o
> backend**.

## 1. Objetivo

O frontend do AF produz sinais para quatro finalidades diferentes:

1. observabilidade first-party da navegação e da jornada;
2. eventos comportamentais legados ainda consumidos por partes do produto;
3. medição opcional de Google e Meta;
4. contexto de aquisição usado para vincular cadastro e conversão a campanha.

Esses sinais não são equivalentes.

A regra principal é:

> telemetria de navegador explica comportamento; fatos transacionais continuam
> pertencendo ao backend e ao banco.

Por isso, nenhuma leitura de growth deve tratar:

- page view;
- clique;
- compartilhamento;
- início de booking;
- checkout visualizado;
- conversão de Ads;

como substituto automático para:

- conta criada;
- negócio criado;
- serviço persistido;
- negócio publicado;
- agendamento real;
- pagamento confirmado;
- assinatura ativa;
- receita.

## 2. Arquitetura resumida

O runtime atual possui este desenho:

```text
React Router
   │
   ├── FirstPartyAnalyticsBridge
   │      │
   │      └── firstPartyAnalytics.js
   │              │
   │              └── POST /analytics/collect
   │                     └── Analytics V2 first-party
   │
   ├── chamadas track(...)
   │      │
   │      ├── trackFirstPartyEvent(...)
   │      │      └── /analytics/collect
   │      │
   │      └── POST /eventos-produto
   │             └── pipeline legado
   │
   └── DeferredMetaAdsBridge (~500 ms)
          │
          ├── Google Measurement / Google Ads
          ├── Meta Pixel
          └── sincronização de consentimento com a conta
```

Conversões financeiras finais seguem outra fronteira:

```text
Asaas webhook
   → ativação real da assinatura
   → fila persistida de conversões
       ├── Meta CAPI: Subscribe
       └── Google Measurement Protocol: purchase
```

O último fluxo é backend-authoritative.

## 3. Quatro camadas que não devem ser somadas

### Analytics V2 first-party

Arquivos principais:

```text
frontend/src/analytics/firstPartyAnalytics.js
frontend/src/components/FirstPartyAnalyticsBridge.jsx
src/routes/analyticsV2Routes.js
src/services/analyticsV2Service.js
```

Mede:

- page view;
- engagement;
- eventos de jornada whitelistados;
- aquisição first-party;
- sessão/visitante pseudônimos.

### Eventos de produto legados

Arquivos principais:

```text
frontend/src/analytics/track.js
frontend/src/analytics/trackEvent.js
src/routes/eventoProdutoRoutes.js
src/services/eventoProdutoService.js
```

Mede eventos comportamentais historicamente usados no AF.

### Google/Meta no navegador

Arquivos:

```text
frontend/src/analytics/googleMeasurement.js
frontend/src/analytics/metaAds.js
frontend/src/analytics/marketingConsent.js
frontend/src/components/MetaAdsBridge.jsx
```

Dependem da preferência de medição de marketing.

### Conversões server-side

Arquivos principais:

```text
src/services/metaAdsService.js
src/services/googleMeasurementService.js
src/services/marketingConversionDeliveryService.js
src/services/webhookService.js
```

Representam integrações de conversão disparadas a partir de fatos do backend.

Não somar essas quatro camadas como se fossem quatro usuários ou quatro
conversões diferentes.

## 4. FirstPartyAnalyticsBridge

`FirstPartyAnalyticsBridge` monta no ciclo principal da aplicação, antes das
rotas.

Ele observa:

- `pathname`;
- `search`;
- `location.state`;
- `location.key`.

A cada navegação chama:

```js
startFirstPartyPageView(...)
```

Esse bridge **não depende do MetaAdsBridge**.

Isso é intencional: uma pessoa pode entrar e interagir rapidamente antes de a
camada de Ads terminar de carregar.

## 5. Bridge de Ads diferido

O `MetaAdsBridge` é carregado por `React.lazy` e o App ainda espera
aproximadamente 500 ms antes de montá-lo.

Objetivos:

- retirar Ads da cadeia inicial crítica;
- preservar performance pública;
- manter medição opcional separada da telemetria first-party.

Consequência:

> instrumentação first-party de produto não pode depender da inicialização de
> Google ou Meta.

## 6. Identidade do Analytics V2

O navegador mantém:

```text
visitorUuid
sessionUuid
viewUuid
eventUuid
flowUuid (quando aplicável)
```

### visitorUuid

Persistido em storage local.

Representa uma identidade pseudônima do navegador para Analytics V2.

Não equivale a:

- `usuarios.id`;
- `clientes.id`;
- WhatsApp;
- conta autenticada.

### sessionUuid

Persistido em session storage e renovado conforme o contrato de sessão do
Analytics V2.

A janela de atividade atual é de 30 minutos.

### Identidade autenticada

O endpoint `/analytics/collect` usa `optionalAuth`.

Quando existe sessão autenticada, o backend pode vincular:

```text
visitante pseudônimo
   ↔ usuario_id
```

como identidade observada de login.

Isso não permite fundir clientes por telefone.

## 7. Sessionização não é compartilhada entre os pipelines

O pipeline legado possui seu próprio `sessao_id`, gerado por
`track.js`.

O Analytics V2 possui `sessionUuid` próprio.

Portanto:

```text
sessão legado ≠ sessão Analytics V2
```

A reconciliação técnica pode comparar eventos equivalentes, mas diferença de
contagem de sessões, isoladamente, não prova perda de telemetria.

## 8. Page views first-party

A rota é transformada em:

```text
pageKey
routeTemplate
```

Exemplos:

| URL real | pageKey | routeTemplate |
| --- | --- | --- |
| `/` | `home` | `/` |
| `/para-profissionais` | `professional_landing` | `/para-profissionais` |
| `/negocio/studio-aurora` | `business_profile` | `/negocio/:slug` |
| `/painel/servicos/321/editar` | `edit_service` | `/painel/servicos/:id/editar` |
| `/servicos/unha/em/goiania` | `local_catalog` | `/servicos/:categoria/em/:localidade` |

A normalização evita persistir identificadores dinâmicos desnecessários na rota.

## 9. Área Admin no Analytics V2

Rotas `/admin` e `/admin/*` são classificadas como `admin`.

O `startFirstPartyPageView` encerra a view anterior e não cria nova medição
first-party do uso administrativo.

Objetivo:

- não inflar usuários ativos;
- não misturar operação interna com uso real do marketplace.

## 10. Engagement

O Analytics V2 mede tempo engajado da view.

Eventos do navegador usados:

- `visibilitychange`;
- `pagehide`;
- navegação React.

Quando a página fica oculta, o tempo visível acumulado é enviado.

Quando volta a ficar visível, a contagem retoma.

Isso mede presença visível, não prova atenção humana.

## 11. Eventos first-party permitidos

O backend aceita hoje os eventos frontend:

```text
business_creation_started
first_service_creation_started
profile_viewed
profile_shared
booking_started
booking_completed
checkout_viewed
```

Propriedades também são whitelistadas por evento.

O browser não pode inventar um nome arbitrário e esperar que o backend o aceite.

## 12. Eventos automáticos de jornada

Alguns eventos são criados automaticamente no page view.

### Início de criação de negócio

Ao entrar em `/criar-negocio`:

```text
business_creation_started
```

Isso significa **início da etapa**, não negócio persistido.

### Primeiro serviço

Ao entrar em `/painel/servicos/novo` no contexto de onboarding:

```text
first_service_creation_started
```

Isso significa início da criação, não serviço salvo.

### Checkout

Ao entrar em `/checkout`:

```text
checkout_viewed
```

Isso significa visualização da tela, não PIX gerado e não checkout transacional
concluído.

## 13. Conversão de nomes do legado para Analytics V2

`trackFirstPartyEvent` traduz alguns eventos existentes.

| Evento chamado pela feature | Evento Analytics V2 |
| --- | --- |
| `perfil_visualizado` | `profile_viewed` |
| `link_negocio_copiado` | `profile_shared` |
| `link_negocio_compartilhado` | `profile_shared` |
| `link_servico_copiado` | `profile_shared` |
| `link_servico_compartilhado` | `profile_shared` |
| `agendamento_iniciado` | `booking_started` |
| `agendamento_concluido` | `booking_completed` |

Eventos não reconhecidos pelo contrato V2 são ignorados pela camada V2 mesmo que
continuem válidos no pipeline legado.

## 14. Agendar novamente

Quando o legado envia:

```text
agendamento_iniciado
origem = agendar_novamente
```

o V2 converte para:

```text
booking_started
intent = repeat_booking
```

O status de origem pode acompanhar o evento como contexto seguro.

Isso mede intenção de criar uma nova reserva.

Não confundir com reagendamento transacional de booking existente.

## 15. booking_completed de frontend

Quando a UI envia `agendamento_concluido`, o V2 pode receber:

- `bookingId`;
- `targetBusinessId`;
- `targetServiceId`.

O backend não confia nesses IDs cegamente.

Antes de vincular o evento ao booking, ele valida o registro real.

Portanto:

```text
browser diz "booking completed"
         ↓
backend valida booking persistido
         ↓
analytics pode guardar vínculo auditável
```

Mesmo assim, a tabela `agendamentos` continua sendo a fonte do fato.

## 16. Eventos transacionais backend

O Analytics V2 também possui eventos de origem backend que não devem ser
reemitidos pelo navegador.

Exemplos documentados na reconciliação:

- `booking_created`;
- `booking_rescheduled`;
- `booking_cancelled`;
- `booking_no_show`;
- `booking_completed` com `origem='backend'`.

Eles representam projeções auditáveis de uma mudança persistida.

O frontend não deve criar versões "parecidas" desses eventos para tentar
aumentar cobertura.

## 17. Outbox first-party

Todo lote first-party entra primeiro em um outbox local.

Contrato atual:

```text
TTL: 24 horas
máximo: 40 lotes
flush por execução: até 10 lotes
```

Isso reduz perda em:

- rede instável;
- navegação rápida;
- fechamento de página;
- reconexão.

## 18. Erro transitório versus permanente no outbox

Falhas transitórias preservam o item para retry.

O código atual trata como não-retryable:

```text
400
401
403
409
413
422
```

Esses lotes são removidos para impedir que um payload permanentemente rejeitado
bloqueie toda a fila.

Erros de rede e respostas transitórias deixam o lote no outbox.

## 19. Retry do outbox

O outbox é drenado:

- em novos envios;
- quando o navegador volta a ficar online;
- em flushs do ciclo de vida.

Analytics continua fail-soft.

Uma falha de telemetria nunca pode impedir:

- cadastro;
- booking;
- checkout;
- navegação.

## 20. Keepalive

Eventos de saída/fechamento podem usar `keepalive`.

Isso aumenta a chance de entrega quando a página está sendo encerrada.

Não é garantia de entrega.

Por isso existe outbox/idempotência no backend.

## 21. Idempotência do Analytics V2

Views e eventos usam UUIDs.

O backend persiste IDs únicos e pode receber retry sem transformar automaticamente
o mesmo evento em vários fatos.

Ao alterar retry, preserve o mesmo identificador do item já enfileirado.

Não recriar UUID a cada tentativa de envio da mesma unidade lógica.

## 22. Aquisição no Analytics V2

`captureAcquisition()` pode capturar:

- `utm_source`;
- `utm_medium`;
- `utm_campaign`;
- `utm_content`;
- `utm_term`;
- landing page;
- host externo de referrer.

Click IDs suportados incluem:

- `gclid`;
- `gbraid`;
- `wbraid`;
- `fbclid`;
- `msclkid`;
- `ttclid`.

No código atual, click IDs só entram quando o consentimento de marketing está
concedido.

## 23. UTM first-party versus consentimento de Ads

O comportamento executável atual do Analytics V2 é:

```text
sem consentimento de marketing
  → UTM first-party pode ser capturada
  → landing page pode ser capturada
  → referrer host pode ser capturado
  → click IDs de Ads não são capturados
```

Há teste automatizado específico garantindo UTM sem click ID antes do
consentimento.

Isso é diferente do pipeline legado de atribuição, descrito adiante.

## 24. Achado de reconciliação de privacidade

A página de Privacidade atualmente afirma que a "origem da campanha" opcional é
tratada somente quando existe autorização para medição de marketing.

Ao mesmo tempo, o Analytics V2 implementado e seus testes permitem UTM
first-party antes dessa autorização, excluindo click IDs.

Portanto existe uma **divergência documental/semântica que precisa de decisão
explícita de produto, privacidade e engenharia**.

Nesta branch de documentação:

- o comportamento executável não foi alterado;
- o texto legal não foi reescrito silenciosamente;
- a divergência fica registrada para reconciliação posterior.

Não afirmar conformidade integral desse ponto até a decisão ser fechada.

## 25. Classificação de canal no backend V2

O navegador envia evidência observada.

O backend então classifica a sessão usando:

- UTM;
- click IDs;
- referrer host;
- campanha oficial quando encontrada.

Canais atuais incluem, entre outros:

- paid search;
- paid social;
- organic search;
- organic social;
- email;
- AI assistant;
- referral;
- direct;
- other.

A canonicalização de campanha pertence ao backend/documento de atribuição, não à
UI.

## 26. Host de referrer

O frontend preserva apenas o host externo.

Exemplo:

```text
https://www.google.com/search?q=manicure...
         ↓
www.google.com
```

A query do referrer não precisa ser persistida para classificar origem.

Navegação interna não cria referrer de aquisição.

## 27. Pipeline legado eventos_produto

`track()` produz um payload como:

```text
nome
pagina
missao
sessao_id
negocio_id
propriedades
```

O endpoint é:

```text
POST /eventos-produto
```

O backend aplica whitelist de:

- nomes de evento;
- páginas;
- missões;
- chaves de propriedades.

O navegador não define livremente o schema persistido.

## 28. trackEvent.js

`trackEvent.js` é uma facade mínima que faz import dinâmico de `track.js`.

Objetivo:

- permitir instrumentação sem puxar imediatamente toda a camada legada;
- manter erro de analytics fail-soft.

Não criar uma terceira facade concorrente para o mesmo pipeline.

## 29. Fan-out de track()

Hoje uma chamada `track(...)` pode fazer duas coisas:

```text
track(...)
   ├── tenta mapear evento para Analytics V2
   └── envia evento legado /eventos-produto
```

Por isso, ao analisar volume:

> um mesmo gesto pode existir nos dois pipelines por desenho.

A reconciliação compara os pipelines; não soma seus totais.

## 30. Atribuição no pipeline legado

`track.js` mantém uma atribuição local com:

- first touch;
- last touch;
- janela de 30 dias.

Parâmetros reconhecidos:

```text
utm_source
utm_medium
utm_campaign
utm_content
utm_term
gclid
gbraid
wbraid
fbclid
msclkid
ttclid
epik
af_source
af_medium
af_content
```

A landing page também é preservada.

## 31. Consentimento no legado

Diferente do Analytics V2 first-party, a atribuição de `track.js` só é
capturada quando:

```text
MARKETING_CONSENT.GRANTED
```

Se a preferência não está concedida:

- atribuição local é limpa;
- contexto de marketing retorna sem UTMs/click IDs;
- eventos de produto continuam podendo existir sem essa atribuição opcional.

Essa diferença entre pipelines é intencional no código atual e deve ser
considerada ao reconciliar cobertura.

## 32. first touch e last touch

Quando chega uma nova campanha dentro da janela:

```text
first touch → permanece
last touch  → atualiza
```

A janela não é prolongada indefinidamente por cada novo toque.

Depois da expiração, a atribuição anterior deixa de ser reaplicada.

## 33. Links próprios do AF

Links de compartilhamento podem carregar sinais como:

```text
af_source=agenda_fashion
af_medium=share
af_content=negocio|servico
```

Esses sinais ajudam a entender entrada por compartilhamento do próprio produto.

Eles não provam causalidade de receita por si só.

## 34. getMarketingContext

No cadastro, o frontend pode construir contexto com:

- intenção;
- sessão;
- first/last touch;
- consentimento;
- landing page.

Esse contexto é enviado ao backend para vincular a conta criada à evidência de
aquisição.

Backend persiste/reconcilia a atribuição.

Não use esse objeto para conceder benefício, papel ou plano.

## 35. Preferência de marketing

Estados:

```text
unknown
granted
denied
```

A escolha atual é persistida como versão 2 e inclui:

- status;
- timestamp;
- versão do texto.

Versão de texto atual no código:

```text
2026-08-25
```

Uma mudança relevante no texto que exija nova autorização deve atualizar o
contrato de consentimento correspondente.

## 36. Google Consent Mode

Antes de qualquer aceite, o frontend configura default:

```text
analytics_storage: denied
ad_storage: denied
ad_user_data: denied
ad_personalization: denied
```

A tag Google não precisa ser carregada para aplicar o default local.

Quando consentido:

- analytics/ad storage podem ser granted;
- `ad_personalization` permanece denied.

O AF usa medição, não habilita personalização pela configuração atual.

## 37. Google só inicializa após consentimento

`initializeGoogleMeasurement` retorna sem carregar GA4 quando o consentimento
não está concedido.

Depois do aceite:

- busca configuração pública no backend;
- configura GA4;
- pode configurar Google Ads;
- desativa page view automático;
- envia page views manualmente e sanitizados.

## 38. Rotas sanitizadas para Google

Google recebe paths normalizados.

Exemplos:

```text
/negocio/studio-aurora
  → /negocio/:slug

/servicos/unha/em/goiania
  → /servicos/:categoria/em/:localidade

/painel/servicos/123/editar
  → /painel/servicos/:id/editar
```

Queries são removidas.

Paths não reconhecidos caem em:

```text
/pagina
```

Isso reduz risco de enviar token, busca, e-mail ou identificador dinâmico presente
na URL.

## 39. Page title e referrer Google

O frontend fornece um conjunto controlado de títulos.

`page_referrer` enviado pela implementação fica vazio.

Não construir títulos de GA4 usando nome/WhatsApp/e-mail/slug livre.

## 40. user_id Google

Quando autenticada, a camada pode configurar:

```text
user_id = usuario.id
```

É identificador interno, não e-mail.

A ausência de usuário não impede page view anônimo/pseudônimo após consentimento.

## 41. Área Admin no Google

No `MetaAdsBridge`, qualquer rota:

```text
/admin
/admin/*
```

é bloqueada para Google Measurement.

Ao entrar no Admin, o runtime aplica consentimento Google negado temporariamente
sem alterar a preferência persistida.

Ao voltar ao produto, a medição pode ser retomada de acordo com a escolha salva.

## 42. Redefinição de senha

`/redefinir-senha` é rota sensível.

Nela o bridge atual bloqueia:

- inicialização Google;
- page view Google;
- inicialização Meta;
- page view Meta.

Além disso, sanitização de URL impede query/token de aparecer em page context.

## 43. Meta na área Admin: Wave A

A Wave A alinhou a política dos providers no bridge do navegador.

Na branch atual:

- Analytics V2 first-party exclui Admin;
- Google exclui Admin;
- Meta também bloqueia inicialização e `PageView` em `/admin` e `/admin/*`;
- redefinição de senha continua bloqueada para Google e Meta.

A preferência de marketing não é apagada apenas por entrar no Admin. Ao voltar
para uma rota elegível, a medição pode retomar conforme o consentimento salvo.

A regressão está coberta em `MetaAdsBridge.test.jsx` e permanece em validação
até Quality Gate/merge.

## 44. Meta Pixel

Meta só inicializa quando:

```text
consentimento = granted
config Meta = enabled
```

Ao inicializar:

- cria/configura `fbq`;
- aplica consent grant;
- injeta script oficial;
- usa PageView manual.

Ao revogar:

- envia `consent revoke` quando possível;
- remove `_fbp`;
- remove `_fbc`.

## 45. Meta event context

Para conversões críticas, o browser cria um contexto.

### Consentimento desconhecido

Retorna:

```text
null
```

### Negado

Retorna:

```json
{
  "consentimento": false
}
```

### Concedido

Inclui:

- `consentimento: true`;
- `event_id`;
- `fbp`;
- `fbc`;
- `source_url`.

O `source_url` é reduzido a origin + pathname no backend.

## 46. Cadastro profissional: Meta

No cadastro com intenção profissional:

1. frontend cria `event_id`;
2. envia o contexto `meta` junto do cadastro;
3. backend cria a conta;
4. backend salva consentimento quando aplicável;
5. backend dispara `CompleteRegistration` via CAPI de forma fail-soft;
6. resposta retorna `contaCriada=true`;
7. frontend dispara `CompleteRegistration` no Pixel com o **mesmo event_id**.

Esse compartilhamento de ID é o mecanismo de deduplicação browser/server.

O evento só é disparado no frontend quando a conta realmente foi criada.

Login de conta já existente não deve disparar cadastro.

## 47. Cadastro profissional: Google

Depois de confirmação de:

```text
contaCriada === true
E
professionalIntent === true
```

o frontend envia:

```text
GA4 sign_up
Google Ads conversion (se label configurada)
```

Método:

- `email`;
- `google`.

O transaction id segue o padrão do usuário criado quando disponível.

Esse evento de marketing não substitui `usuarios.created_at` como fato de
cadastro.

## 48. Cadastro cliente versus profissional

A instrumentação de conversão profissional deve continuar diferenciando
intenção profissional.

Conta criada como cliente não deve ser automaticamente tratada como aquisição de
profissional apenas porque usa a mesma tela de Auth.

Essa distinção é fundamental para o funil AF.

## 49. Checkout visto versus checkout criado

Há pelo menos três fatos diferentes:

```text
checkout_viewed
  → pessoa abriu /checkout

begin_checkout / InitiateCheckout
  → POST /checkout teve sucesso e a tentativa foi criada/retornada

pagamento confirmado + assinatura ativa
  → conversão financeira final
```

Não usar um como proxy do outro.

## 50. Checkout: contexto Meta

Antes do POST, o frontend cria:

```text
Idempotency-Key
Meta event_id
```

Ambos permanecem ligados à mesma tentativa lógica no browser.

O `event_id` é enviado ao backend no body.

## 51. Checkout: Meta browser + CAPI

Após `POST /checkout` bem-sucedido:

Backend:

- dispara `InitiateCheckout` via CAPI usando o contexto recebido.

Frontend:

- dispara `InitiateCheckout` no Pixel com o mesmo `event_id`.

Novamente, o ID compartilhado existe para deduplicar browser/server no Meta.

Uma falha do Pixel ou CAPI não desfaz a cobrança já criada.

## 52. Checkout: Google

Depois do POST bem-sucedido, o frontend envia:

```text
begin_checkout
```

com:

- currency;
- value;
- item/plan;
- transaction id baseado na tentativa de checkout.

Se Google Ads estiver configurado, a conversão correspondente também é enviada.

Isso não significa pagamento.

## 53. Idempotency-Key versus event_id

São conceitos distintos.

### Idempotency-Key

Protege criação de checkout no backend.

### Meta event_id

Permite correlacionar/deduplicar entrega browser/CAPI.

Não reutilizar um substituindo o outro.

No código atual, a tentativa mantém ambos no mesmo objeto para coerência, mas
cada identificador possui responsabilidade diferente.

## 54. Conversão financeira final

A conversão final não depende do navegador permanecer aberto.

Fluxo:

```text
Asaas
  → webhook autenticado
  → pagamento confirmado
  → ativação transacional da assinatura
  → marketing_conversoes_entregas
```

Somente depois desse fato o backend prepara conversões finais.

## 55. Fila persistida de conversões

Tabela:

```text
marketing_conversoes_entregas
```

Providers:

- `meta`;
- `google`.

Status:

- `PENDING`;
- `PROCESSING`;
- `SENT`;
- `IGNORED`;
- `FAILED`.

Existe unicidade por:

```text
provedor + tipo_evento + chave_evento
```

Isso reduz duplicação de entrega em retries.

## 56. Retry de conversão final

A fila possui:

- lease;
- `FOR UPDATE SKIP LOCKED`;
- recuperação de processamento abandonado;
- retry;
- máximo atual de 5 tentativas;
- erro terminal quando aplicável.

Falha temporária no provider não reverte o pagamento nem a assinatura.

## 57. Meta final: Subscribe

Para primeiro pagamento da assinatura:

```text
Meta CAPI
event_name = Subscribe
```

O backend busca o perfil/consentimento persistido.

Sem consentimento válido:

```text
IGNORED: sem_consentimento
```

Renovação não é reenviada como primeira conversão:

```text
IGNORED: renovacao
```

## 58. Google final: purchase

Para primeiro pagamento:

```text
Google Measurement Protocol
event_name = purchase
```

O backend usa:

- `google_client_id` persistido;
- `usuario_id`;
- valor real do pagamento;
- timestamp do pagamento;
- transaction id server-side.

Sem consentimento/client id válido, a conversão não é fabricada.

## 59. Receita vem do backend

O valor enviado em uma conversão final vem do pagamento persistido/reconciliado,
não do preço que estava no DOM.

Esse princípio deve permanecer para qualquer novo provider.

Frontend pode exibir preço, mas:

> receita e entitlement são fatos server-side.

## 60. Google client_id

Depois de consentimento, o navegador pode pedir o `client_id` ao GA4.

A leitura possui timeout curto.

Quando autenticada, a preferência e o client id podem ser sincronizados ao
backend.

O backend usa esse identificador depois para Measurement Protocol quando existe
consentimento válido.

## 61. Sincronização de consentimento

A preferência vale localmente assim que a pessoa escolhe.

Quando autenticada, o frontend tenta sincronizar a escolha com o backend.

Para Google existe registro local de sincronização pendente.

Retry pode ocorrer quando:

- conexão volta;
- aba volta a ficar visível;
- pessoa clica em tentar novamente.

Falha de sincronização mostra aviso, mas não altera silenciosamente a escolha
local.

## 62. Página de Privacidade

A página `/privacidade` permite:

- ver o status atual;
- permitir;
- negar;
- retirar autorização anterior.

Negar:

- limpa atribuição opcional do legado;
- remove cookies Meta;
- remove cookies Google;
- atualiza Consent Mode;
- tenta sincronizar a decisão.

Uso principal da plataforma continua disponível.

## 63. Ads desativados por configuração

Se backend informa:

```text
enabled = false
```

a camada não deve inventar IDs ou carregar scripts.

A interface pode continuar funcionando sem:

- Google;
- Meta;
- pixels;
- labels de conversão.

Integrações de marketing são fail-soft.

## 64. Configuração pública versus segredo

O navegador recebe apenas configuração pública necessária, como:

- Measurement ID;
- Ads ID;
- labels;
- Pixel ID.

Segredos permanecem no backend:

- GA4 API secret;
- Meta CAPI token;
- credenciais de leitura administrativa;
- credenciais de providers.

Nunca mover segredo para `VITE_*`.

## 65. PII e eventos

Não enviar em eventos comportamentais:

- senha;
- CPF/CNPJ;
- e-mail;
- WhatsApp;
- endereço completo;
- token de reset;
- capability;
- conteúdo livre de formulário.

Quando provider exige user data server-side, o backend aplica contrato próprio,
como hashing de e-mail/telefone para Meta CAPI.

O frontend não deve adicionar PII crua ao objeto `properties`.

## 66. IDs permitidos não são PII livre

Alguns eventos podem carregar IDs internos necessários para reconciliação, como:

- negócio;
- serviço;
- profissional;
- agendamento.

Mesmo nesses casos:

- validar no backend;
- usar somente quando necessário;
- não codificar nome/e-mail/telefone no identificador.

## 67. Query string sensível

Não construir page view externo com:

```text
window.location.href
```

sem sanitização.

A implementação Google atual remove query strings.

Isso protege rotas como redefinição de senha e buscas que possam conter dado
livre.

## 68. Telemetria não pode quebrar produto

Toda chamada de analytics deve seguir o princípio:

```text
produto primeiro
telemetria depois
```

Falhas devem ser:

- capturadas;
- registradas quando necessário;
- retryable quando apropriado;
- não bloqueantes.

Não usar:

```js
await analytics();
await salvarBooking();
```

quando a primeira operação puder impedir o booking.

## 69. Momento correto do evento

O nome do evento precisa refletir o momento real.

Exemplos:

### errado

```text
clicou "Criar conta"
→ enviar CompleteRegistration
```

### atual

```text
backend confirmou conta criada
→ CompleteRegistration/sign_up
```

### errado

```text
abriu checkout
→ purchase
```

### atual

```text
backend confirmou primeiro pagamento e ativou assinatura
→ Subscribe/purchase server-side
```

## 70. Matriz de fatos do funil

| Marco | Fonte canônica | Sinal frontend útil |
| --- | --- | --- |
| visita | analytics | page view |
| cadastro profissional | `usuarios` + perfil profissional | CompleteRegistration/sign_up após resposta |
| negócio criado | `negocios` | business_creation_started mede início |
| serviço cadastrado | `servicos` | first_service_creation_started mede início |
| negócio publicado | estado backend de publicação | UI pode refletir resposta |
| agenda confirmada/personalizada | backend agenda | evento comportamental de agenda |
| primeiro agendamento | `agendamentos` | booking_completed é telemetria auxiliar |
| checkout visto | analytics | checkout_viewed |
| checkout criado/PIX gerado | backend checkout/pagamento | begin_checkout / InitiateCheckout |
| pagamento confirmado | pagamentos/webhook | não depender do browser |
| assinatura ativa | assinaturas + negócio | Subscribe/purchase server-side |
| receita | pagamentos confirmados | provider event é projeção, não ledger |
| recorrência | bookings/pagamentos reais | eventos browser são diagnóstico |

## 71. Compartilhamento

`PublicShareButton` já concentra:

- link rastreável;
- método share/copy;
- evento comportamental;
- contexto de negócio/serviço.

Não duplicar `navigator.share` em outra feature para o mesmo caso e esquecer a
instrumentação.

Compartilhar é intenção.

Não equivale a:

- visita;
- booking;
- receita.

## 72. Perfil visualizado

`profile_viewed`/ `perfil_visualizado` mede passagem pelo perfil.

Quando usado em leitura pós-publicação, o backend/documento de atribuição aplica
regras para não tratar visualização do próprio dono como avanço real do funil
quando a análise exigir visitante externo.

Frontend não deve tentar decidir sozinho a causalidade dessa visita.

## 73. Booking iniciado

`booking_started` mede intenção.

Pode haver:

- abandono;
- slot inválido;
- conflito;
- erro;
- cancelamento.

Portanto:

```text
booking_started ≠ booking criado
```

## 74. Booking completado de browser

Mesmo nome "completed" no pipeline frontend significa conclusão da jornada de
interface.

O fato transacional continua no booking persistido.

Para relatórios operacionais, sempre preferir o registro real.

## 75. Checkout viewed

`checkout_viewed` é útil para identificar perda entre:

```text
planos
  → checkout
  → PIX
```

Mas ele não deve entrar sozinho como checkout financeiro iniciado.

Ao comparar campanhas, deixar claro qual definição está sendo usada.

## 76. Eventos de agenda

O pipeline legado possui eventos como:

- `agenda_configuracao_visualizada`;
- `agenda_configuracao_salvamento_tentado`;
- `agenda_configuracao_erro`;
- `agenda_configurada`.

Eles são diagnósticos da passagem pelos horários.

Não transformam agenda em gate canônico de ativação.

## 77. Eventos de dashboard/growth

Há eventos legados para:

- próxima ação;
- oportunidade de crescimento;
- Copilot;
- mudança de período;
- ações de dashboard.

São sinais de uso da interface.

Não substituem:

- booking;
- retenção;
- receita.

## 78. Admin não é usuário do funil

Ações do Admin representam operação interna.

Por isso:

- first-party V2 exclui Admin;
- Google exclui Admin;
- relatórios GA4 backend também filtram landing de Admin.

A política Meta Admin ainda precisa ser reconciliada conforme o achado deste
documento.

## 79. Observabilidade versus attribution

São perguntas diferentes.

### Observabilidade

```text
o que a pessoa fez?
onde abandonou?
quanto tempo ficou?
qual jornada percorreu?
```

### Attribution

```text
qual evidência de origem existe?
qual campanha oficial pode receber crédito?
qual investimento pode ser relacionado?
```

Um evento de UX não resolve atribuição sozinho.

## 80. Attribution versus causalidade

Uma UTM, click ID ou referrer é evidência de origem.

Não prova que:

- anúncio causou a venda;
- compartilhamento causou booking;
- última página causou conversão.

Relatórios devem manter a linguagem compatível com a evidência disponível.

## 81. First-party versus GA4

O AF mantém medição first-party própria e GA4 opcional.

Não esperar contagens idênticas.

Diferenças possíveis:

- consentimento;
- bloqueadores;
- sessionização;
- retry/outbox;
- sanitização;
- navegador;
- janela temporal;
- filtros do Admin.

Comparar conceitos equivalentes e documentar denominador.

## 82. First-party versus eventos_produto

Esses dois pipelines coexistem temporariamente.

A regra da reconciliação é:

```text
comparar eventos equivalentes
não somar
não substituir fatos transacionais
```

Remoção do legado exige a checklist definida em
`analytics-pipeline-reconciliation.md`.

## 83. Google versus Meta

Google e Meta também não precisam ter volumes iguais.

Diferenças incluem:

- provider;
- consentimento;
- cookies/client ID;
- browser blocking;
- CAPI/Measurement Protocol;
- configuração de labels;
- deduplicação própria;
- regras de janela de atribuição do provider.

AF deve reconciliar com seus fatos internos, não eleger um provider externo como
ledger.

## 84. Novo evento: decidir o owner primeiro

Antes de criar evento, responder:

```text
é comportamento de UI?
é fato transacional?
é conversão de marketing?
é auditoria?
é métrica operacional?
```

Se for fato transacional, o evento deve nascer no backend ou ser validado contra
o fato persistido.

## 85. Novo evento first-party

Para novo evento V2:

1. definir nome canônico;
2. definir momento exato;
3. definir propriedades mínimas;
4. adicionar whitelist backend;
5. decidir flow UUID;
6. evitar PII;
7. adicionar teste frontend;
8. adicionar teste backend;
9. atualizar reconciliação se houver equivalente legado;
10. atualizar este documento se mudar a taxonomia estrutural.

Não enviar propriedades arbitrárias "para usar depois".

## 86. Novo evento legado

Antes de adicionar `EVENTOS_PERMITIDOS`, verificar se:

- a leitura ainda depende do legado;
- o mesmo sinal já existe no V2;
- estamos aumentando dívida de migração;
- a propriedade cabe na whitelist existente.

Novo desenvolvimento deve evitar ampliar o legado sem necessidade.

## 87. Nova conversão de Ads

Para uma conversão nova:

- identificar fato de negócio;
- escolher browser/server;
- exigir consentimento quando aplicável;
- definir idempotência/deduplicação;
- definir timestamp real;
- evitar PII no browser;
- persistir retry se o fato for financeiro;
- testar falha do provider;
- garantir que fluxo principal continua funcionando.

Não disparar conversão final só porque a tela exibiu "sucesso".

## 88. Deduplicação Meta

Para evento enviado por Pixel + CAPI:

```text
mesmo evento lógico
  → mesmo event_id
```

O frontend não deve gerar outro `event_id` depois que o backend já recebeu o
contexto da mesma tentativa.

Cadastro e checkout seguem esse padrão atualmente.

## 89. Deduplicação Google

Para Google Ads/GA4, transaction IDs devem ser estáveis para o fato correspondente.

Atualmente:

- cadastro profissional pode usar `af-signup-<usuarioId>`;
- begin checkout usa ID da tentativa;
- purchase server-side usa IDs da assinatura/pagamento.

Não usar timestamp aleatório para uma conversão que precisa ser reconhecida como
o mesmo fato em retry.

## 90. Segurança de URL de provider

Meta server-side normaliza `source_url` para a origem pública do AF e pathname.

Google usa page context sanitizado.

Não aceitar URL externa arbitrária como source URL confiável.

## 91. Rate limit

Endpoints de eventos usam o limitador de eventos.

Isso ajuda a evitar abuso do collector.

Retry do frontend precisa respeitar volume controlado; não implementar loop
agressivo.

## 92. Payload máximo e whitelist

Analytics V2 limita lote e valida:

- UUID;
- timestamps;
- tipo;
- sequence;
- route template;
- event name;
- propriedades;
- IDs.

Legacy também limita evento/página/missão/propriedades.

Essa validação server-side é parte do contrato de segurança.

## 93. Timestamp

Analytics V2 aceita horário dentro de uma janela controlada.

Conversões finais server-side usam o horário real do pagamento quando disponível.

Não substituir timestamp transacional por "agora no navegador" quando o fato
aconteceu no backend.

## 94. Logs e falha de provider

Meta/Google server-side registram aviso quando envio falha.

Esses logs devem conter:

- tipo do evento;
- status;
- código de provider quando aplicável;
- mensagem técnica segura.

Não registrar:

- token CAPI;
- API secret;
- senha;
- payload pessoal completo.

## 95. Fila de conversão como observabilidade

A tabela de entrega permite diferenciar:

```text
PENDING
PROCESSING
SENT
IGNORED
FAILED
```

Isso é mais confiável para operação do que depender apenas de um log "tentamos
enviar".

Falha de provider pode ser diagnosticada sem alterar o fato financeiro.

## 96. Testes atuais relevantes

Frontend possui testes para:

- first-party acquisition;
- sanitização de rota;
- outbox;
- atribuição first/last touch;
- consentimento;
- Google Consent Mode;
- page path seguro;
- Google signup/begin checkout;
- Meta context/event;
- bridge;
- signup profissional;
- checkout/idempotência.

Backend possui testes para:

- collectors;
- consentimento;
- Meta;
- Google;
- event time;
- reconciliação;
- entrega persistida de conversões;
- atribuição.

Mudança estrutural de analytics precisa tocar a cobertura proporcional.

## 97. Cenários mínimos de teste

Ao mudar a camada:

### Consentimento

- unknown;
- granted;
- denied;
- revogação;
- storage indisponível;
- sincronização falha;
- retry.

### Navegação

- rota pública;
- dinâmica;
- Admin;
- sensível;
- query com dado sensível.

### Conversão

- sucesso real;
- resposta de erro;
- retry;
- mesmo event ID;
- sem consentimento;
- provider desabilitado.

### Outbox

- 2xx;
- 5xx;
- erro permanente;
- offline/online;
- item duplicado.

## 98. Não enviar PII nos testes de provider

Mesmo mocks precisam reforçar a regra.

Assertions úteis:

```text
payload não contém token
payload não contém e-mail da query
payload não contém telefone de busca
rota foi sanitizada
```

Testes atuais de Google já protegem parte desse comportamento.

## 99. Performance

First-party monta imediatamente, mas deve continuar leve.

Ads são diferidos.

Mudanças em analytics não devem:

- bloquear render;
- adicionar dependência pesada ao chunk inicial;
- esperar provider antes de mostrar página;
- atrasar booking/checkout;
- prejudicar LCP público.

Se a mudança tocar o bundle inicial público, considerar Performance QA.

## 100. Checklist antes de instrumentar uma feature

1. qual fato quero responder?
2. já existe evento?
3. é comportamento ou transação?
4. quem é a entidade: profissional, negócio ou cliente?
5. qual é o momento exato do evento?
6. qual ID realmente é necessário?
7. há PII?
8. precisa de consentimento?
9. existe equivalente no pipeline legado?
10. pode duplicar no Meta/Google?
11. precisa de retry?
12. falha pode ser fail-soft?
13. qual relatório consome?
14. qual teste protege?
15. qual fonte canônica confirma o resultado?

## 101. Checklist para leitura de growth

Antes de concluir que uma campanha funciona:

- conferir cobertura;
- separar profissionais/negócios/clientes;
- confirmar cadastro real;
- confirmar negócio/serviço/publicação;
- confirmar primeiro booking real;
- distinguir checkout visto de checkout criado;
- confirmar pagamento;
- confirmar assinatura;
- comparar retenção/recorrência;
- verificar tamanho da amostra.

CTR/CPC/PageView não fecham o funil.

## 102. Achados desta auditoria

### 102.1 UTM first-party antes de consentimento

Implementado e testado no Analytics V2.

Texto de Privacidade atual descreve origem de campanha como opcional sob
autorização.

Pendente de reconciliação explícita.

### 102.2 Meta Admin

Google e first-party já excluíam Admin.

A Wave A adicionou o mesmo bloqueio ao Meta Pixel para inicialização e
`PageView` em `/admin` e `/admin/*`.

Status: **implementado e em validação**.

### 102.3 Dois pipelines de navegador

V2 e legado continuam coexistindo.

Não remover ou duplicar sem seguir o runbook de reconciliação.

### 102.4 Conversão final está corretamente desacoplada do browser

O pagamento final é entregue aos providers a partir do webhook/ativação e fila
persistida.

Preservar esse desenho.

## 103. Ownership

| Responsabilidade | Dono |
| --- | --- |
| page lifecycle V2 | `firstPartyAnalytics.js` + bridge |
| evento comportamental legado | `track.js` |
| consentimento local | `marketingConsent.js` |
| Google browser | `googleMeasurement.js` |
| Meta browser | `metaAds.js` |
| consent UI/sync | `MetaAdsBridge.jsx` + `PrivacyPage.jsx` |
| validação V2 | `analyticsV2Service.js` |
| validação legado | `eventoProdutoService.js` |
| conversão Meta CAPI | `metaAdsService.js` |
| conversão Google MP | `googleMeasurementService.js` |
| retry financeiro de Ads | `marketingConversionDeliveryService.js` |
| classificação canônica de aquisição | backend + `marketing-attribution.md` |

## 104. Documentos relacionados

- [`marketing-attribution.md`](./marketing-attribution.md): fonte canônica de
  classificação e integridade da atribuição;
- [`analytics-pipeline-reconciliation.md`](./analytics-pipeline-reconciliation.md):
  coexistência V2/legado;
- [`marketing-sync-ga4.md`](./marketing-sync-ga4.md): GA4/Data API e
  sincronização;
- [`google-ads-real-campaign-link.md`](./google-ads-real-campaign-link.md):
  campanha Google real;
- [`meta-ads-real-campaign-link.md`](./meta-ads-real-campaign-link.md): Meta;
- [`frontend-arquitetura.md`](./frontend-arquitetura.md): runtime React;
- [`frontend-formularios-estado-api.md`](./frontend-formularios-estado-api.md):
  estado/rede;
- [`frontend-seguranca.md`](./frontend-seguranca.md): PII, storage, URLs sensíveis, CSP e secrets;
- [`frontend-qa-prontidao.md`](./frontend-qa-prontidao.md): testes e
  prontidão;
- [`planos.md`](./planos.md): fatos de monetização;
- [`checkout-idempotente.md`](./checkout-idempotente.md): checkout;
- [`ciclo-atendimento.md`](./ciclo-atendimento.md): booking.


> Findings abertos e prioridade de execução estão consolidados em [`frontend-pendencias-priorizadas.md`](./frontend-pendencias-priorizadas.md).

## 105. Manutenção

Atualizar este documento quando mudar de forma durável:

- pipeline first-party;
- pipeline legado;
- taxonomia de eventos;
- sessionização;
- consentimento;
- sanitização de rota;
- provider de Ads;
- deduplicação;
- fila de conversões;
- regra de PII;
- política de Admin/sensitive routes;
- atribuição no navegador;
- fronteira browser/backend de conversão.

Não atualizar por simples mudança de copy de um evento se a arquitetura e a
semântica permanecerem iguais.
