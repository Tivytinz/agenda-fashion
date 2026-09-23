# Integridade dos agendamentos

> **Papel documental:** documento especializado de integridade técnica. Estados e transições do lifecycle pertencem a [`ciclo-atendimento.md`](./ciclo-atendimento.md); este arquivo concentra concorrência, intervalos, tempo canônico e isolamento de dados.

Este documento registra invariantes técnicas duráveis do Agenda Fashion para preservar a confiabilidade da agenda.

## Duração histórica

A duração de um agendamento é um snapshot do serviço no momento da criação.

- `agendamentos.duracao_minutos` é a fonte de verdade para a duração de um agendamento já criado.
- Alterações posteriores em `servicos_negocio.duracao_minutos` não podem reduzir, ampliar ou reabrir parcialmente o intervalo de um agendamento existente.
- Consultas de disponibilidade e agenda devem usar a duração armazenada no agendamento, e não a duração atual do serviço associado.
- Registros anteriores à migration que introduziu o snapshot são preenchidos com a melhor informação disponível naquele momento; o sistema não consegue reconstruir uma duração histórica que nunca foi persistida.

## Concorrência entre reserva e bloqueio manual

Toda mutação que possa consumir ou bloquear disponibilidade de uma profissional deve ser serializada pela mesma chave transacional antes de validar conflito e persistir a alteração.

A chave vigente usa `pg_advisory_xact_lock` por profissional, sem incluir a data local:

```text
agenda-profissional + profissional_id
```

A trava global por profissional evita que dois negócios, inclusive em fusos IANA diferentes, validem simultaneamente intervalos que representam o mesmo instante absoluto. Reserva pública, reagendamento e bloqueio manual devem respeitar o mesmo contrato de serialização quando disputarem a agenda da profissional.

A validação de conflito considera o intervalo completo do agendamento, não apenas a igualdade do horário inicial. O intervalo é tratado como semiaberto `[início, fim)`: um agendamento de `14:00` a `15:00` conflita com `14:30`, mas não impede uma nova ocupação que comece exatamente às `15:00`.

## Instante canônico e fuso horário

Cada agendamento possui duas informações temporais com responsabilidades diferentes:

- `agendamentos.inicio_previsto_em` é o instante absoluto canônico, persistido como `TIMESTAMPTZ`;
- `agendamentos.fuso_horario_snapshot` preserva o identificador IANA usado quando o booking foi materializado, por exemplo `America/Sao_Paulo` ou `America/Manaus`.

Comparações de conflito entre negócios usam o instante absoluto. Exibição e geração de slots convertem esse instante para o fuso IANA do negócio consultado, sem reinterpretar o horário histórico quando o cadastro do negócio mudar depois.

Os campos locais `data` e `horario` continuam existindo por compatibilidade de domínio e apresentação, mas não devem substituir `inicio_previsto_em` em comparações globais entre fusos.

## Isolamento multi-tenant e ocupação global

A disponibilidade física de um profissional e os dados privados de um agendamento são responsabilidades distintas.

- conflitos de horário continuam sendo avaliados globalmente por `profissional_id`, independentemente do negócio de origem, para impedir que a mesma pessoa receba dois compromissos simultâneos em contextos diferentes;
- uma agenda privada de negócio pode representar um compromisso de outro contexto apenas como horário ocupado;
- nome e contato do cliente, serviço, valor e demais detalhes privados de um compromisso só podem ser expostos ao negócio autorizado ao qual o agendamento pertence;
- uma correção de privacidade não deve filtrar a ocupação externa de forma que um horário realmente comprometido volte a aparecer como livre.

Bloqueios manuais novos pertencem ao vínculo profissional–negócio por meio de `bloqueios_horarios.negocio_id`. A disponibilidade pública e a agenda privada consideram apenas o bloqueio do negócio atual, além de registros legados com `negocio_id IS NULL`. Esses registros legados permanecem globais por compatibilidade e não podem ser removidos por uma ação contextual de um negócio. A ocupação causada por agendamentos continua global por profissional.

## Testes obrigatórios

Mudanças futuras no fluxo de agenda não devem remover as garantias cobertas por testes de integração com PostgreSQL:

- duração congelada continua válida após edição do serviço;
- bloqueio dentro do intervalo de um agendamento ativo é rejeitado;
- reserva pública e bloqueio manual disputam a mesma advisory lock global por profissional;
- duas reservas simultâneas para o mesmo horário não podem ser confirmadas juntas;
- reservas equivalentes em negócios com fusos IANA diferentes continuam conflitando pelo instante absoluto;
- mudança posterior do fuso do negócio não altera o instante histórico nem o snapshot IANA do booking;
- compromisso de outro negócio mantém o profissional ocupado sem expor os dados privados desse agendamento na agenda de um tenant diferente;
- bloqueio criado no negócio A não reduz a disponibilidade do mesmo profissional no negócio B, enquanto bloqueio legado global continua sendo respeitado.

Essas regras fazem parte do Gate 1 de confiabilidade dos agendamentos e devem permanecer protegidas por migrations, repositories e testes automatizados.
