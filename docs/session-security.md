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

Existe um hardening pendente no estado executável atual.

O middleware obrigatório `auth` consulta o estado da sessão com o hash do JWT e
consegue detectar `sessoes_revogadas`. Já `optionalAuth` consulta
`buscarEstadoDaSessao(decoded.id)` sem fornecer o hash. No repository, a ausência
do hash faz `token_revogado` resultar em `FALSE`.

Assim, rotas com autenticação opcional não aplicam hoje a mesma checagem explícita
de revogação do middleware obrigatório. Essas rotas continuam públicas quando não
há identidade válida; o ajuste futuro deve preservar essa semântica e apenas
impedir que um JWT revogado seja aceito como identidade opcional.

O patch executável correspondente deve incluir teste de regressão. A análise
detalhada está em [`frontend-seguranca.md`](./frontend-seguranca.md).
