# Cancelamento seguro de agendamento visitante

> **Papel documental:** documento especializado de autorização por capability para booking visitante. A regra de cancelamento pertence ao lifecycle em [`ciclo-atendimento.md`](./ciclo-atendimento.md), e a antecedência aplicável pertence ao snapshot descrito em [`snapshots-historicos-agendamento.md`](./snapshots-historicos-agendamento.md).

## Objetivo

Permitir que uma cliente que concluiu um agendamento sem conta consulte e cancele aquele compromisso por um link seguro específico da reserva, sem transformar ID, nome ou WhatsApp em credencial de autorização.

## Regra de segurança

- O backend emite uma capability HMAC-SHA256 somente na resposta de criação de um agendamento visitante.
- A capability é vinculada ao ID do agendamento e usa `JWT_SECRET` com separação de domínio própria.
- ID do agendamento, nome e WhatsApp isoladamente nunca autorizam cancelamento.
- A comparação da capability é feita em tempo constante.
- A rota visitante aceita somente agendamentos com `cliente_id IS NULL`; agendamentos vinculados a contas continuam exigindo autenticação.
- A capability não é gravada no PostgreSQL e não é persistida em `localStorage`.
- O link usa `#token=` no fragmento da URL. Fragmentos não são enviados automaticamente em requests HTTP, logs de proxy ou query string; a SPA lê a capability e a envia explicitamente no header/corpo.
- O frontend continua guardando o último booking em `sessionStorage` para conveniência na mesma sessão, mas o link seguro pode ser salvo e aberto em outro dispositivo.
- Consulta e cancelamento visitantes recebem rate limit público.

## Regras de negócio preservadas

O cancelamento visitante respeita a mesma política de domínio do cancelamento autenticado: status do compromisso, instante previsto e antecedência congelada em `agendamentos.antecedencia_cancelamento_horas`. Alterar depois a configuração atual da profissional não retroage sobre o booking já criado. A atualização ocorre em transação, com bloqueio da linha do agendamento antes da validação final e do `UPDATE`.

O cancelamento continua enfileirando a comunicação operacional existente. A capability não exige persistência própria no PostgreSQL.

## Contrato

Na criação anônima, `POST /agendamentos` inclui `agendamento.acesso_visitante` e `agendamento.link_cancelamento_visitante`. Para contas autenticadas esses campos não são emitidos.

A consulta do link usa:

`GET /agendamentos/:id/acesso-visitante`

com a capability no header `X-Agenda-Access`.

O cancelamento visitante usa:

`PATCH /agendamentos/:id/cancelar-visitante`

com corpo:

```json
{
  "acesso_visitante": "<capability>"
}
```

A rota autenticada `PATCH /agendamentos/:id/cancelar` permanece inalterada.

## Recuperação e posse

O AF não recupera uma reserva visitante por nome, telefone ou ID público. A posse é demonstrada pela capability do link. Se a cliente perder o link e encerrar a sessão local, não existe recuperação automática por dados pessoais; qualquer mecanismo futuro de recuperação deve verificar posse por canal apropriado sem enfraquecer a autorização do booking.