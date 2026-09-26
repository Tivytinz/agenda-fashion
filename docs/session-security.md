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

A rota continua pública quando não há identidade válida: JWT revogado, expirado ou inválido não transforma autenticação opcional em erro obrigatório. Quando o token revogado veio pelo cookie, o cookie é limpo.

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
