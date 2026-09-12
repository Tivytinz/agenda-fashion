# Integridade dos agendamentos

Este documento registra invariantes técnicas duráveis do Agenda Fashion para preservar a confiabilidade da agenda.

## Duração histórica

A duração de um agendamento é um snapshot do serviço no momento da criação.

- `agendamentos.duracao_minutos` é a fonte de verdade para a duração de um agendamento já criado.
- Alterações posteriores em `servicos_negocio.duracao_minutos` não podem reduzir, ampliar ou reabrir parcialmente o intervalo de um agendamento existente.
- Consultas de disponibilidade e agenda devem usar a duração armazenada no agendamento, e não a duração atual do serviço associado.
- Registros anteriores à migration que introduziu o snapshot são preenchidos com a melhor informação disponível naquele momento; o sistema não consegue reconstruir uma duração histórica que nunca foi persistida.

## Concorrência entre reserva e bloqueio manual

Toda mutação que possa consumir ou bloquear disponibilidade de um profissional no mesmo dia deve ser serializada pela mesma chave transacional.

A chave vigente usa `pg_advisory_xact_lock` por:

```text
(profissional_id, data)
```

Reserva pública e bloqueio manual devem adquirir essa trava dentro da transação antes de validar disponibilidade e persistir a alteração.

A validação de conflito considera o intervalo completo do agendamento, não apenas a igualdade do horário inicial. O intervalo é tratado como semiaberto `[início, fim)`: um agendamento de `14:00` a `15:00` conflita com `14:30`, mas não impede uma nova ocupação que comece exatamente às `15:00`.

## Testes obrigatórios

Mudanças futuras no fluxo de agenda não devem remover as garantias cobertas por testes de integração com PostgreSQL:

- duração congelada continua válida após edição do serviço;
- bloqueio dentro do intervalo de um agendamento ativo é rejeitado;
- reserva pública e bloqueio manual disputam a mesma advisory lock;
- duas reservas simultâneas para o mesmo horário não podem ser confirmadas juntas.

Essas regras fazem parte do Gate 1 de confiabilidade dos agendamentos e devem permanecer protegidas por migrations, repositories e testes automatizados.
