# Contexto de negócio

## Regra de domínio

A identidade da pessoa continua em `usuarios`. O papel exercido dentro de um
negócio pertence a `usuarios_negocios.papel`.

No modelo atual, a mesma conta pode simultaneamente:

- possuir um vínculo ativo `dono` com o próprio negócio; e
- possuir um vínculo ativo `profissional` com outro negócio.

A constraint `usuarios_negocios_profissional_ativo_unique` mantém no máximo um
vínculo ativo com papel `profissional` por conta. Alterar essa regra exige uma
decisão explícita de produto e uma revisão da agenda, disponibilidade,
autorização e UX de seleção de negócio.

## Seleção de contexto

`GET /minha-sessao` devolve:

- `negocio`: contexto principal, preservado para compatibilidade;
- `vinculos`: todos os vínculos ativos autorizados da conta.

O contexto principal não substitui o contexto explicitamente indicado pela
rota. No frontend:

- `/painel/*` seleciona o vínculo `dono`;
- `/profissional/*` seleciona o vínculo `profissional`.

Se o vínculo exigido pela rota não existir, a aplicação não deve cair
silenciosamente em outro papel.

## Autorização no backend

A seleção do frontend é apenas intenção de navegação. O backend continua sendo a
fonte de verdade.

Casos de uso profissionais precisam validar no banco que a conta autenticada
possui vínculo ativo `profissional` antes de liberar dados do negócio. O
`negocio_id` derivado desse vínculo validado pode então ser propagado para os
services/repositories.

Na configuração de horários, o frontend informa apenas o contexto de papel
esperado (`dono` ou `profissional`). O backend resolve o `negocio_id` a partir do
vínculo ativo persistido e não confia em um identificador de negócio enviado
pelo navegador para selecionar a agenda.

Na agenda profissional, compromissos ativos de outro contexto continuam
bloqueando o horário da pessoa para evitar dupla reserva, mas dados de cliente,
serviço, valor e identificadores de agendamento só podem ser revelados quando o
agendamento pertence ao negócio do contexto profissional validado.

## Disponibilidade recorrente e ocupação

A disponibilidade recorrente pertence ao contexto **pessoa profissional +
negócio**. Portanto, `agenda_configuracoes` é identificada por
`(profissional_id, negocio_id)` e `agenda_horarios` por
`(profissional_id, negocio_id, dia_semana)`.

Isso permite que a mesma conta mantenha horários diferentes no próprio negócio e
no negócio em que atua como profissional, sem um contexto sobrescrever o outro.

A ocupação real da pessoa permanece global. Agendamentos e bloqueios ativos de
qualquer negócio continuam retirando o mesmo intervalo da disponibilidade nos
demais contextos. Essa separação é intencional: configuração recorrente é local
ao negócio; conflito de horário é global à pessoa.

Ao criar, reativar ou aceitar um vínculo ativo com papel `dono` ou
`profissional`, o banco inicializa de forma idempotente a disponibilidade padrão
do AF para aquele contexto. A migração do modelo antigo preserva a agenda já
existente no contexto que o runtime legado selecionava e cria padrões para os
contextos adicionais. Se algum dado legado não puder ser contextualizado com
segurança, a migration deve falhar e preservar os dados para investigação, em
vez de apagá-los silenciosamente.

Na agenda pública, o negócio é obtido do slug e validado junto com serviço e
profissional. A disponibilidade recorrente é consultada nesse negócio, enquanto
os compromissos globais da pessoa continuam sendo considerados para impedir
dupla reserva entre negócios.

## Compatibilidade

Fluxos antigos que dependem de `session.negocio` continuam recebendo o contexto
principal. Novos fluxos multi-contexto devem preferir `vinculos` e selecionar o
papel coerente com a ação em execução.
