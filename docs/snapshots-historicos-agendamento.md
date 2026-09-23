# Snapshots históricos do agendamento

> **Papel documental:** documento especializado sobre dados congelados no booking. O lifecycle usa esses snapshots, mas estados e transições permanecem canônicos em [`ciclo-atendimento.md`](./ciclo-atendimento.md).

## Objetivo

Um agendamento representa o acordo vigente no momento em que a cliente confirma a reserva. Dados que mudam depois não devem reescrever retroativamente esse compromisso.

A partir da migration `070_agendamento_snapshots_historicos.sql`, cada agendamento preserva:

- `servico_nome`: nome do serviço no momento da criação;
- `antecedencia_cancelamento_horas`: antecedência mínima de cancelamento aplicável à reserva.

Preço (`valor_servico`) e duração (`duracao_minutos`) já possuíam snapshots próprios.

## Criação e compatibilidade de rollout

O banco preenche os novos snapshots no `INSERT` a partir de dados internos e confiáveis:

- o nome vem de `servicos_negocio` pelo `servico_id`;
- a antecedência vem de `agenda_configuracoes` pelo `profissional_id`;
- quando não existe configuração de agenda, a antecedência defensiva permanece em 24 horas, preservando o fallback anterior.

A trigger de preenchimento existe também para que uma instância antiga, ainda atendendo durante a troca de release, não consiga criar um agendamento sem os snapshots novos.

Agendamentos anteriores à migration são preenchidos com o melhor estado disponível no momento da migração. Isso preserva o histórico dali em diante, mas não reconstrói uma regra antiga que já tivesse sido alterada antes da implantação.

## Política mostrada antes da confirmação

A tela final consulta a política pública vigente do profissional antes de liberar `Confirmar agendamento`.

O frontend envia `antecedencia_cancelamento_esperada` apenas como controle de consistência. Esse valor não define a regra e não é confiado pelo backend. Antes de criar a reserva, o backend consulta novamente a política vigente. Se ela mudou desde a exibição, retorna conflito e a interface recarrega a regra para que a cliente a veja antes de tentar novamente.

## Cancelamento

Os fluxos de cliente autenticada e visitante usam a mesma implementação de domínio para validar:

- propriedade/capability adequada ao tipo de cliente;
- status atual do compromisso;
- horário local do negócio;
- antecedência congelada no próprio agendamento.

Alterar `agenda_configuracoes.antecedencia_cancelamento` afeta reservas futuras, mas não muda a possibilidade de cancelamento de bookings já criados.

O cancelamento continua transacional e continua enfileirando a comunicação operacional existente.

## Histórico do serviço

As consultas do lifecycle usam `agendamentos.servico_nome` como fonte primária para compromissos já criados, mantendo o cadastro atual do serviço apenas como fallback de compatibilidade.

Assim, renomear um serviço não altera a descrição de um atendimento antigo.
