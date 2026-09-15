# Ciclo persistido de atendimento

## Objetivo

O horário ter passado não prova que um atendimento aconteceu.

O Agenda Fashion deve separar:

- compromisso criado;
- compromisso confirmado;
- cancelamento;
- atendimento efetivamente realizado;
- falta/no-show.

Essa separação protege agenda, avaliação, métricas de comparecimento, retenção e receita contra inferências temporais incorretas.

## Estados

O campo `agendamentos.status` possui os seguintes estados operacionais:

- `agendado`: reserva ativa criada;
- `confirmado`: reserva ativa confirmada;
- `cancelado`: reserva cancelada;
- `realizado`: atendimento explicitamente concluído;
- `falta`: cliente não compareceu / atendimento não ocorreu por falta.

`realizado` e `falta` são estados terminais no fluxo operacional atual.

## Transições permitidas

A atualização operacional exposta pela agenda aceita somente:

```text
agendado   -> realizado
agendado   -> falta
confirmado -> realizado
confirmado -> falta
```

Cancelamento continua em fluxo próprio.

Uma tentativa de trocar um estado terminal por outro retorna conflito em vez de reescrever o histórico.

Repetir a mesma transição terminal é idempotente.

## Autorização

A transição é backend-authoritative.

Dentro do contexto de negócio resolvido pelo backend:

- a dona pode atualizar atendimentos do negócio;
- a profissional pode atualizar apenas atendimentos atribuídos a ela;
- vínculos inativos ou outro negócio não autorizam a operação;
- o agendamento é bloqueado durante a transação para evitar corrida com outra alteração de estado.

A limitação atual de seleção explícita de contexto multi-negócio continua documentada separadamente. Este fluxo não deve ser usado para ampliar acesso entre negócios.

## Regra temporal

O backend usa `negocios.fuso_horario` como autoridade temporal.

- `falta` só pode ser registrada depois do início marcado;
- `realizado` só pode ser registrado depois do término previsto;
- o término usa `agendamentos.duracao_minutos` como snapshot e recorre à duração atual do serviço apenas para dados legados sem snapshot.

O frontend pode esconder/desabilitar ações antes desse momento, mas a validação real permanece no backend.

## Auditoria

A migration `069_ciclo_atendimento.sql` adiciona:

- `agendamentos.status_atendimento_em`;
- `agendamentos.status_atendimento_por`.

Esses campos registram quando e por quem `realizado` ou `falta` foi persistido.

## Avaliação

Avaliação exige `status = 'realizado'`.

A regra existe em duas camadas:

1. service do ciclo de atendimento retorna erro amigável para cliente;
2. trigger no PostgreSQL impede que qualquer caminho de escrita grave avaliação em status diferente de `realizado`.

Portanto, horário passado sozinho não libera avaliação.

## Histórico da cliente

`GET /meus-agendamentos` retorna o status persistido.

A interface separa:

- Agendados: `agendado` e `confirmado`;
- Realizados: `realizado`;
- Não realizados: `falta`;
- Cancelados: `cancelado`.

A falta não é convertida em cancelamento nem em realizado.

## Limites de plano

Uma falta continua contando como agendamento utilizado no mês.

Motivo: a reserva consumiu capacidade operacional do negócio. Marcar no-show não deve liberar artificialmente capacidade do plano depois que o compromisso ocorreu.

Cancelamentos continuam fora do consumo conforme a regra vigente.

## Privacidade multi-negócio

Quando uma profissional também possui compromisso em outro negócio, a agenda pode preservar a ocupação necessária para evitar conflito físico, mas não expõe `agendamento_id`, cliente, serviço nem ações de lifecycle desse outro negócio.

## Fora deste escopo

Ainda permanecem separados:

- contexto ativo explícito para contas ligadas a múltiplos negócios;
- disponibilidade semanal por `negócio + profissional`;
- política de correção/reabertura de estado terminal;
- cadastro manual de agendamento;
- derivação nacional automática do fuso horário;
- métricas financeiras que dependam de uma definição formal de receita realizada.
