# Segurança de sessão

> **Papel documental:** documento especializado de autenticação, sessão, logout e recuperação de senha. Regras transversais de segurança permanecem em `AGENTS.md`.

## Autenticação

O Agenda Fashion usa JWT assinado com HS256 e entrega a sessão principal em cookie `HttpOnly`. O backend continua validando a conta no banco em toda rota autenticada, inclusive estado ativo e invalidação por troca de senha.

## Revogação no logout

A partir da migration 073, um logout com JWT válido também revoga aquele token no backend.

A revogação é por sessão/token, e não por usuário inteiro. Sair de um navegador não encerra automaticamente sessões válidas em outros dispositivos.

O token JWT bruto nunca é persistido. O backend grava somente:

- `usuario_id`;
- SHA-256 do JWT em `token_hash`;
- expiração original do token;
- instante da revogação.

O middleware obrigatório `auth` calcula o mesmo hash e recusa tokens revogados ainda dentro da validade original. Registros expirados podem ser descartados com segurança e o fluxo de revogação remove registros expirados oportunisticamente antes de inserir uma nova revogação.

`POST /logout` preserva o comportamento idempotente: sem token ou com token já inválido/expirado, a saída local continua podendo concluir. Falhas inesperadas de banco/configuração não devem ser mascaradas; o cookie é limpo e o erro segue para o tratamento central.

Na mesma aba, `SessionProvider` usa a fila de `auth/sessionTransitions.js` para
ordenar login, cadastro, Google e logout. Cada ação marca uma intenção; respostas
de autenticações substituídas não gravam metadados nem restauram a conta. Sair
continua imediato na interface, invalida autenticações enfileiradas e aguarda a
escrita em andamento antes de chamar o logout. Assim, o backend recebe e revoga
o cookie retornado por uma autenticação que já havia sido enviada.

As requisições seguintes aguardam conclusão, erro ou abort no cliente; erro não
trava a fila. Abortar não desfaz uma escrita já concluída no servidor. Repetir
Sair reutiliza o logout pendente e invalida intenções de entrada intermediárias.
O formulário de acesso aguarda a sessão inicial; senha e Google compartilham o
bloqueio de envio, e callbacks do SDK desmontado/bloqueado são descartados.
Essa coordenação é local à aba e não modifica o contrato de `/logout`, a
revogação no backend ou a autorização das operações de negócio.

## Recuperação de senha

O fluxo de recuperação usa token aleatório de uso único com validade de 30
minutos. O banco persiste apenas o SHA-256 do token em
`redefinicoes_senha.token_hash`; o valor bruto existe somente no link entregue
pelo canal de verificação.

O link novo usa fragmento de URL:

```text
/redefinir-senha#token=<segredo>
```

Fragmentos não são enviados ao servidor na requisição HTTP, reduzindo exposição
acidental em logs, proxies e cabeçalhos de referência. O frontend captura o
token e remove o fragmento da barra de endereço antes da interação. Links legados
com `?token=` continuam sendo aceitos temporariamente para não quebrar e-mails
já emitidos, mas também são limpos da URL no carregamento.

A redefinição válida é transacional: exige token existente, não usado, não
expirado e conta ativa; atualiza a senha, grava `senha_alterada_em` e invalida
os demais tokens de redefinição pendentes da conta. Como a autenticação rejeita
JWTs emitidos antes de `senha_alterada_em`, sessões anteriores deixam de
autorizar recursos privados após a troca.

A solicitação responde de forma neutra para e-mails existentes e inexistentes,
evitando enumeração de contas.

## Troca de senha

A regra anterior permanece: tokens emitidos antes de `usuarios.senha_alterada_em` são inválidos. A lista de revogação complementa essa regra para logout normal, sem reutilizar o timestamp de troca de senha para outra finalidade.

## Operação

A tabela `sessoes_revogadas` possui unicidade por hash, tornando o registro idempotente para o mesmo JWT. Ela também possui índice de expiração para permitir limpeza eficiente quando necessário.


## Autenticação opcional e revogação

A Wave A corrige o hardening que estava pendente no estado executável anterior.

O middleware obrigatório `auth` já consultava o estado da sessão com o hash do JWT. Na Wave A, `optionalAuth` passou a enviar o mesmo hash ao repository e só vincula `req.user` quando a sessão não está revogada.

A rota continua pública quando não há identidade válida: JWT revogado, expirado ou inválido não transforma autenticação opcional em erro obrigatório. A identidade inválida não é vinculada à requisição.

`auth` e `optionalAuth` não enviam exclusão de cookie ao recusar uma credencial.
Uma consulta pendente pode responder depois de outro login; apagar o cookie
nessa resposta também apagaria a sessão nova. A autenticação obrigatória mantém
o 401 e a opcional mantém o visitante, sem afrouxar validação de conta,
revogação, expiração ou troca de senha. Logout e redefinição de senha continuam
operações explícitas de limpeza de cookie.

No frontend, a geração capturada por `apiRequest` impede que um 401 anterior a
uma transição ou autenticação nova limpe a sessão atual na mesma aba. Essa
geração não é autoridade de autenticação nem sincroniza identidades entre abas.

A Wave A foi validada e mergeada na `main`, incluindo o teste de regressão. A análise detalhada está em [`frontend-seguranca.md`](./frontend-seguranca.md).


## Observabilidade de transporte da sessão

A Wave E adiciona evidência segura para a futura retirada do Bearer legado.

`obterTokenDaRequisicao()` registra apenas qual classe de transporte foi usada:

- cookie HttpOnly;
- Bearer legado.

O diagnóstico é mantido somente em memória no processo atual e exposto em
`GET /admin/saude/operacional` para administradores. Ele contém contagens e
timestamps agregados; não inclui token, header `Authorization`, usuário, rota,
IP ou payload.

Esse dado é deliberadamente diagnóstico:

- reinicia em deploy/restart;
- conta requisições, não pessoas;
- zero Bearer em um processo não prova ausência histórica;
- a compatibilidade só pode ser retirada depois de uma janela operacional
  representativa e revisão dos clientes suportados.

A instrumentação existe para produzir evidência sem reduzir a proteção de
segredos.


## Migração do Bearer legado no navegador

A Wave F retira o Bearer legado do caminho normal do frontend sem remover ainda
a compatibilidade do backend.

Quando o browser encontra a chave histórica `token` no `localStorage`:

1. valida primeiro o cookie atual por `/minha-sessao` e o preserva se válido;
2. quando necessário, chama `POST /auth/migrar-sessao-legada` com o Bearer antigo;
3. o middleware `auth` valida conta, expiração, revogação e troca de senha;
4. o controller preserva cookie válido ou grava o JWT legado validado em cookie
   HttpOnly; conflitos de migração são conferidos pelo cliente;
5. após confirmar cookie ou migração, o frontend remove `localStorage.token`
   e grava apenas `session_active`;
6. `/minha-sessao` e as demais chamadas usam somente cookie.

`apiRequest()` não injeta mais Bearer automaticamente.

Se o Bearer legado estiver inválido ou expirado, a sessão local é limpa e a
pessoa precisa autenticar novamente. Falha transitória de rede não transforma
um token em válido nem copia credencial para outro storage.

O backend continua aceitando Bearer temporariamente para clientes legados que
não passam pelo frontend atual. A retirada server-side continua condicionada à
observabilidade da Wave E por janela representativa.
