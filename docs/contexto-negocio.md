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

Na agenda profissional, compromissos ativos de outro contexto continuam
bloqueando o horário da pessoa para evitar dupla reserva, mas dados de cliente,
serviço, valor e identificadores de agendamento só podem ser revelados quando o
agendamento pertence ao negócio do contexto profissional validado.

## Compatibilidade

Fluxos antigos que dependem de `session.negocio` continuam recebendo o contexto
principal. Novos fluxos multi-contexto devem preferir `vinculos` e selecionar o
papel coerente com a ação em execução.
