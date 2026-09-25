# Segurança do frontend — Agenda Fashion

> **Papel documental:** referência técnica especializada para as fronteiras de
> segurança entre navegador, React, sessão, API e backend.
>
> Sessão e recuperação de senha continuam canônicas em
> [`session-security.md`](./session-security.md). Dependências continuam em
> [`dependency-security.md`](./dependency-security.md). Regras de autorização
> de negócio continuam no backend e nos documentos de domínio.
>
> Este documento descreve o estado executável atual e registra achados de
> hardening observados durante a auditoria. Ele não transforma redirecionamentos
> do frontend em autorização.

## 1. Objetivo

O frontend deve ser tratado como ambiente não confiável.

A pessoa usuária controla, direta ou indiretamente:

- DevTools;
- requests;
- query string;
- fragmentos;
- localStorage/sessionStorage;
- IDs enviados;
- valores de formulários;
- DOM;
- arquivos selecionados;
- ordem das chamadas;
- retries;
- navegação manual para qualquer rota.

Por isso:

> o frontend orienta a experiência; o backend decide identidade, permissão,
> ownership, limites, preço, publicação, agenda e efeitos financeiros.

## 2. Modelo de confiança

A fronteira principal é:

```text
Browser / React
       │
       │ dados não confiáveis
       ▼
API Express
       │
       ├── autenticação
       ├── autorização
       ├── normalização
       ├── validação
       ├── rate limit
       ├── transação
       └── persistência
```

Nunca considerar seguro um valor apenas porque:

- veio de um componente protegido;
- estava escondido;
- era `disabled`;
- veio do localStorage;
- veio de `location.state`;
- foi calculado pela UI;
- o usuário não deveria conhecer o endpoint.

## 3. Stack de proteção observada

A camada HTTP atual usa, entre outros:

- Helmet;
- Content Security Policy;
- CORS com allowlist;
- cookie HttpOnly;
- JWT HS256;
- validação de sessão no banco;
- revogação de sessão;
- rate limits;
- limites de JSON;
- upload com limite e magic bytes;
- logs sem body completo;
- tratamento de erro sem stack em produção;
- validação de runtime/secrets.

Essas camadas são complementares.

Nenhuma substitui autorização de domínio.

## 4. Sessão principal

A sessão principal é entregue em cookie HttpOnly.

Em produção:

```text
nome: __Host-af_session
HttpOnly: true
Secure: true
SameSite: Lax
Path: /
```

O prefixo `__Host-` exige, no navegador compatível:

- Secure;
- Path=/;
- ausência de Domain.

Isso reduz escopo indevido do cookie.

## 5. JWT não pertence ao JavaScript novo

O fluxo atual de login/cadastro:

```text
backend cria JWT
→ backend grava cookie HttpOnly
→ corpo da resposta não expõe token
→ frontend grava apenas o marcador técnico session_active
```

`saveSession()` remove qualquer chave legada `token` do localStorage.

Novo código não deve voltar a persistir JWT no browser storage.

## 6. Compatibilidade Bearer legada

Ainda existe compatibilidade temporária:

- `apiRequest` lê `localStorage.token` se existir;
- envia `Authorization: Bearer ...`;
- backend prioriza Bearer sobre cookie;
- `hasSession()` ainda reconhece o token legado.

Isso existe para migração.

Não usar essa compatibilidade como padrão para feature nova.

O objetivo de segurança continua sendo cookie HttpOnly como sessão primária.

## 7. Por que localStorage não deve guardar segredo

Qualquer JavaScript executando na origem consegue ler localStorage.

Portanto não armazenar ali:

- JWT novo;
- senha;
- token de reset;
- capability de booking;
- API key;
- segredo OAuth;
- token CAPI;
- webhook secret.

Mesmo com CSP, localStorage deve ser tratado como storage acessível ao runtime da
página.

## 8. Dados de sessão armazenados localmente

Desde a Wave D, o bootstrap canônico persiste somente:

```text
session_active
```

A resposta de `/minha-sessao` fica em memória no React.

`usuario` e `negocio` legados são removidos durante bootstrap e ao salvar uma
sessão nova. Assim nome, e-mail, WhatsApp, foto e contexto de negócio deixam de
ficar expostos em `localStorage` por conveniência.

Esse marcador **não é autoridade de autorização**. A sessão real continua sendo
o cookie HttpOnly validado pelo backend e `/minha-sessao` continua sendo a
fonte de verdade do contexto.

## 9. Refresh canônico de sessão

`SessionProvider` chama:

```text
GET /minha-sessao
```

para reconstruir:

- usuário;
- negócio principal;
- vínculos;
- papel;
- Admin.

Essa resposta do backend é superior ao cache local.

## 10. 401 global

`apiRequest` trata 401 globalmente.

Ao receber 401:

```text
clearSession({ notify: true })
```

e o `SessionProvider` volta ao estado signed-out.

Isso reduz telas privadas operando depois de expiração da sessão.

## 11. 403 não é o mesmo que 401

O cliente HTTP global limpa sessão apenas em 401.

Um 403 normalmente significa:

- identidade conhecida;
- ação não autorizada.

A feature deve mostrar estado coerente ou redirecionar conforme o contrato.

Não converter 403 em logout automático por conveniência.

## 12. ProtectedRoute é UX

`ProtectedRoute` decide navegação para:

- visitante;
- Admin;
- conta sem negócio;
- Owner;
- Professional;
- negócio não publicado.

Isso melhora a experiência.

Não é fronteira de segurança.

Uma pessoa pode chamar o endpoint sem renderizar `ProtectedRoute`.

## 13. Autorização backend

Endpoints privados precisam validar novamente:

- `req.user.id`;
- papel;
- vínculo ativo;
- negócio;
- ownership do recurso;
- estado do domínio.

Exemplo observado em serviços:

```text
usuarioId
  → buscarNegocioDono(usuarioId)
  → buscarServicoDoNegocio(id, negocioId)
  → somente então mutar
```

Esse padrão impede que trocar `id` no request dê acesso a serviço de outro
negócio.

## 14. IDs do frontend nunca bastam

IDs vindos de:

- params;
- body;
- query;
- localStorage;
- React state;

precisam ser revalidados.

Exemplo de capa de serviço:

1. backend encontra o negócio da dona;
2. encontra o serviço do negócio;
3. encontra a foto da galeria do mesmo negócio;
4. confirma que `foto.servico_id === id`;
5. só então troca a capa.

## 15. Papel profissional versus Owner

A rota expressa intenção:

```text
/painel/*       → dona
/profissional/* → profissional
```

O frontend escolhe o vínculo coerente com o path.

O backend continua responsável por validar o vínculo persistido.

Não confiar em:

```text
session.negocio.papel
```

como prova server-side.

## 16. Admin

`authAdmin` deve rodar após autenticação.

O JWT contém somente o ID do usuário.

Permissão administrativa é consultada no banco a cada requisição Admin.

Isso evita transformar claim antigo do token em autorização administrativa
durável.

## 17. Revogação de sessão

Logout válido registra hash SHA-256 do JWT no backend.

O JWT bruto não é persistido na tabela de revogação.

O middleware obrigatório `auth` calcula o hash atual e consulta:

- conta ativa;
- sessão revogada;
- senha alterada depois da emissão.

Token revogado é recusado até sua expiração natural.

## 18. Troca de senha

JWT emitido antes de:

```text
usuarios.senha_alterada_em
```

deixa de autorizar recursos privados.

Esse mecanismo é separado da lista de logout.

Não reutilizar um timestamp de senha para implementar logout normal.

## 19. Achado: optionalAuth e revogação

A Wave A corrige um ponto de hardening identificado no runtime anterior.

Antes da correção, `auth` chamava:

```js
buscarEstadoDaSessao(decoded.id, hashToken(token))
```

enquanto `optionalAuth` chamava apenas:

```js
buscarEstadoDaSessao(decoded.id)
```

No repository, quando `tokenHash = null`, `token_revogado` resulta em
`FALSE`.

Na branch atual, `optionalAuth` também envia `hashToken(token)` e verifica
`token_revogado` antes de preencher `req.user`.

Consequência corrigida:

> antes da Wave A, uma rota que usava `optionalAuth` não aplicava a mesma checagem explícita de
> revogação da rota protegida.

Isso não altera a autorização das rotas obrigatoriamente protegidas, mas impede
afirmar que a revogação está uniformemente aplicada em todos os usos de
autenticação opcional.

A Wave A foi mergeada na `main`: o middleware passa o hash do JWT ao repository, recusa identidade opcional revogada e preserva a rota como pública.

A validação cobre:

- passar o hash do token também no `optionalAuth`;
- manter visitante sem token funcionando;
- limpar cookie revogado quando aplicável;
- adicionar teste de token revogado no `optionalAuth`;
- revisar collectors e outras rotas que usam autenticação opcional.

## 20. Recuperação de senha

Link atual usa preferencialmente:

```text
/redefinir-senha#token=<segredo>
```

Fragmento não é enviado na requisição HTTP inicial.

O frontend também aceita temporariamente token legado em query.

## 21. Limpeza da URL de reset

`PasswordResetPage` lê token de:

- fragmento;
- query legada.

Em seguida usa `history.replaceState` para remover search/hash da barra de
endereço antes da interação.

Isso reduz exposição em:

- cópia acidental;
- screenshots;
- histórico visível;
- analytics de rota.

## 22. Token de reset é segredo

O token bruto de reset:

- não vai para localStorage;
- não deve ir para analytics;
- não deve ser logado;
- é enviado apenas ao endpoint de redefinição;
- é de uso único no backend.

O banco armazena hash, conforme o contrato de sessão.

## 23. Enumeração de conta

Solicitação de recuperação precisa responder de forma neutra para e-mail
existente ou inexistente.

A UI não deve mudar essa propriedade tentando "ajudar" com mensagens que revelem
cadastro.

## 24. Capability de booking visitante

Bookings visitantes usam capability específica.

O link mantém:

```text
#token=<capability>
```

A página lê o fragmento e envia o segredo explicitamente para a API.

Consulta usa:

```text
X-Agenda-Access
```

Cancelamento envia a capability no body previsto pelo endpoint.

## 25. Capability não vira sessão

A capability:

- autoriza somente aquele booking;
- não autentica a conta;
- não concede workspace;
- não ignora cutoff;
- não deve ser reutilizada como bearer global.

A UI deve evitar transformar esse token em storage persistente.

## 26. Conta desativada com booking ativo

O fluxo de conta desativada também usa capability específica.

A página:

```text
/agendamentos/:id/acesso-cliente-desativado
```

lê o token do fragmento e o envia como `X-Agenda-Access`.

Cancelamento usa o token no body.

A API continua decidindo se o booking pode ser cancelado.

## 27. Fragmentos e analytics

Os bridges auditados de page view usam `pathname` e paths sanitizados.

O token de fragmento não deve ser incorporado a:

- page title;
- page_location;
- propriedades;
- logs;
- referrer.

Ao criar analytics novo em páginas com capability, nunca usar
`window.location.href` cru.

## 28. CORS

O backend usa allowlist exata de origem.

Padrão atual inclui:

```text
http://127.0.0.1:5500
http://localhost:5500
https://app.agendafashion.com.br
```

`CORS_ORIGINS` pode substituir essa lista.

Em produção, runtime validation exige HTTPS para origens configuradas.

## 29. Credentials no CORS

O CORS atual permite:

```text
credentials: true
```

porque a sessão principal é cookie.

Por isso não usar:

```text
Access-Control-Allow-Origin: *
```

junto com credenciais.

Novas origens devem ser explícitas e justificadas.

## 30. Headers CORS permitidos

A allowlist atual inclui:

- `Content-Type`;
- `Authorization`;
- `Idempotency-Key`;
- `X-Request-ID`.

`X-Request-ID` também é exposto na resposta.

## 31. X-Agenda-Access e CORS

A Wave D inclui `X-Agenda-Access` em `corsOptions.allowedHeaders`.

O deploy canônico continua same-origin, mas agora uma origem explicitamente
permitida também consegue concluir o preflight da capability sem mudar seu
escopo.

`tests/cors-capability.test.js` protege o contrato de OPTIONS/preflight.

CORS continua sem autorizar booking: a capability ainda é validada no backend e
continua restrita ao booking correspondente.

## 32. CORS não substitui autorização

Mesmo uma origem permitida pode ter:

- usuário mal-intencionado;
- XSS;
- request manipulado.

CORS não valida ownership.

Não usar origem como identidade de usuário.

## 33. CSRF: política da Wave B

O AF continua sem token CSRF dedicado na topologia web atual, mas a proteção
deixa de depender apenas de premissas implícitas.

As camadas são:

- cookie `SameSite=Lax`;
- `Secure` em produção;
- mesma origem como arquitetura canônica;
- CORS restrito;
- middleware `csrfProtection` para métodos unsafe autenticados por cookie.

Quando o navegador fornece metadados, o middleware:

- rejeita `Sec-Fetch-Site: cross-site`;
- valida `Origin`;
- usa `Referer` como fallback;
- aceita a própria origem da requisição ou origem explicitamente permitida.

Requests sem cookie de sessão não entram nessa barreira porque não carregam
autoridade ambiente da sessão. Clientes não-browser sem Origin/Referer/Fetch
Metadata continuam compatíveis; nesses casos, `SameSite=Lax` permanece a
primeira barreira do navegador.

Essa escolha é deliberada para o desenho atual. Reabrir o threat model antes de
qualquer mudança em:

- `SameSite`;
- domínio do cookie;
- frontend/API em origens distintas;
- aceitação de form-urlencoded para mutações autenticadas;
- endpoints mutáveis via GET;
- embedding cross-site.

Se essas premissas mudarem, token CSRF dedicado ou validação mais estrita pode
se tornar necessária.

## 34. Content Security Policy

Helmet aplica CSP no servidor.

Diretivas observadas:

```text
default-src 'self'
base-uri 'self'
form-action 'self'
object-src 'none'
script-src 'self' + Google + Meta permitidos
script-src-attr 'none'
frame-src 'self' + accounts.google.com
frame-ancestors 'self'
worker-src 'self' blob:
```

A CSP reduz superfície de script e plugins.

## 35. script-src

Scripts remotos permitidos atualmente:

- Google Identity;
- Meta Pixel;
- Google Tag Manager/gtag.

Não adicionar CDN/script novo sem:

1. necessidade concreta;
2. revisão de segurança/privacidade;
3. atualização explícita da CSP;
4. teste;
5. avaliação de performance.

## 36. Inline script

`script-src` não contém:

```text
'unsafe-inline'
```

e `script-src-attr` é `'none'`.

Não introduzir handlers inline para contornar essa política.

## 37. style-src

A CSP permite `'unsafe-inline'` para estilos.

Isso é uma concessão diferente de script inline.

Não interpretar como autorização para relaxar `script-src`.

## 38. Imagens na CSP

`img-src` aceita:

```text
'self'
data:
blob:
https:
```

Isso é amplo para imagens HTTPS e suporta mídia pública/CDN.

Novos usos de imagem externa devem considerar:

- privacidade;
- referrer;
- domínio de origem;
- conteúdo controlado;
- necessidade real.

## 39. Frames

`frame-ancestors 'self'` impede enquadramento por origem externa.

`frame-src` aceita Google Identity além do próprio AF.

Se uma feature pedir iframe de terceiro, não simplesmente liberar `*`.

## 40. COOP/CORP

Helmet está configurado com:

```text
Cross-Origin-Opener-Policy: same-origin-allow-popups
Cross-Origin-Resource-Policy: cross-origin
```

O COOP preserva compatibilidade com popups necessários de autenticação.

Mudanças nesses headers precisam testar Google login e integrações externas.

## 41. X-Powered-By

Express desabilita:

```text
x-powered-by
```

Não reativar por debugging.

## 42. JSON body

O servidor limita JSON a:

```text
1 MB
```

Isso reduz payload abusivo antes de chegar ao domínio.

Upload de imagem usa parser separado.

## 43. Rate limits

Limites atuais incluem proteções específicas para:

- login;
- cadastro;
- recuperação de senha;
- booking;
- checkout;
- analytics/eventos;
- upload;
- leitura pública;
- Copilot;
- convites.

Rate limit é defesa de abuso.

Não é autorização nem substitui idempotência.

## 44. Login rate limit

Login combina:

```text
IP + email normalizado
```

e ignora requests bem-sucedidos para a contagem configurada.

A UI deve exibir 429 como bloqueio temporário, sem tentar loop automático.

## 45. Checkout rate limit

Checkout usa:

```text
usuario autenticado
ou
IP
```

e continua protegido por Idempotency-Key.

Os dois mecanismos resolvem problemas diferentes:

- rate limit → abuso/volume;
- idempotência → repetição lógica da mesma operação.

## 46. Upload rate limit

Upload possui limitador próprio.

Hoje o teto configurado é:

```text
20 uploads / hora
```

segundo a chave padrão do middleware.

Não implementar retry automático agressivo de imagens no frontend.

## 47. Upload: tamanho

O parser de upload limita cada imagem a:

```text
5 MB
```

Também limita:

- 1 arquivo;
- 10 campos;
- 11 partes.

O frontend pode validar antes para UX, mas o backend é obrigatório.

## 48. Upload: MIME

Tipos permitidos:

```text
image/jpeg
image/png
image/webp
```

O mimetype declarado não é suficiente.

## 49. Upload: magic bytes

Depois de receber o buffer, o backend verifica assinatura real.

Exemplos:

- JPEG → `FF D8 FF`;
- PNG → assinatura PNG;
- WebP → `RIFF....WEBP`.

Arquivo de texto renomeado para `.png` é rejeitado.

## 50. Upload: memória

O middleware acumula a imagem em memória até 5 MB.

Isso torna o limite de tamanho particularmente importante.

Se o volume/limite mudar, revisar:

- memória por request;
- concorrência;
- rate limit;
- streaming;
- Cloudinary.

## 51. Upload: Cloudinary

Após validação, o backend envia o buffer para Cloudinary como:

```text
resource_type: image
```

O frontend nunca recebe:

- API secret do Cloudinary;
- credencial de upload privilegiada.

Credenciais ficam no backend.

## 52. Ownership de mídia

Antes de mudar foto de serviço, o backend confirma que:

- usuário é dona;
- serviço pertence ao negócio da dona.

Galeria/capa repetem a validação de contexto.

Não confiar em `servicoId` ou `fotoId` enviados pela UI.

## 53. Limpeza de mídia

Quando persistência falha depois do upload, o service tenta remover a imagem
órfã.

Remoção de serviço/foto também tenta limpar o asset remoto.

Falha de cleanup é registrada como aviso sem transformar o recurso de outro
negócio em alvo.

## 54. Media URL no frontend

`resolveMediaUrl`:

- resolve paths relativos contra a API/origin;
- aceita URLs HTTP(S);
- converte protocol-relative para HTTPS;
- em página HTTPS tenta elevar HTTP externo para HTTPS;
- aplica transformação Cloudinary apenas para host/path reconhecidos.

Isso é resolução de mídia, não autorização.

## 55. URL de imagem não deve carregar segredo

Não embutir em `src` de imagem:

- capability;
- token de reset;
- JWT;
- API key.

URLs de imagem podem aparecer em:

- cache;
- logs de CDN;
- requests;
- ferramentas do navegador.

## 56. Conteúdo textual e XSS

React escapa texto interpolado por padrão.

Essa proteção pode ser perdida se uma feature usar HTML bruto.

Regra para novas features:

- preferir texto/JSX;
- não usar `dangerouslySetInnerHTML` com conteúdo de usuário;
- se HTML rico virar requisito real, definir sanitização explícita e testes.

Não concatenar entrada de usuário em HTML manual.

## 57. CSP não corrige XSS de lógica

CSP reduz impacto de várias classes de injeção, mas não elimina:

- URLs perigosas;
- DOM clobbering;
- vazamento de storage por script já autorizado;
- lógica insegura;
- uso indevido de HTML bruto.

Prevenção começa no rendering e na validação.

## 58. Redirecionamentos internos

`safeInternalPath` aceita somente string que:

- começa com `/`;
- não começa com `//`.

Isso protege o retorno pós-login contra redirect protocol-relative externo.

Exemplo rejeitado pelos testes:

```text
//site-malicioso.test
```

## 59. Intenção de plano

Slug de plano é normalizado para padrão seguro.

Valor como:

```text
../../checkout
```

é descartado.

Mesmo assim, backend valida plano/preço/eligibilidade.

## 60. Redirect backend legado

O servidor também restringe destinos de redirecionamento compatíveis para path
interno.

Segmentos de `/app/*` são codificados antes de montar o destino.

Isso reduz open redirect via rotas de compatibilidade.

## 61. Links externos

Sempre que uma tela abrir destino externo:

- usar URL obtida de fonte confiável/validada;
- preferir HTTPS;
- usar `rel="noreferrer"`/`noopener` quando `target="_blank"`;
- não permitir `javascript:`;
- não interpolar token.

A regra é mais importante para URLs editáveis por negócio.

## 62. URL de publicação/localização

O domínio atual aceita URL de publicação com protocolo:

```text
http:
https:
```

e hostname válido.

Isso é regra de negócio existente.

Uma futura exigência de HTTPS deve ser mudança explícita de produto/backend, não
um filtro silencioso apenas no frontend.

## 63. Secrets

`.env.example` é explícito:

> segredos nunca devem aparecer em `VITE_*`.

Exemplos exclusivamente backend:

- `DATABASE_URL`;
- `JWT_SECRET`;
- `ASAAS_API_KEY`;
- `ASAAS_WEBHOOK_TOKEN`;
- `CLOUDINARY_API_SECRET`;
- `OPENAI_API_KEY`;
- `WHATSAPP_ACCESS_TOKEN`;
- `WHATSAPP_APP_SECRET`;
- `META_CAPI_ACCESS_TOKEN`;
- `GA4_API_SECRET`;
- credenciais Google Ads;
- tokens Meta Ads;
- segredos OAuth TikTok/Pinterest.

## 64. VITE_* é público

Variáveis Vite são embutidas no bundle quando usadas pelo frontend.

Logo:

```text
VITE_* = potencialmente visível ao navegador
```

Usar apenas para valores públicos, como origem pública quando necessário.

Nunca "esconder" segredo por minificação.

## 65. Runtime validation

O backend valida configuração antes de subir.

Entre os controles:

- banco configurado;
- JWT_SECRET presente;
- JWT_SECRET com pelo menos 32 caracteres;
- URLs HTTPS em produção quando exigidas;
- integrações habilitadas exigem credenciais correspondentes;
- formatos de IDs/flags/timeouts.

Falhar cedo é preferível a iniciar parcialmente com segurança degradada.

## 66. Segredo ausente

Não criar fallback de produção para segredo crítico.

Exemplo:

```text
JWT_SECRET ausente
→ startup/auth deve falhar
```

Não gerar segredo novo a cada boot, pois isso invalidaria sessões e esconderia
configuração incorreta.

## 67. Google e Meta

O navegador recebe apenas configuração pública:

- GA4 Measurement ID;
- Google Ads ID/labels;
- Meta Pixel ID.

Credenciais server-side permanecem no backend.

Consultar
[`frontend-analytics-observabilidade.md`](./frontend-analytics-observabilidade.md)
para consentimento e conversões.

## 68. Dados financeiros

Frontend envia intenção:

- plano escolhido;
- CPF/CNPJ para criar cobrança;
- Idempotency-Key.

Backend decide:

- negócio da dona;
- plano real;
- preço;
- publicação;
- plano atual;
- entitlement;
- criação da cobrança.

Não confiar em `plan.valor` do DOM para cobrança.

## 69. CPF/CNPJ

Documento usado para checkout é dado sensível do fluxo financeiro.

Não deve entrar em:

- analytics;
- URL;
- localStorage;
- logs do frontend.

O body HTTPS para endpoint necessário é o canal previsto.

## 70. Idempotency-Key

A chave de checkout não é credencial de conta.

Ela impede repetição lógica indevida.

Mesmo assim:

- limitar formato;
- não exibir desnecessariamente;
- não reutilizar para outra intenção;
- não usar como autorização.

Backend valida chave e request hash.

## 71. Erros da API

`ApiError` expõe para a feature:

- mensagem;
- status;
- data segura retornada pelo backend.

Em produção, o `errorHandler` não envia stack de erro inesperado.

Erro 500 recebe mensagem genérica e `request_id`.

## 72. request_id

Servidor aceita um `X-Request-ID` com formato restrito ou gera UUID novo.

A resposta expõe o ID.

Isso permite correlacionar suporte/log sem mostrar stack ou payload interno.

Frontend pode apresentar `request_id` em diagnóstico quando fizer sentido, sem
exibir segredo.

## 73. Logging HTTP

O logger de request registra:

- método;
- path;
- status;
- duração;
- user id quando disponível;
- request id.

Ele não registra body completo no middleware auditado.

Isso é importante porque bodies podem conter:

- senha;
- CPF;
- token;
- dados pessoais.

## 74. Query e path

`req.path` exclui query string.

Isso reduz chance de logar tokens/query sensível no request logger genérico.

Features específicas ainda precisam evitar logs próprios com URL completa.

## 75. Erro em produção

Stack e detalhe de banco são omitidos da resposta.

Logs internos de erro inesperado também omitem stack/detail em produção pela
configuração atual do `errorHandler`.

Não retornar `err.stack` ao navegador.

## 76. Mensagem operacional

Erros 4xx podem retornar mensagem de domínio.

Essas mensagens não devem revelar:

- SQL;
- nome de tabela desnecessário;
- token;
- hash;
- credencial;
- existência de outra conta quando isso gera enumeração indevida.

## 77. CSP e analytics

Se Google/Meta forem removidos, revisar também:

- CSP;
- config pública;
- consent UI;
- scripts;
- testes.

Não deixar host remoto autorizado indefinidamente sem consumidor.

## 78. Dependências

O frontend/backend passam por audit de dependências no CI.

Não adicionar pacote de segurança "por precaução" sem necessidade.

Uma nova dependência também aumenta superfície.

Consultar `dependency-security.md`.

## 79. BrowserStorage fallback

`browserStorage` possui fallback em memória quando local/session storage falha.

Objetivo:

- manter UX funcional em modos de privacidade;
- não derrubar aplicação.

O fallback dura o runtime da aba/processo JS.

Não usá-lo para prometer persistência de dado crítico.

## 80. Storage bloqueado

Feature deve continuar segura quando storage lançar `SecurityError`.

Não assumir que:

```js
localStorage.setItem(...)
```

sempre funciona.

Para autenticação, cookie HttpOnly continua sendo a fonte server-side.

## 81. Tab synchronization

`SessionProvider` escuta:

- evento próprio de sessão limpa;
- `storage`.

Quando outra aba remove chaves e `hasSession()` passa a falso, o estado local é
derrubado.

Isso melhora coerência de logout no browser.

Não substitui revogação server-side.

## 82. Logout local primeiro

O frontend:

1. limpa estado local;
2. atualiza UI para signed-out;
3. tenta `POST /logout`.

Falha de rede não mantém a pessoa visualmente logada.

No backend, revogação/cookie continuam sendo a garantia de sessão quando a
requisição chega.

## 83. Logout e múltiplos dispositivos

A revogação é por token/sessão.

Sair neste navegador não deve ser descrito como:

```text
encerrar todas as sessões
```

a menos que exista caso de uso server-side específico para isso.

## 84. Cache de documento

O servidor desabilita cache do documento React conforme utilitário HTTP.

Assets versionados podem receber cache longo.

Esse desenho reduz risco de HTML obsoleto apontar permanentemente para estado
antigo, preservando performance de assets imutáveis.

## 85. Runtime recovery não é segurança de sessão

Recuperação de chunk/build obsoleto existe para confiabilidade.

Não usar reload/runtime recovery como solução para:

- sessão inválida;
- autorização;
- token revogado;
- dado financeiro obsoleto.

## 86. Dados no DOM

Não colocar segredo em:

- `data-*`;
- input hidden;
- atributo;
- comentário HTML;
- texto invisível.

"Invisível" não significa secreto.

## 87. Disabled/hidden

Um botão desabilitado ou oculto só previne ação pela UI.

A API deve recusar a mesma operação quando o request é forjado.

Exemplos:

- upgrade;
- remover profissional;
- publicar;
- alterar preço;
- cancelar booking.

## 88. Feature flags

Flag no frontend é visibilidade/comportamento.

Flag que protege ação sensível precisa de enforcement equivalente no backend.

Não usar variável pública Vite como ACL.

## 89. Plano

Limite de:

- bookings;
- profissionais;
- serviços;

é validado no backend.

A UI pode antecipar mensagem, mas não decide entitlement.

## 90. Publicação

Status `publicado` exibido na sessão não é autorização suficiente para
checkout.

Backend de checkout consulta o negócio e revalida publicação.

Preservar esse padrão.

## 91. Booking

Criação/cancelamento/reagendamento têm regras temporais e de ownership no
backend.

Frontend nunca deve calcular sozinho e enviar:

```text
pode_cancelar=true
```

como autoridade.

## 92. Concorrência

Segurança também inclui integridade contra requests concorrentes.

Frontend pode bloquear double-click.

Backend precisa:

- locks;
- constraints;
- idempotência;
- transações.

Particularmente importante em:

- booking;
- plano;
- checkout;
- equipe;
- publicação.

## 93. AbortController

Cancelar request no browser é controle de UX.

Não presume rollback no backend.

Se uma mutação já chegou ao servidor, abortar `fetch` pode apenas parar a
espera da resposta.

Por isso operações críticas devem ser idempotentes/reconciliáveis.

## 94. Timeout

Timeout do cliente HTTP é atualmente 20 s por padrão.

Receber timeout não prova que o backend não executou.

Para mutação crítica:

- consultar estado;
- reutilizar idempotency key quando previsto;
- evitar duplicar ação cegamente.

## 95. Upload e timeout

Se upload/provider terminar mas resposta falhar, retry pode produzir asset
duplicado.

O backend atual tenta cleanup em várias falhas.

Feature nova de mídia deve definir idempotência/cleanup quando necessário.

## 96. URLs de API

`VITE_API_URL` define base do cliente.

O cliente concatena:

```text
API_URL + path
```

Código de feature deve passar path controlado.

Não aceitar URL absoluta fornecida por usuário para `apiRequest`.

## 97. Fetch direto

Há código histórico/analytics que usa `fetch` diretamente.

Para chamadas de domínio novas, preferir `apiRequest` para herdar:

- credentials;
- timeout;
- JSON;
- 401;
- `ApiError`.

Se houver motivo para fetch direto, documentar por que o comportamento global
não é desejado.

## 98. Dados externos em links

Quando backend retorna URL externa, frontend deve tratá-la como dado.

Antes de abrir:

- validar protocolo;
- validar host quando o domínio é conhecido;
- evitar interpolar em HTML bruto;
- usar proteção de nova aba.

Billing já possui regra backend própria para invoice URL do Asaas.

## 99. OAuth

TikTok/Pinterest usam segredos e encryption key no backend.

Redirect URI é configurada e validada.

Frontend/Admin não deve receber:

- client secret;
- refresh token;
- encryption key.

O callback deve seguir o contrato do provider/backend.

## 100. Google Identity

CSP/COOP possuem exceções necessárias para Google Identity.

Mudança de login precisa ser testada com:

- popup;
- iframe permitido;
- cookie/session;
- conta já existente;
- conta nova.

Não relaxar todos os headers para resolver um problema pontual do provider.

## 101. Consentimento não é autorização

Consentimento de marketing controla medição opcional.

Não confundir com:

- sessão;
- acesso ao negócio;
- permissão de profissional;
- termos financeiros.

Negar Ads não pode bloquear o uso principal.

## 102. Analytics e segredo

Telemetria nunca deve receber:

- senha;
- reset token;
- capability;
- CPF/CNPJ;
- segredo OAuth;
- JWT.

Os bridges atuais já sanitizam rotas Google e bloqueiam reset de senha em
Google/Meta.

Consultar o documento de analytics para os demais contratos.

## 103. Admin e PII

Telas Admin podem exibir dados operacionais necessários.

Isso aumenta o impacto de:

- cache;
- screenshot;
- analytics externo;
- logs no browser;
- extensão maliciosa.

Continuar excluindo tráfego Admin de medições externas conforme a política
aplicável e evitar dados pessoais desnecessários no DOM.

## 104. DevTools não é controle de acesso

Não existe forma de esconder um valor entregue ao browser de alguém que controla
o próprio browser.

Se a pessoa não pode conhecer um dado, o backend não deve entregá-lo.

Mascarar visualmente não resolve exposição de API.

## 105. Source maps e build

Build de frontend deve ser revisado quando configuração passar a publicar source
maps externamente.

Mesmo source map não deveria conter segredo, mas pode ampliar informação sobre
estrutura interna.

A regra principal continua: segredo nunca entra no bundle.

## 106. Service worker

A arquitetura auditada não usa service worker como autoridade de sessão.

Se PWA/service worker for introduzido, revisar:

- cache de respostas privadas;
- logout;
- versão de assets;
- storage;
- background sync;
- capabilities.

Não cachear API privada indiscriminadamente.

## 107. Autocomplete de senha

Campos de senha usam atributos adequados:

- `current-password`;
- `new-password`.

Isso permite password managers sem colocar senha em storage da aplicação.

Não desabilitar autocomplete de senha por falsa sensação de segurança.

## 108. Clipboard

Copiar PIX usa Clipboard API.

Clipboard contém dado financeiro operacional, não credencial de sessão.

Ainda assim, UI deve:

- copiar apenas após ação explícita;
- não ler clipboard silenciosamente;
- informar falha.

## 109. window.confirm

Confirmação de ação destrutiva no frontend reduz erro humano.

Não é controle de segurança.

Request repetido/forjado continua precisando validação backend.

## 110. ErrorBoundary

`ErrorBoundary` reduz tela branca.

Não deve renderizar stack/segredo para usuário em produção.

Erros esperados de API devem continuar tratados localmente.

## 111. Acessibilidade e segurança

Mensagens de segurança também precisam ser acessíveis.

Exemplos:

- sessão expirada;
- erro de permissão;
- falha de upload;
- 429;
- reset inválido.

Usar alert/status adequados sem revelar informação sensível.

## 112. Falha segura

Quando não é possível determinar permissão, preferir:

```text
não executar a ação
```

em vez de adivinhar permissões pela UI.

No frontend, erro de refresh de sessão não deve promover usuário para papel
privilegiado.

## 113. Falha de backend

Em indisponibilidade do banco:

- autenticação obrigatória não deve "degradar para permitido";
- erro segue para handler;
- UI mostra indisponibilidade.

`optionalAuth` possui semântica pública específica, mas ação privada não deve
usar essa estratégia.

## 114. Autenticação opcional

Use `optionalAuth` somente quando a rota é funcional para visitante e a
identidade, quando válida, apenas enriquece contexto.

Não usar `optionalAuth` em endpoint cuja mutação depende da identidade.

E corrigir a lacuna de revogação descrita no achado da seção 19 antes de ampliar
seu uso.

## 115. Exposição mínima

Resposta de API deve entregar somente campos necessários para a tela.

Exemplo de capability de booking deve retornar dados mínimos da própria reserva,
não todo o perfil do cliente.

Frontend não deve pedir endpoint mais amplo apenas para facilitar implementação.

## 116. Noindex não é segurança

Servidor adiciona `noindex` para várias rotas privadas/sensíveis.

Isso evita indexação desejada.

Não impede acesso direto.

Autenticação continua obrigatória.

## 117. Robots e rotas privadas

Uma rota privada não pode depender de:

- robots.txt;
- meta robots;
- URL obscura.

Esses mecanismos são SEO, não ACL.

## 118. Cache de resposta privada

Dados privados não devem ser colocados em cache público/CDN sem política
explícita.

Autenticação e reset já usam `no-store` em respostas sensíveis específicas.

Se introduzir cache de API, classificar endpoint antes.

## 119. Healthcheck

Health endpoints expõem somente estado operacional mínimo.

Não retornar:

- connection string;
- host de banco;
- senha;
- stack.

Readiness pode dizer que banco não está pronto sem expor credencial.

## 120. Request ID recebido

Cliente pode fornecer `X-Request-ID`, mas servidor valida formato e tamanho.

Request ID é correlação, não identidade.

Não autorizar request pelo ID.

## 121. Headers customizados

Todo header novo usado por frontend cross-origin precisa ser:

- necessário;
- validado;
- considerado no CORS;
- documentado;
- testado no preflight.

O achado de `X-Agenda-Access` mostra por que essas camadas precisam evoluir
juntas.

## 122. Novos uploads

Antes de aceitar novo tipo:

1. justificar necessidade;
2. atualizar MIME;
3. validar assinatura real;
4. definir tamanho;
5. revisar processamento do provider;
6. bloquear conteúdo ativo;
7. testar arquivo falso;
8. testar limite;
9. testar ownership;
10. revisar CSP/serving.

Não liberar SVG apenas por ser "imagem" sem threat model de conteúdo ativo.

## 123. SVG

SVG não está na allowlist atual de upload.

Preservar isso até existir sanitização/política específica.

SVG pode conter conteúdo ativo e referências externas.

## 124. PDF/documentos

Se upload de documentos virar requisito, não reutilizar o middleware de imagem
sem revisão.

Precisará de:

- tipos próprios;
- assinatura;
- malware/processamento quando aplicável;
- serving headers;
- autorização;
- retenção.

## 125. Novo endpoint privado

Checklist:

1. `auth`;
2. contexto server-side;
3. ownership;
4. input normalization;
5. limite;
6. transação quando necessário;
7. erro seguro;
8. rate limit se abusável;
9. teste acesso permitido;
10. teste acesso de outro negócio;
11. teste conta inativa;
12. teste payload manipulado.

## 126. Nova rota Admin

Além de `auth`:

```text
authAdmin
```

ou composição equivalente precisa consultar papel persistido.

Também revisar analytics para não medir operação interna como aquisição.

## 127. Nova capability

Capability deve possuir:

- alta entropia/HMAC apropriado;
- escopo mínimo;
- vínculo ao recurso;
- validade/regra de uso;
- canal seguro;
- não persistência em analytics;
- backend como verificador.

Preferir fragmento a query quando o segredo precisa chegar primeiro ao
frontend, desde que a arquitetura suporte.

## 128. Novo redirect

Nunca fazer:

```js
navigate(searchParams.get("next"))
```

sem validação.

Usar helper equivalente a `safeInternalPath`.

Para external redirect legítimo, validar allowlist/host no domínio correto.

## 129. Novo link externo em nova aba

Usar:

```text
target="_blank"
rel="noreferrer noopener"
```

quando aplicável.

Não confiar apenas no comportamento implícito do navegador.

## 130. Nova variável de ambiente frontend

Pergunta obrigatória:

```text
posso publicar este valor para qualquer visitante?
```

Se a resposta for não:

> não pode ser `VITE_*`.

Criar endpoint backend/config pública que exponha somente a parte segura, se
necessário.

## 131. Novo provider

Para qualquer SDK externo:

- quais scripts precisa?
- quais hosts CSP?
- quais dados saem?
- há consentimento?
- existe segredo?
- pode rodar em Admin?
- pode rodar em reset/capability?
- impacta LCP?
- falha bloqueia produto?

SDK de terceiro não ganha acesso irrestrito à página por conveniência.

## 132. Dependência de browser

Antes de adicionar package de sanitização/auth/storage:

- confirmar problema real;
- avaliar manutenção;
- verificar advisories;
- revisar bundle;
- testar WebKit;
- evitar duplicar primitive existente.

## 133. Testes de segurança frontend

Há cobertura atual para:

- cookie seguro;
- sessão sem JWT em storage;
- compatibilidade legada;
- 401;
- timeout;
- redirect interno;
- CSP;
- upload falso;
- tamanho/tipo;
- auth hardening;
- reset de senha;
- capability pages;
- analytics/PII.

Mudança de segurança deve adicionar teste para a propriedade específica.

## 134. Teste de autorização negativo

Não basta testar que a dona consegue editar.

Também testar:

```text
dona do negócio A
→ tenta ID do negócio B
→ 403/404 seguro
```

Esse tipo de teste pertence principalmente ao backend/integration.

## 135. Teste de sessão revogada

Para `auth`, manter teste de token revogado.

Para `optionalAuth`, adicionar cobertura quando o achado da seção 19 for
corrigido.

Não considerar logout completamente coberto só pelo teste do middleware
obrigatório.

## 136. Teste de CORS

Se arquitetura usar frontend/API cross-origin, adicionar cenário para:

- origem permitida;
- origem negada;
- credentials;
- headers customizados;
- preflight.

Incluir `X-Agenda-Access` se a capability for usada nessa topologia.

## 137. Teste de upload

Cobertura mínima:

- JPG/PNG/WebP válido;
- MIME inválido;
- magic bytes incompatível;
- >5 MB;
- múltiplos arquivos;
- ownership de outro negócio;
- cleanup em falha relevante.

## 138. Teste de URL sensível

Para reset/capability/analytics:

- token não aparece no page view;
- query é limpa quando previsto;
- fragmento não é enviado a provider;
- redirect externo inválido é rejeitado.

## 139. Teste de secrets

CI não deve depender de expor segredo ao frontend.

Se um build começar a exigir segredo `VITE_*`, tratar como finding.

Também revisar diff de bundle/config quando integração nova entra.

## 140. Revisão de segurança por risco

### Baixo

- copy;
- CSS local;
- componente puramente apresentacional.

### Médio

- formulário;
- upload;
- navegação;
- storage;
- link externo;
- novo endpoint consumido.

### Alto

- sessão;
- auth;
- Admin;
- capability;
- booking;
- billing;
- plano;
- privacidade;
- analytics com PII;
- secret/provider.

Risco alto exige revisão backend + testes negativos.

## 141. Checklist antes do merge

Para mudança com superfície de segurança:

1. identificar dado controlado pelo usuário;
2. identificar autoridade backend;
3. revisar autenticação;
4. revisar autorização;
5. revisar ownership;
6. revisar PII;
7. revisar storage;
8. revisar logs;
9. revisar URL/redirect;
10. revisar CORS/CSP se aplicável;
11. revisar rate limit;
12. revisar concorrência/idempotência;
13. adicionar teste negativo;
14. rodar audits quando dependência mudou;
15. revisar diff final.

## 142. Achados desta auditoria

### 142.1 optionalAuth não consulta hash de revogação

O middleware opcional não passa `hashToken(token)` ao repository.

Status: **resolvido na Wave A e mergeado na main**.

A correção alinha a checagem ao middleware obrigatório sem transformar a rota pública em rota obrigatoriamente autenticada.

### 142.2 X-Agenda-Access ausente da allowlist CORS

Status: **implementado na Wave D e em validação**.

`X-Agenda-Access` foi incluído na allowlist e o preflight de origem permitida
possui regressão automatizada.

### 142.3 Cache local contém metadados pessoais

Status: **implementado na Wave D e em validação**.

O frontend deixou de persistir `usuario` e `negocio`; o bootstrap conserva
apenas `session_active`, limpa chaves legadas e reidrata o contexto por
`/minha-sessao`.

### 142.4 Compatibilidade Bearer ainda existe

Cliente e backend continuam aceitando token legado em storage/header.

Status: compatibilidade de migração.

Diretriz: não criar novo emissor de token para localStorage e planejar retirada
quando não houver consumidores legados.

### 142.5 CSRF depende do desenho atual de cookie/topologia

Status: **resolvido na Wave B e mergeado na main**.

O runtime combina `SameSite=Lax`/CORS com `csrfProtection` para métodos
unsafe autenticados por cookie. O middleware valida Fetch Metadata, Origin e
Referer quando disponíveis, sem exigir token dedicado na topologia same-origin
atual.

Diretriz: qualquer mudança de cookie/origem continua reabrindo esse threat model
antes de deploy.

## 143. Prioridade dos achados

Para um patch executável futuro, a ordem técnica recomendada é:

```text
1. concluir validação/merge dos hardenings de storage e CORS da Wave D
2. manter Bearer legado sem novos emissores até existir evidência segura para retirada
3. revisar novamente o threat model se a topologia de origem mudar
```

Essa ordem não autoriza alteração automática nesta branch documental.

## 144. Ownership

| Responsabilidade | Dono principal |
| --- | --- |
| sessão no browser | `auth/session.js` + `SessionContext.jsx` |
| cliente HTTP | `api/client.js` |
| rota protegida UX | `ProtectedRoute.jsx` |
| cookie | `config/sessionCookie.js` |
| auth obrigatório | `middlewares/auth.js` |
| auth opcional | `middlewares/optionalAuth.js` |
| Admin | `middlewares/authAdmin.js` |
| CORS | `config/cors.js` |
| CSP/headers | `config/securityHeaders.js` + `server.js` |
| rate limits | `middlewares/rateLimits.js` |
| upload | `middlewares/upload.js` + `validarImagem.js` |
| secrets/runtime | `config/runtime.js` + env |
| logs HTTP | `requestLogger.js` |
| erro seguro | `errorHandler.js` |
| reset | auth/password reset + `PasswordResetPage.jsx` |
| capability cliente | booking backend + páginas de acesso |
| dependências | lockfiles + CI + `dependency-security.md` |

## 145. Documentos relacionados

- [`session-security.md`](./session-security.md): sessão, logout e reset;
- [`dependency-security.md`](./dependency-security.md): dependências;
- [`encerramento-privacidade.md`](./encerramento-privacidade.md): encerramento;
- [`frontend-arquitetura.md`](./frontend-arquitetura.md): arquitetura;
- [`frontend-formularios-estado-api.md`](./frontend-formularios-estado-api.md):
  requests/forms;
- [`frontend-analytics-observabilidade.md`](./frontend-analytics-observabilidade.md):
  consentimento/telemetria;
- [`frontend-entrega-runtime.md`](./frontend-entrega-runtime.md): cache, entry HTML, recovery, SEO/noindex e entrega;
- [`frontend-qa-prontidao.md`](./frontend-qa-prontidao.md): QA;
- [`checkout-idempotente.md`](./checkout-idempotente.md): billing;
- [`agendamento-integridade.md`](./agendamento-integridade.md): booking;
- [`cancelamento-agendamento-visitante.md`](./cancelamento-agendamento-visitante.md):
  capability;
- [`contexto-negocio.md`](./contexto-negocio.md): isolamento/autorização.


> Findings abertos e prioridade de execução estão consolidados em [`frontend-pendencias-priorizadas.md`](./frontend-pendencias-priorizadas.md).

## 146. Manutenção

Atualizar este documento quando mudar de forma durável:

- cookie;
- JWT;
- storage;
- sessão;
- auth/optionalAuth;
- CORS;
- CSP;
- headers;
- upload;
- capability;
- reset;
- secret handling;
- logging/error;
- política CSRF;
- integração externa com impacto de browser;
- fronteira de autorização.

Mudança puramente visual não exige atualização deste documento.
