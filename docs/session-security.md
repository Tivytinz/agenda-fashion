# Segurança de sessão

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

O middleware de autenticação calcula o mesmo hash e recusa tokens revogados ainda dentro da validade original. Registros expirados podem ser descartados com segurança e o fluxo de revogação remove registros expirados oportunisticamente antes de inserir uma nova revogação.

`POST /logout` preserva o comportamento idempotente: sem token ou com token já inválido/expirado, a saída local continua podendo concluir. Falhas inesperadas de banco/configuração não devem ser mascaradas; o cookie é limpo e o erro segue para o tratamento central.

## Troca de senha

A regra anterior permanece: tokens emitidos antes de `usuarios.senha_alterada_em` são inválidos. A lista de revogação complementa essa regra para logout normal, sem reutilizar o timestamp de troca de senha para outra finalidade.

## Operação

A tabela `sessoes_revogadas` possui unicidade por hash, tornando o registro idempotente para o mesmo JWT. Ela também possui índice de expiração para permitir limpeza eficiente quando necessário.
