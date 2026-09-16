# Cancelamento seguro de agendamento visitante

## Objetivo

Permitir que uma cliente que concluiu um agendamento sem conta cancele aquele compromisso na mesma sessão do navegador, sem transformar ID, nome ou WhatsApp em credencial de autorização.

## Regra de segurança

- O backend emite uma capability HMAC-SHA256 somente na resposta de criação de um agendamento visitante.
- A capability é vinculada ao ID do agendamento e usa `JWT_SECRET` com separação de domínio própria.
- ID do agendamento, nome e WhatsApp isoladamente nunca autorizam cancelamento.
- A comparação da capability é feita em tempo constante.
- A rota visitante aceita somente agendamentos com `cliente_id IS NULL`; agendamentos vinculados a contas continuam exigindo autenticação.
- A capability não é gravada no PostgreSQL, não vai para URL e não é persistida em `localStorage`.
- O frontend guarda a capability apenas em `sessionStorage`, junto do último agendamento visitante, e a remove depois do cancelamento.
- O endpoint visitante recebe rate limit público.

## Regras de negócio preservadas

O cancelamento visitante respeita a mesma política já aplicada ao cancelamento autenticado: status do compromisso, horário do negócio e antecedência configurada do profissional. A atualização ocorre em transação, com bloqueio da linha do agendamento antes da validação final e do `UPDATE`.

O cancelamento continua enfileirando a comunicação operacional existente. Nenhuma nova migration é necessária.

## Contrato

Na criação anônima, `POST /agendamentos` inclui `agendamento.acesso_visitante`. Para contas autenticadas esse campo não é emitido.

O cancelamento visitante usa:

`PATCH /agendamentos/:id/cancelar-visitante`

com corpo:

```json
{
  "acesso_visitante": "<capability>"
}
```

A rota autenticada `PATCH /agendamentos/:id/cancelar` permanece inalterada.

## Limitação intencional

A capability acompanha apenas a sessão em que o agendamento visitante foi criado. Ao fechar a sessão/navegador ou usar outro dispositivo, a cliente não recebe recuperação por nome ou WhatsApp, porque isso reduziria a segurança. A recuperação entre dispositivos deve ser tratada futuramente por um mecanismo explícito de verificação de posse, caso o produto decida oferecê-lo.