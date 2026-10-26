# Formulários, estado, API e erros no frontend — Agenda Fashion

> **Papel documental:** referência técnica especializada para formulários,
> estado de interface, comunicação HTTP, tratamento de erros e transições
> assíncronas no frontend React.
>
> A arquitetura geral permanece em
> [`frontend-arquitetura.md`](./frontend-arquitetura.md), o mapa de jornadas em
> [`frontend-mapa-telas-jornadas.md`](./frontend-mapa-telas-jornadas.md) e os
> componentes compartilhados em
> [`frontend-componentes-primitives.md`](./frontend-componentes-primitives.md).

## 1. Objetivo

Este documento define como evoluir telas que:

- capturam dados;
- carregam recursos remotos;
- executam mutações;
- preservam estado de jornada;
- lidam com concorrência, retry e timeout;
- exibem sucesso/erro;
- atualizam sessão;
- navegam depois de uma operação.

O objetivo não é introduzir uma nova biblioteca de forms ou state management.
O frontend atual usa primitives do React, React Router e a camada HTTP própria.
Uma tecnologia nova só deve ser considerada quando existir problema concreto que
não esteja sendo resolvido adequadamente pela arquitetura atual.

## 2. Modelo de estado do frontend

O frontend possui cinco categorias práticas de estado.

| Categoria | Dono | Exemplos |
| --- | --- | --- |
| Estado efêmero de UI | componente/página | menu aberto, submitting, mensagem temporária, aba expandida |
| Estado de formulário | página/componente | campos de negócio, serviço, conta, horários |
| Estado navegável | URL/React Router | `plano`, `onboarding=servico`, busca, slug, id |
| Estado de sessão | `SessionProvider` | usuário, negócio principal, vínculos, Admin |
| Estado canônico de domínio | backend/PostgreSQL | publicação, preço, limite, permissão, pagamento, booking |

A regra mais importante é:

> quanto maior o impacto da informação sobre segurança, dinheiro, autorização ou
> domínio, menos ela pode depender do estado local do navegador.

## 3. Estado local com useState

O padrão predominante atual é estado local com `useState`.

Exemplos:

```text
AuthPage
  → form
  → error
  → submitting

BusinessPage
  → form
  → savedForm
  → loading/saving
  → publication
  → cepLookup

AccountPage
  → profile/savedProfile
  → preferências atuais/salvas
  → password
  → saving por operação

ScheduleSettingsPage
  → config
  → days
  → savedSchedule
  → expandedPauses
  → saving
  → firstScheduleMode
```

Esse padrão é adequado quando o estado pertence à tela e não precisa ser
compartilhado globalmente.

Não criar store global apenas para evitar passar uma ou duas props.

## 4. Estado controlado de formulário

Os formulários principais usam inputs controlados.

Exemplo conceitual:

```jsx
<input
  value={form.nome}
  onChange={(event) =>
    setForm((current) => ({
      ...current,
      nome: event.target.value
    }))
  }
/>
```

Vantagens no contexto atual:

- validação derivada simples;
- formatação de campos durante digitação;
- comparação com baseline salvo;
- feedback imediato;
- payload explícito no submit.

Para campos independentes e pequenos, estados separados também são aceitáveis,
como no checkout.

## 5. Baseline salvo e detecção de alteração

Quando é importante distinguir valor carregado de valor editado, manter um
snapshot salvo é preferível a inferir alteração por flags manuais.

### BusinessPage

Mantém:

```text
form
savedForm
```

e compara uma serialização normalizada.

A serialização ordena especialidades antes da comparação para evitar marcar
mudança apenas por ordem do array.

### AccountPage

Mantém pares como:

```text
profile / savedProfile
bookingNotifications / savedBookingNotifications
operationalAlerts / savedOperationalAlerts
dailyReminders / savedDailyReminders
```

Esse padrão permite desabilitar mutações quando nada mudou e atualizar o
baseline apenas depois de resposta bem-sucedida.

## 6. Saída com alterações não salvas

`BusinessPage` (criação e edição), `ServiceEditorPage` e
`ScheduleSettingsPage` usam `UnsavedChangesGuard` quando os valores editados
diferem do baseline salvo. Capa e fotos ainda pendentes de upload também
contam como alterações no editor de serviços; operações de mídia já
persistidas não criam um rascunho artificial.

O componente usa `useBlocker` no data router da aplicação para interceptar
mudanças de pathname ou query, inclusive voltar/avançar no histórico. O diálogo
oferece continuar editando ou sair sem salvar. Mudanças apenas em state ou hash
não descartam o formulário e não exigem confirmação.

`beforeunload` protege reload/fechamento conforme o suporte do navegador;
Safari mobile pode não emitir esse evento em encerramentos do aplicativo. Não
há persistência automática de rascunhos. O bloqueio permanece durante o
salvamento até a confirmação da API, e o baseline é atualizado antes da
navegação de sucesso. Falha de atualização secundária da sessão não transforma
um salvamento confirmado em erro.

Testes isolados com `MemoryRouter` exercitam a proteção de unload; testes de
navegação usam `createMemoryRouter` e o E2E usa o router real.

Não adicionar confirmação de saída em formulários triviais sem necessidade.

Durante o salvamento de negócio, serviço e horários, os campos editáveis ficam
desabilitados até a resposta da operação. No serviço, esse bloqueio cobre
também a seleção e as ações de fotos até o fim dos uploads. Falhas liberam os
campos mantendo os valores e os arquivos pendentes para correção ou nova
tentativa. A consulta de CEP em andamento também precisa terminar antes de
enviar o endereço do negócio.

O editor de horários é reiniciado quando muda o papel ou a profissional alvo.
A nova agenda precisa carregar antes de permitir edição ou salvamento; falhas
oferecem repetir a leitura. Requisições anteriores são canceladas e suas
respostas não atualizam o novo contexto, inclusive após um salvamento.

## 7. Validação em três camadas

O frontend atual combina três níveis.

### 7.1 Validação nativa do HTML

Exemplos:

- `required`;
- `type="email"`;
- `type="url"`;
- `minLength`;
- `maxLength`;
- `min`;
- `step`;
- `pattern`;
- `inputMode`.

Use a semântica nativa quando ela resolve o problema.

### 7.2 Validação de UX no React

Exemplos atuais:

- confirmação de senha;
- WhatsApp com quantidade de dígitos;
- URL de Google Maps;
- completude do negócio;
- consistência de intervalos da agenda;
- tipo e tamanho de imagem;
- limite visual de serviços ativos.

Esse nível melhora feedback e evita requests claramente inválidos.

### 7.3 Validação autoritativa no backend

Continua obrigatória para:

- IDs;
- vínculo/papel;
- negócio;
- publicação;
- disponibilidade;
- limites de plano;
- preços;
- pagamento;
- regras financeiras;
- ownership;
- integridade.

Validação de frontend nunca deve ser usada como evidência de autorização.

## 8. Normalização antes de enviar

Dados de apresentação podem precisar de normalização antes do payload.

Exemplos atuais:

```text
WhatsApp formatado na tela
  → somente dígitos no payload

CEP 00000-000
  → somente dígitos no payload

valor/duração em input
  → Number(...) no payload

email
  → trim + lowercase
```

A normalização do navegador melhora consistência, mas o backend ainda precisa
normalizar/validar o formato recebido quando o dado é crítico.

## 9. Formatação de entrada

A tela pode usar helpers de `utils/format.js` para manter apresentação
consistente.

Exemplos reais:

- `formatWhatsApp`;
- `formatCep`;
- `formatCurrency`.

Não duplicar máscaras manualmente em novas páginas quando já existe helper
adequado.

Ao alterar helper compartilhado, verificar todos os consumidores e testes do
utilitário.

## 10. Estrutura padrão de submit

O padrão atual de mutação é:

```text
preventDefault
  → limpar erro/mensagem anterior
  → validação local
  → marcar saving/submitting
  → apiRequest
  → aplicar resposta autoritativa
  → refresh/navigate quando necessário
  → catch: feedback
  → finally: liberar operação
```

Exemplo conceitual:

```jsx
async function submit(event) {
  event.preventDefault();
  setError("");
  setSaving(true);

  try {
    const result = await apiRequest("/recurso", {
      method: "PUT",
      body: payload
    });

    // refletir resposta do servidor
  } catch (requestError) {
    setError(requestError.message);
  } finally {
    setSaving(false);
  }
}
```

Esse padrão deve continuar simples. Não esconder mutações importantes em
helpers genéricos que dificultem saber o que acontece depois do sucesso.

## 11. Bloqueio de duplo submit

A UI deve impedir repetição acidental enquanto uma operação incompatível já está
em andamento.

Padrões atuais:

- `disabled={submitting}`;
- `disabled={saving}`;
- estado com identificador da operação, como `saving === "profile"`;
- `togglingId` para mutação de um item específico;
- `removing` para diálogo destrutivo.

Ainda assim, bloquear botão no frontend não substitui idempotência no backend
quando a operação pode duplicar efeitos.

## 12. Operações independentes na mesma página

`AccountPage` usa uma string `saving` como chave da operação ativa:

```text
profile
password
whatsapp-preferences
booking-notifications
photo
deactivate-account
close-account
```

Isso evita criar vários booleans e permite adaptar textos/disabled por operação.

Na conta, uma ref também impede duas escritas antes da próxima renderização.
Todos os campos de edição ficam desabilitados durante a operação ativa; as
respostas depois da saída são descartadas. O refresh auxiliar da sessão é
silencioso e não transforma perfil, foto ou preferência já salvos em falha.

Use esse padrão quando:

- as operações são mutuamente exclusivas;
- a página possui vários formulários independentes.

Se operações realmente puderem executar em paralelo, prefira estado separado por
operação em vez de uma única chave global.

## 13. Form com múltiplos botões submit

`ScheduleSettingsPage` possui mais de uma ação que envia a mesma agenda.

Ela identifica o botão acionado por:

```js
event.nativeEvent?.submitter?.dataset?.source
```

e usa `data-source` como:

- `confirmacao_rapida`;
- `pular_sugestao`.

Isso permite reutilizar a mesma validação e persistência sem criar handlers que
possam divergir.

Use esse padrão quando botões diferentes executam a mesma mutação com semântica
de origem distinta.

Não use quando as operações persistidas são realmente diferentes.

## 14. Estado da URL

Use URL para informações que precisam sobreviver a:

- refresh;
- compartilhamento;
- reabertura;
- retorno do login;
- navegação direta.

Exemplos atuais:

```text
?plano=<slug>
?onboarding=servico
?busca=<texto>
/negocio/:slug
/servicos/:id/editar
```

O projeto já tomou uma decisão explícita de usar
`?onboarding=servico` para não depender apenas de state transitório.

## 15. React Router state

`location.state` é útil para informação transitória de navegação.

Exemplos atuais:

- mensagem de sucesso;
- `from` para voltar ao destino pedido após login;
- marcadores transitórios adicionais de onboarding;
- sinal de pagamento confirmado para a tela seguinte.

Não use `location.state` como única fonte quando a jornada precisa sobreviver a
refresh.

Após consumir mensagem transitória, algumas telas limpam state com navegação
`replace` para evitar repetir o feedback ao voltar.

## 16. Caminhos internos seguros

`safeInternalPath` aceita somente paths locais iniciados por `/` e rejeita
`//...`.

Isso é usado na navegação pós-login/onboarding para evitar transformar um destino
recebido em redirecionamento externo arbitrário.

Ao adicionar redirect baseado em parâmetro/state:

- normalizar;
- aceitar apenas destino interno permitido;
- não navegar diretamente para string externa fornecida pelo usuário.

## 17. Intenção de plano

`normalizePlanSlug` limita o slug a formato simples de letras/números/hífens e
tamanho máximo.

`getPlanIntentPath` preserva a intenção ao navegar entre etapas.

Esse valor é intenção de UX.

Ele não autoriza:

- preço;
- plano existente;
- limite;
- checkout;
- ativação.

O backend de checkout revalida o plano real.

## 18. SessionProvider

`SessionProvider` é o estado compartilhado de identidade/contexto.

Ele expõe:

- `loading`;
- `authenticated`;
- `usuario`;
- `negocioPrincipal`;
- `vinculos`;
- `temNegocio`;
- `administrador`;
- `ehAdministrador`;
- `negocio` resolvido pela rota;
- `refresh`;
- login/cadastro/Google/logout.

A sessão React deve ser atualizada após mutações que mudam informação usada por
shells ou gates.

Exemplos atuais:

- atualização de conta;
- criação/edição relevante de negócio;
- publicação;
- aceite de contexto;
- mudanças que afetam o negócio da sessão.

## 19. Cache local da sessão

`auth/session.js` e `browserStorage.js` mantêm um cache local mínimo.

O fluxo atual de sessão:

- remove token legado ao salvar uma sessão nova;
- grava apenas o marcador `session_active`;
- remove chaves legadas `usuario` e `negocio` durante bootstrap;
- mantém perfil e contexto somente em memória;
- usa `/minha-sessao` para reconstruir o contexto real.

`apiRequest` ainda possui compatibilidade com token Bearer armazenado quando
existir.

Esse storage não é fonte de autorização.

## 20. Storage indisponível

`browserStorage.js` trata navegadores/modos de privacidade em que
`localStorage` ou `sessionStorage` existem mas lançam erro.

Nesses casos, mantém fallback em memória durante a execução da aba.

Consequência:

- a navegação atual pode continuar funcional;
- persistência entre reloads pode não existir;
- código novo não deve assumir que `localStorage.setItem` sempre funciona.

Use os wrappers de `browserStorage.js` em vez de acessar storage diretamente
quando o dado pertence ao contrato já coberto por essa camada.

## 21. Cliente HTTP único

A primitive compartilhada é:

```text
frontend/src/api/client.js
```

Use `apiRequest` salvo necessidade técnica explícita.

Ele centraliza:

- `VITE_API_URL`;
- `Accept: application/json`;
- JSON automático;
- `FormData`;
- cookies com `credentials: "include"`;
- compatibilidade Bearer;
- timeout;
- AbortSignal;
- parsing de resposta;
- erro padronizado;
- limpeza de sessão em HTTP 401.

Criar um segundo wrapper HTTP para uma feature deve ser evitado.

## 22. ApiError

Erro HTTP não bem-sucedido vira `ApiError` com:

```text
message
status
data
```

A mensagem usa, nesta ordem:

```text
data.erro
data.mensagem
fallback genérico
```

Isso permite:

- feedback simples com `requestError.message`;
- tratamento por status;
- leitura de payload estruturado quando necessário.

Exemplo real: fechamento de negócio pode ler
`requestError.data?.pendencias`.

Não fazer parsing de texto de erro quando o backend já pode expor campo
estruturado.

## 23. HTTP 401 e expiração de sessão

Quando `apiRequest` recebe HTTP 401:

```text
clearSession({ notify: true })
```

O evento atualiza o `SessionProvider`, que volta ao estado deslogado.

Uma página não precisa implementar sua própria limpeza global de sessão para
cada request.

HTTP 403 é tratado pelo `refresh` de sessão como motivo para encerrar o
contexto local, mas demais requests podem usar o erro para feedback conforme o
caso.

## 24. Timeout

O timeout padrão de `apiRequest` é:

```text
20 segundos
```

Quando estoura, o erro normalizado possui:

```text
status: 408
codigo: REQUEST_TIMEOUT
```

e mensagem amigável.

Uma chamada pode escolher timeout específico.

Exemplo: lookup de CEP usa 6 segundos.

Não aumentar timeout apenas para esconder endpoint lento. Primeiro avaliar causa
e contrato de UX.

## 25. AbortSignal

`apiRequest` aceita `signal` externo e combina esse cancelamento com seu
próprio timeout.

Use cancelamento quando:

- mudança de parâmetro invalida a request anterior;
- componente pode desmontar durante uma leitura longa;
- autocomplete/search dispara solicitações concorrentes;
- resposta obsoleta pode sobrescrever estado novo.

O código atual também usa refs/IDs para alguns casos concorrentes.

## 26. Proteção contra resposta obsoleta

### Lookup de CEP

`BusinessPage` mantém `cepRequestRef`.

Cada consulta recebe um número. A resposta só atualiza a tela quando o ID ainda
é o mais recente e o CEP do form continua o mesmo.

Endereço, bairro, cidade e estado também possuem revisões de edição por campo.
O preenchimento automático só aplica campos que a usuária não alterou desde o
início daquela consulta. Campos preenchidos manualmente continuam como rascunho,
inclusive quando o lookup foi iniciado como complemento da carga do perfil.

Isso impede:

```text
consulta CEP A lenta
consulta CEP B rápida
resposta B
resposta A sobrescrevendo B
```

Esse padrão é válido quando não é simples abortar a operação anterior.

## 27. Polling cancelável por geração

O checkout usa `pollRunRef`.

Cada execução de polling possui um número. Nova execução ou unmount invalida a
anterior.

A função verifica o número antes de atualizar estado.

Esse padrão impede que uma tentativa antiga altere a UI depois de um retry.

## 28. Carregamento simples

O padrão comum de tela é:

```text
estado inicial nulo
  → useEffect/load
  → conteúdo
  → ErrorState quando o recurso principal falha
```

Exemplo conceitual:

```jsx
if (!data && !error) {
  return <LoadingState />;
}

if (!data && error) {
  return <ErrorState message={error} onRetry={load} />;
}
```

Quando já existe conteúdo carregado e uma mutação posterior falha, preservar o
conteúdo e mostrar erro local costuma ser melhor do que substituir toda a tela.

`ServicesPage` faz essa distinção.

## 29. Promise.all para recursos acoplados

Use `Promise.all` quando a tela só faz sentido se as leituras necessárias forem
tratadas como um conjunto.

Exemplo atual: planos + plano atual no checkout, com fallback explícito para 404.
Serviço e galeria, assim como catálogo e uso da assinatura, carregam
independentemente para que uma leitura auxiliar não bloqueie o recurso principal.

O importante é decidir explicitamente se uma dependência é obrigatória ou
opcional.

## 30. Fail-soft e settleRequestMap

Existe a utility:

```text
frontend/src/utils/asyncData.js
```

com `settleRequestMap`, baseada em `Promise.allSettled`.

Ela retorna:

```js
{
  values,
  errors
}
```

É adequada quando vários blocos independentes podem carregar parcialmente e uma
falha não deve apagar dados válidos dos demais.

Não usar fail-soft quando a ausência de uma resposta tornaria a tela enganosa ou
permitiria operação insegura.

## 31. Retry

Retry deve repetir a menor operação segura possível.

Exemplos:

- `ErrorState onRetry={load}`;
- atualizar horários disponíveis;
- verificar pagamento novamente;
- sincronizar preferência/consentimento novamente.

Evite reload completo quando um request específico pode ser refeito sem perder
estado útil.

Para mutações financeiras, retry precisa respeitar idempotência.

## 32. FormData e upload

`apiRequest` detecta `FormData` e não força JSON/`Content-Type`.

Padrão atual:

```js
const body = new FormData();
body.append("foto", file);

await apiRequest("/rota/foto", {
  method: "POST",
  body
});
```

O browser define o boundary multipart.

Não definir manualmente `Content-Type: multipart/form-data` com boundary
incompleto.

## 33. Validação de mídia

`BusinessPage` e `ServicesPage` validam antes do upload:

- JPG;
- PNG;
- WEBP;
- máximo atual de 5 MB por imagem.

Isso melhora UX e evita envio claramente incompatível.

O backend ainda precisa validar tipo/tamanho e controlar o destino de upload.

## 34. Upload após persistência principal

`ServiceEditorPage` separa:

1. salvar dados estruturais do serviço;
2. obter/confirmar `id`;
3. enviar capa;
4. enviar galeria.

Essa ordem é importante porque mídia depende de um serviço persistido.

Se a etapa estrutural falha, a função para.

Se o serviço salva e depois mídia falha, a UI informa explicitamente que:

> o serviço foi salvo, mas algumas fotos não foram enviadas.

Esse é o padrão correto de **sucesso parcial**: não mentir que tudo falhou e não
mentir que tudo concluiu.

Cada upload confirmado atualiza imediatamente a capa ou a galeria e remove
somente aquele arquivo da fila pendente. Uma falha posterior mantém as imagens
já persistidas visíveis e a nova tentativa envia apenas os arquivos restantes.
Uma leitura de galeria em andamento preserva as fotos enviadas após seu início.

Adicionar outro lote acumula os arquivos pendentes, sem substituir a seleção
anterior. Repetir o mesmo arquivo (nome, tamanho, tipo e última modificação iguais)
não cria uma segunda entrada pendente. O input nativo é limpo após a seleção,
mas os arquivos continuam no estado do editor até serem enviados ou descartados.

Salvar o serviço, escolher capa e remover fotos são operações mutuamente
exclusivas no editor. Enquanto uma delas estiver pendente, as outras ações de
mídia e a seleção de arquivos ficam desabilitadas. A escolha de uma foto da
galeria só substitui a capa e libera o arquivo previamente selecionado depois
da confirmação da API; uma falha preserva essa seleção e seu guard de saída.

Se a escolha de capa ou remoção tem resultado incerto (ou foto não encontrada),
o editor protege novas escritas e oferece `Verificar fotos`. A conferência lê
serviço e galeria por GET e aplica somente os campos de mídia, preservando o
rascunho de texto, preço e duração. Falha de leitura mantém a proteção. O arquivo
de capa pendente só é descartado quando a leitura confirma a escolha solicitada.
Sair cancela essas leituras e invalida sua continuação. O botão de conferência
não exige a validação dos campos do formulário, pois não grava esses dados.

Sair ou trocar de serviço invalida as continuações assíncronas do editor.
Uma resposta antiga não muda o rascunho, a fila de fotos, os estados ocupados
nem a navegação da tela atual. Depois de sair durante um upload, sua resposta
não inicia o envio dos arquivos restantes; uma operação já enviada pode ter
sido persistida pelo backend.

Na edição, os dados essenciais do serviço carregam independentemente da
galeria. Lentidão ou falha das fotos não bloqueia nome, categoria, valor e
duração; o erro e a tentativa da galeria ficam na seção de mídia e não recarregam
o formulário. Falha dos dados essenciais apresenta erro com nova tentativa,
sem abrir um cadastro vazio. As duas leituras são canceladas na saída ou troca
de serviço e ignoram respostas obsoletas.

## 35. Upload e estado do input file

Depois de upload/tentativa, o código pode limpar:

```js
event.target.value = "";
```

Isso permite selecionar novamente o mesmo arquivo, comportamento importante em
retry de browser.

URLs criadas com `URL.createObjectURL` devem ser revogadas no cleanup.

`ServiceEditorPage` faz isso para preview de capa.

## 36. Atualização otimista

Atualização otimista só deve ser usada quando rollback é simples e seguro.

Na escolha de capa da galeria, o editor aguarda a resposta da API antes de mudar
a imagem. Isso preserva uma capa pendente de upload se a escolha falhar e evita
indicar como atual uma foto que ainda não foi confirmada.

Para operações críticas ou com regra complexa, preferir aguardar a resposta
autoritativa.

Não aplicar optimistic update a:

- pagamento;
- publicação sem confirmação;
- entitlement;
- autorização;
- booking criado;
- limite de plano.

## 37. Confirmação destrutiva

Operações destrutivas atuais usam confirmação explícita.

Exemplos:

- encerrar conta;
- desativar conta;
- encerrar negócio;
- ocultar negócio publicado;
- remover serviço por `dialog`.

A confirmação deve dizer consequência real, não apenas "Tem certeza?".

Backend ainda revalida se a operação pode ocorrer.

Quando o backend devolve pendências estruturadas, exibi-las em vez de esconder o
motivo.

## 38. Dialog de remoção

`ServicesPage` usa `<dialog>` para remoção de serviço.

Mantém:

- item pendente;
- estado `removing`;
- erro específico do diálogo;
- bloqueio de cancelamento durante mutação;
- botões claros para manter/remover.

Esse padrão é preferível a erro global da página para uma mutação destrutiva
local.

## 39. Mensagens de sucesso

Há dois tipos recorrentes.

### Transitória local

Exemplo:

```text
setMessage(...)
setTimeout(... limpar ...)
```

Adequado para confirmação curta na mesma tela.

### Transferida para destino

Exemplo:

```js
navigate("/painel/servicos", {
  replace: true,
  state: {
    message: "Serviço criado."
  }
});
```

Adequado quando o sucesso muda de página.

A tela destino pode consumir e limpar esse state para não repetir a mensagem.

## 40. role=status e role=alert

Use:

- `role="alert"` para erro que exige atenção imediata;
- `role="status"` ou `aria-live="polite"` para progresso/sucesso não
  interrompente.

Exemplos atuais:

- `form-error` com `role="alert"`;
- mensagem de cópia/PIX com `role="status"`;
- lookup de CEP com `aria-live="polite"`.

Não marcar toda mensagem informativa como alert.

## 41. aria-busy e aria-invalid

Quando a operação pertence a um campo, comunicar estado no próprio controle é
melhor que depender só de texto distante.

`BusinessPage` usa no CEP:

```text
aria-busy durante lookup
aria-invalid em erro
aria-live no helper
```

e no WhatsApp/Maps usa `aria-invalid`.

Novos campos assíncronos devem seguir semântica equivalente.

## 42. Formulário de autenticação

`AuthPage` demonstra combinação de:

- validação nativa;
- estado controlado;
- intenção de profissional/plano pela URL;
- autenticação por e-mail ou Google;
- prevenção de submit duplicado;
- erro global do formulário;
- destino seguro pós-login;
- analytics apenas após criação real de conta profissional.

A UI não deve disparar evento de conversão de cadastro antes de a criação ser
confirmada.

## 43. Google Login

`GoogleLoginButton` obtém configuração pública do backend e carrega o script
oficial.

Ele entrega apenas a credential ao fluxo de autenticação.

A sessão é estabelecida por `SessionContext`/backend.

Se o Google não estiver disponível, o botão pode desaparecer sem impedir login
por e-mail.

## 44. BusinessPage

Na criação, o POST recebe `Idempotency-Key` por tentativa e a referência técnica
por conta fica no fragmento `cadastro-negocio`, sem os dados do formulário.
Resultado incerto mantém o rascunho protegido e oferece `Verificar negócio`,
somente `GET /criar-negocio/tentativa`. Falha na leitura permite repetir apenas
a consulta. Reload e retorno do login restauram a referência e revalidam a conta;
referência de outra conta é ignorada. Ausência permite corrigir dados mantendo a
mesma chave contra POST tardio. Tentativa arquivada/removida oferece saída sem
outro POST. Sucesso adota o negócio canônico na sessão e segue ao primeiro serviço,
com a intenção de plano, sem depender do refresh auxiliar. A leitura é cancelada
na saída e não pode adotar sessão ou navegar depois do descarte.

É o principal exemplo de formulário complexo atual.

Combina:

- criação e edição;
- baseline salvo;
- campos obrigatórios condicionais;
- máscara/normalização;
- lookup de CEP;
- especialidades multi-select;
- upload;
- publicação;
- encerramento;
- onboarding;
- intenção de plano;
- proteção de saída;
- refresh de sessão.

Ao alterá-la, evitar adicionar mais responsabilidade sem avaliar extração de
blocos específicos.

Regra de publicação continua backend-authoritative.

Salvamento dos dados, upload de foto, publicação/despublicação e encerramento
compartilham um lock síncrono. Enquanto uma mutação estiver pendente, os controles
das demais ficam desabilitados e seus handlers também recusam ações concorrentes.
Isso impede uma resposta de salvamento ou foto de sobrescrever na tela o estado
de publicação confirmado por uma ação posterior. Falhas preservam o rascunho e
as pendências retornadas pela API. Conflito de contexto protege as mutações até
`Atualizar Meu negócio` concluir um GET canônico; falha dessa leitura mantém a
proteção. O header `X-AF-Negocio` vem do negócio carregado, não do contexto
principal que possa ter mudado durante a edição. Uma resposta com outro ID não
é adotada como novo baseline.

O contexto da página é invalidado ao sair ou mudar entre criação e edição. Uma
resposta antiga não altera a interface, não adota negócio na sessão, não inicia
refresh de sessão e não navega para serviço, horários ou outro destino. Se o
refresh do encerramento já começou antes de sair, sua conclusão também não
redireciona. A leitura inicial usa AbortSignal e o lookup de CEP invalida respostas
pendentes no cleanup. Escritas já enviadas podem concluir no backend; sair da
interface não desfaz uma operação persistida.

## 45. ScheduleSettingsPage

Demonstra um formulário de estrutura aninhada:

```text
config
horarios[]
```

Possui validação cruzada entre campos do mesmo dia:

- início < fim;
- pausa precisa ter início e fim;
- pausa precisa ficar dentro do expediente;
- primeira confirmação exige ao menos um dia ativo.

A validação local orienta, mas o servidor persiste e valida o contrato real.

A página também usa um header de contexto:

```text
X-AF-Contexto: dono | profissional
```

Esse header comunica intenção da rota; autorização continua baseada no vínculo
persistido no backend.

## 46. Contexto explícito em requests

Quando a mesma rota de frontend representa contextos diferentes, a request pode
precisar declarar o contexto esperado.

Exemplo atual:

```text
/agenda-configuracao
X-AF-Contexto: dono
```

ou:

```text
X-AF-Contexto: profissional
```

Não derive autorização do header. O backend precisa conferir se a pessoa possui
aquele vínculo.

## 47. Serviços e limite visual

`ServicesPage` carrega serviços e uso do plano.

A UI calcula se o limite aparente foi atingido para orientar e desabilitar a
ação incompatível.

Ainda assim:

- o backend valida limite na mutação;
- `limite_servicos` recebido é apresentação da regra atual;
- não aceitar limite enviado de volta pelo frontend como autoridade.

Após ativar/desativar, a página atualiza a lista usando o resultado da API.

Se a alteração ou remoção tiver resultado incerto, a página bloqueia novas
escritas e oferece `Atualizar serviços`. A recuperação executa GET e pode ser
repetida após erro de leitura, sem reenviar DELETE. Recusa definitiva como
conflito com histórico permanece no diálogo, com orientação acionável.

Na criação, o editor envia `Idempotency-Key` e `negocio_id` explícito, e conserva o mesmo payload e a
mesma chave enquanto não souber o resultado. Os campos ficam protegidos e
`Verificar cadastro` repete essa tentativa. A migration 121 registra a tentativa
no mesmo commit do serviço e de sua habilitação, com escopo por negócio e conta
dona e hash dos dados normalizados. Replay retorna o serviço canônico e a
publicação persistida sem consumir outra vaga ou desfazer ocultação manual.
Não existe adoção de cadastro pela coincidência de nome. Payload diferente com
a mesma chave é conflito; serviço removido retorna 410 sem recriação. Conflitos
definitivos permitem corrigir os dados e iniciar nova tentativa. Divergência de
payload de uma tentativa já gravada exige recuperar o cadastro canônico.
Clientes sem header mantêm o contrato legado; nome ativo duplicado retorna 409
acionável. Criação com chave exige alvo explícito para não redirecionar uma
tentativa antiga ao novo negócio da mesma conta.

Antes do POST, o editor conserva no fragmento `cadastro-servico` somente a
referência técnica da tentativa, com escopo de conta e negócio, sem formulário,
fotos ou perfil. O fragmento sobrevive a reloads sem depender de storage e não
é enviado no HTTP do documento ou no Referer. Ele não é uma capability.
Na restauração, `GET /servicos/tentativa?negocio_id=...` recebe a chave pelo
header e revalida a dona ativa. Sucesso recupera o cadastro atual e continua a
jornada; falha de leitura mantém o editor protegido e oferece só GET. Serviço
removido oferece volta ao catálogo sem recriação. A resposta usa `no-store`.
Referência de outra conta ou negócio não é reutilizada.
O retorno pelo login conserva também o fragmento de navegação. Uma expiração
da sessão não transforma a restauração em um formulário vazio; a referência
continua sujeita à conferência da conta e do negócio após autenticar.

Ausência na consulta não prova que um POST anterior nunca chegará. O editor
permite preencher novamente, mas mantém a mesma chave. Se o POST antigo concluir
com outros dados, o conflito leva à leitura canônica em vez de outra criação.
Leituras após saída ou troca de contexto são descartadas. O fragmento é retirado
na navegação de sucesso ou no descarte de uma tentativa com erro definitivo.

A criação revalida e bloqueia conta, negócio e vínculo dentro da mesma transação
da tentativa e do serviço. Na criação ativa, a ordem é conta (`FOR NO KEY
UPDATE`), advisory de capacidade e negócio/vínculo. O advisory antecede o
negócio, como na edição que reativa e na reativação do catálogo, evitando espera
circular entre esses caminhos. Arquivamento continua começando pela conta. Isso
também protege serviços inativos e clientes sem header: uma autorização lida
antes do arquivamento não permite gravar depois dele.

Na galeria, cada arquivo selecionado recebe uma `Idempotency-Key` conservada
durante a tentativa. Desde a migration 122, recibo e foto são persistidos no
mesmo commit, com escopo de conta, negócio e serviço e hash do arquivo. Replay
retorna a foto canônica, conteúdo diferente é conflito e foto removida retorna
410 sem recriação. Clientes sem chave mantêm o contrato legado.

Upload com resposta incerta protege os controles e oferece `Verificar fotos`.
Essa ação faz apenas `GET /servicos/:id/fotos/tentativa`, com chave no header e
resposta `no-store`, sem PUT do serviço ou novo upload. Confirmação retira o
arquivo dos pendentes e adota a foto; ausência mantém a chave para o próximo
envio, pois um pedido antigo ainda pode chegar. Foto removida sai da seleção
com orientação; falha de leitura mantém a proteção. Sair invalida a continuação.

HTTP com o provedor fica fora das transações. Envios simultâneos podem concluir
transferências externas distintas, mas confirmam uma única foto no banco e
limpam o asset excedente. Falha antes de preparar o commit limpa o asset sem uso.
Confirmação de COMMIT perdida exige conferir o recibo antes de remover a imagem;
se essa leitura também falhar, a imagem é preservada para recuperação posterior.

Escolher capa e remover foto usam transação com revalidação da dona e da foto.
O lock da conta precede serviço, negócio/vínculo e foto; o serviço vem antes do
negócio como nas operações de edição/ativação. Assim, uma remoção que conclui
antes da escolha impede adotá-la, e uma remoção posterior também limpa a capa.
Limpeza no provedor fica fora da transação.

## 48. Checkout: idempotência

Checkout é uma exceção crítica.

Antes de `POST /checkout`, a tela constrói uma chave:

```text
Idempotency-Key
```

O fingerprint atual considera:

```text
plano + CPF/CNPJ normalizado
```

Enquanto a tentativa representa a mesma intenção, a chave é preservada.

Esse mecanismo complementa — não substitui — a idempotência no backend.

Nunca remover idempotency key para "resolver" checkout duplicado sem investigar
a causa.

## 49. Checkout: confirmação real

A tela possui funções separadas para:

- pagamento confirmado;
- assinatura ativa;
- ativação completa.

`paymentActivated` só retorna sucesso quando:

```text
pagamento confirmado
E
assinatura ativa
```

Essa distinção é essencial.

Não navegar para estado visual de plano ativo apenas porque:

- PIX foi gerado;
- usuário voltou ao site;
- provider retornou um status parcial;
- analytics registrou checkout.

## 50. Checkout: polling

O polling atual:

- marca estado `checking`;
- espera entre verificações;
- consulta `/checkout/status/:id`;
- diferencia pagamento confirmado ainda ativando;
- diferencia ativação que requer atenção;
- diferencia falha de consulta;
- oferece retry manual depois de erro/timeout.

O PIX continua válido mesmo quando a verificação falha.

A mensagem de erro não deve induzir a gerar cobrança duplicada automaticamente.

## 51. Analytics de mutação

Eventos comportamentais devem refletir fatos reais.

Exemplo em agenda:

```text
salvamento_tentado
erro de validação cliente
erro API
agenda_configurada após sucesso
```

Exemplo em checkout:

- `InitiateCheckout` é disparado após resposta de criação da tentativa;
- não representa pagamento confirmado.

Analytics deve ser fail-soft e nunca impedir submit principal.

## 52. Erro global versus erro local

Escolha o menor escopo correto.

### Erro global de página

Use quando:

- recurso principal não carregou;
- tela não pode cumprir função;
- retry recarrega toda a visão.

### Erro de formulário

Use quando:

- submit falhou;
- validação impede envio;
- a página continua utilizável.

### Erro de item/dialog

Use quando:

- uma ação específica falhou;
- outros itens continuam válidos.

### Erro de integração secundária

Pode ser fail-soft se não compromete o objetivo principal.

Exemplo: falha em preparar link de compartilhamento pós-agenda pode cair para
atalho de painel, sem desfazer horários já salvos.

## 53. Não apagar dados válidos por erro secundário

Se a tela já tem dados e uma ação posterior falha, preservar os dados.

Exemplo:

`ServicesPage` mostra erro acima da lista quando `services` já existe, em vez
de substituir toda a tela por `ErrorState`.

Esse princípio reduz perda de contexto.

## 54. Erros estruturados

Quando o backend expõe estrutura adicional, preferir usá-la.

Exemplos possíveis já implementados:

- `ApiError.status`;
- `ApiError.data`;
- pendências de encerramento;
- códigos de timeout;
- estados de ativação financeira.

Evitar regex em mensagem para decisões de domínio quando existe campo
estruturado disponível.

Lookup de CEP ainda possui uma leitura textual específica para distinguir "não
encontrado"; isso é um ponto local de compatibilidade, não padrão a replicar em
contratos novos.

## 55. Atualização depois de mutação

Há três estratégias válidas.

### Aplicar resposta localmente

Use quando a resposta contém o recurso atualizado.

### Refazer leitura

Use quando várias partes derivadas precisam ser reconciliadas.

### session.refresh

Use quando shell/roteamento/contexto de sessão depende da alteração.

Uma mutação pode combinar essas estratégias.

No encerramento do negócio, a resposta confirmada é aplicada por
`adoptArchivedBusiness`, removendo apenas o vínculo correspondente do contexto
local e invalidando leituras antigas. A navegação de sucesso não espera o refresh
silencioso; uma falha de sincronização não autoriza repetir o arquivamento.

Não usar reload de página como mecanismo padrão de sincronização.

## 56. Navegação depois de salvar

Só navegar depois de confirmar que a etapa necessária concluiu.

Na ativação:

```text
negócio salvo
  → primeiro serviço

serviço salvo + publicação confirmada
  → horários

horários salvos
  → painel/checkout
```

Se a API falha, a interface permanece na etapa atual e mostra o erro.

Essa regra evita avanço visual sem persistência.

## 57. Sucesso parcial e navegação

Quando uma operação possui subetapas:

```text
persistir entidade
  → enviar mídia
  → navegar
```

a navegação só deve ocorrer quando o que a próxima tela pressupõe estiver
garantido.

Se a entidade já foi persistida mas mídia opcional falhou, manter a pessoa no
editor com mensagem específica é apropriado para permitir retry.

## 58. Refresh e repetição segura

Ao implementar uma nova jornada, testar:

- refresh antes de submit;
- refresh depois do submit;
- voltar/avançar do navegador;
- submit repetido;
- request lenta;
- request que retorna depois de mudança de campo;
- sessão que expira durante mutação;
- API indisponível depois que parte da operação concluiu.

Esses cenários revelam dependência indevida de estado transitório.

## 59. Estado financeiro não deve ficar só no React

Variáveis como:

```text
pix
paymentStatus
checkoutPaymentId
```

são estado de apresentação da tentativa atual.

O fato real permanece no backend/provedor reconciliado.

Refresh pode exigir consultar novamente o estado persistido; por isso o produto
não pode considerar o estado local como ledger.

## 60. Valores derivados

Quando um valor pode ser calculado do estado atual, evitar armazenar uma segunda
cópia manual sem necessidade.

Exemplos:

- `profileChanged`;
- `bookingNotificationsChanged`;
- `atServiceLimit`;
- `firstConfiguration`;
- `quickConfirmation`.

Use `useMemo` quando o cálculo é relevante/custoso ou quando estabilizar a
referência ajuda dependências.

Não aplicar `useMemo` indiscriminadamente a expressões triviais.

## 61. Refs para estado que não renderiza

`useRef` é usado quando o dado precisa sobreviver renders sem causar render.

Exemplos:

- sequência de lookup de CEP;
- execução atual do polling;
- tentativa/idempotency key de checkout;
- referência de `dialog`;
- referência de scroller.

Não usar ref para esconder estado que deveria aparecer na UI.

## 62. useEffect

Use efeito para sincronizar React com algo externo:

- carregar dados ao entrar/mudar contexto;
- timers;
- storage/event listeners;
- browser APIs;
- cleanup;
- analytics de visualização.

Evite efeito para calcular valor que pode ser derivado diretamente durante
render.

Sempre revisar cleanup quando o efeito registra listener, timer, object URL ou
processo concorrente.

## 63. Dependências de efeito

Callbacks usados como dependência de `useEffect` podem ser estabilizados com
`useCallback` quando necessário.

Exemplos atuais:

```text
AccountPage.load
ScheduleSettingsPage.load
ServicesPage.load
SessionProvider.refresh
```

Não remover dependência do array apenas para silenciar loop; resolver a causa da
instabilidade.

## 64. Form state versus servidor

Depois de resposta bem-sucedida, normalizar novamente o valor retornado antes de
definir baseline.

Isso evita diferença falsa entre:

- valor digitado;
- valor canonicalizado pelo backend.

`BusinessPage` e `AccountPage` fazem esse tipo de reconciliação.

## 65. Conteúdo sensível

Não persistir em storage/browser estado sensível desnecessário.

Exemplos:

- senha fica apenas no state do formulário;
- após troca bem-sucedida, campos são limpos;
- credential Google é encaminhada ao fluxo de login;
- capability de visitante possui contrato próprio e não vira sessão geral.

Ao criar fluxo novo, persistir somente o mínimo necessário.

## 66. Senhas

Campos de senha:

- usam `type="password"` por padrão;
- podem oferecer toggle de visibilidade;
- mantêm botão de toggle com nome acessível;
- nova senha usa comprimento mínimo na UI;
- confirmação é validada localmente;
- backend continua responsável pela política real.

Nunca enviar senha para analytics/logs.

## 67. Dados de formulário e analytics

Payload de formulário não deve ser copiado integralmente para evento.

Eventos precisam de propriedades permitidas e mínimas.

Evitar enviar:

- senha;
- CPF/CNPJ;
- WhatsApp;
- e-mail;
- endereço;
- conteúdo livre;
- token/capability.

Analytics deve representar etapa, não replicar cadastro.

## 68. Padrão de implementação para nova tela de edição

Modelo recomendado:

```text
1. carregar recurso
2. normalizar para form
3. guardar baseline
4. renderizar loading/error
5. controlar campos
6. validar UX
7. normalizar payload
8. bloquear submit duplicado
9. enviar via apiRequest
10. usar resposta como autoridade
11. atualizar baseline
12. refresh da sessão se necessário
13. mostrar sucesso ou navegar
14. tratar erro no menor escopo
```

Não adicionar estado global se esse ciclo cabe na própria página.

## 69. Padrão para nova lista remota

```text
data = null
error = ""

load:
  limpar erro
  request
  atualizar data
  erro → guardar mensagem

render:
  data nulo + sem erro → LoadingState
  data nulo + erro → ErrorState + retry
  data vazio → EmptyState
  data preenchido → lista
  erro posterior + data preenchido → feedback local
```

Esse padrão já aparece em módulos atuais.

## 70. Padrão para mutação de item

```text
identificar item em andamento
  → limpar erro local
  → request
  → aplicar resposta no item
  → feedback
  → liberar estado
```

Use identificador, não boolean global, quando a lista precisa saber qual item
está mudando.

## 71. Padrão para integração secundária

Quando integração secundária não é necessária para concluir o objetivo principal:

```text
operação principal
  → persistir
  → integração secundária fail-soft
```

Não fazer:

```text
analytics falhou
  → impedir salvar serviço
```

ou:

```text
compartilhamento indisponível
  → desfazer configuração da agenda
```

## 72. Segurança de dados críticos

O frontend nunca deve ser autoridade de:

- preço;
- valor de plano;
- desconto;
- limite;
- papel;
- negócio ativo;
- negócio publicado;
- profissional elegível;
- disponibilidade;
- ownership de booking;
- estado financeiro;
- cobrança paga;
- entitlement.

Mesmo que um valor seja necessário para renderizar, qualquer mutação crítica
deve ser revalidada server-side.

## 73. Testes de formulário

Cobertura proporcional deve incluir, conforme risco:

- render inicial;
- carregamento;
- validação local;
- payload normalizado;
- submit desabilitado durante request;
- sucesso;
- erro;
- retry;
- refresh/session update;
- navegação;
- edge case de estado parcial.

Não testar apenas "o botão existe".

## 74. Testes de concorrência

Para fluxos com race condition possível, adicionar regressão específica.

Exemplos de risco:

- CEP A/B;
- polling reiniciado;
- upload de várias fotos;
- toggle repetido;
- mudança de rota durante request;
- retry financeiro.

O teste deve garantir que resposta antiga não prevalece sobre estado novo.

## 75. Testes de idempotência

Idempotência financeira é principalmente de backend, mas o frontend deve
proteger o contrato de integração.

Para checkout, testar:

- header `Idempotency-Key`;
- repetição coerente da mesma tentativa;
- geração de nova intenção quando fingerprint muda;
- não promover PIX pendente a plano ativo.

## 76. Testes de acessibilidade

Formulários precisam verificar:

- label associada;
- fieldset/legend para grupo quando adequado;
- erro perceptível;
- `aria-invalid`;
- foco;
- botões com texto/label;
- disabled correto;
- feedback assíncrono anunciável.

Mobile não pode esconder erro ou ação abaixo de barra fixa sem espaço de safe
area.

## 77. Anti-padrões

Evitar:

- chamar `fetch` diretamente em uma página sem motivo;
- criar outro cliente HTTP;
- validar permissão só no React;
- guardar resposta financeira como verdade permanente no localStorage;
- avançar onboarding antes de resposta;
- limpar formulário inteiro após erro;
- recarregar a página para sincronizar estado simples;
- engolir erro de mutação principal;
- mostrar "salvo" antes da resposta;
- tratar 401 manualmente de formas diferentes em cada tela;
- usar `location.state` como única persistência de jornada crítica;
- gerar checkout sem idempotency key;
- misturar erro local de dialog com erro fatal de página;
- duplicar helpers de máscara/formatação.

## 78. Critério para criar hook de formulário

O projeto não possui hoje um framework/hook global de forms para todas as telas.

Criar um hook compartilhado só faz sentido se houver repetição real de:

- lifecycle;
- validação;
- baseline;
- submit;
- erros;
- reset;

e se a abstração não esconder regras específicas de cada domínio.

Não criar `useForm` próprio apenas porque várias páginas possuem
`useState({ ... })`.

## 79. Critério para introduzir biblioteca

Uma biblioteca externa de formulário/state deve resolver problema demonstrado,
por exemplo:

- performance real em formulário muito grande;
- validação declarativa extensa e repetitiva;
- necessidade comprovada de cache/server-state;
- sincronização difícil já causando bugs.

Antes disso:

1. medir o problema;
2. avaliar bundle e manutenção;
3. verificar impacto nos testes;
4. migrar incrementalmente;
5. evitar duas arquiteturas concorrentes sem plano claro.

## 80. Documentos relacionados

- [`frontend-arquitetura.md`](./frontend-arquitetura.md): arquitetura geral;
- [`frontend-mapa-telas-jornadas.md`](./frontend-mapa-telas-jornadas.md):
  rotas e jornadas;
- [`frontend-componentes-primitives.md`](./frontend-componentes-primitives.md):
  primitives e componentes;
- [`frontend-estilos.md`](./frontend-estilos.md): CSS;
- [`session-security.md`](./session-security.md): sessão;
- [`ativacao-profissional-ux.md`](./ativacao-profissional-ux.md): onboarding;
- [`checkout-idempotente.md`](./checkout-idempotente.md): checkout seguro;
- [`planos.md`](./planos.md): regras financeiras;
- [`agendamento-integridade.md`](./agendamento-integridade.md): integridade do
  booking;
- [`frontend-analytics-observabilidade.md`](./frontend-analytics-observabilidade.md): eventos, consentimento, atribuição e conversões;
- [`frontend-seguranca.md`](./frontend-seguranca.md): fronteiras de confiança, sessão, URLs, uploads e secrets;
- [`frontend-qa-prontidao.md`](./frontend-qa-prontidao.md): testes, acessibilidade, mobile/WebKit e prontidão;
- [`qualidade-codigo.md`](./qualidade-codigo.md): validações de qualidade.

## 81. Manutenção

Atualizar este documento quando mudar de forma durável:

- primitive HTTP;
- estratégia de sessão;
- convenção de formulários;
- persistência de estado navegável;
- tratamento global de erro;
- padrão de upload;
- idempotência no frontend;
- estratégia de server-state;
- biblioteca de forms/state;
- comportamento comum de retry/cancelamento.

Mudanças locais de um único formulário não precisam alterar este documento se o
padrão geral permanecer igual.
