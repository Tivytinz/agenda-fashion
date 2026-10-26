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

RN50 acrescenta `temReservasProfissionaisRestritas` como sinal de navegação
para `/reservas-existentes`. Isso não acrescenta vínculos inativos a `vinculos`,
não muda o contexto principal e não concede workspace. A área restrita resolve
cada reserva no backend, sem aceitar negócio-alvo como autorização. A matriz e
os critérios de revogação ficam em [ciclo-atendimento.md](./ciclo-atendimento.md).

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

## Escritas de Meu negócio

A criação usa `Idempotency-Key`, com recibo por conta e hash dos dados
normalizados em `negocio_criacao_tentativas` (migration 123). Negócio, vínculo,
disponibilidade padrão e recibo são confirmados na mesma transação, protegida
pelo lock `FOR NO KEY UPDATE` da conta ativa. Replay recupera o estado atual
do mesmo negócio; não desfaz alterações nem adota outro negócio da conta.
`GET /criar-negocio/tentativa` recebe a chave no header e responde `no-store`.
Ausência não cancela um POST em trânsito. Dados diferentes retornam
`409 NEGOCIO_TENTATIVA_DIVERGENTE`; negócio arquivado/removido retorna
`410 NEGOCIO_TENTATIVA_ENCERRADA`. Clientes sem chave mantêm o contrato legado.

Perfil (`PUT /configuracoes`), publicação (`PATCH /configuracoes/publicacao`) e
foto (`POST /configuracoes/foto`) recebem `X-AF-Negocio` com o ID carregado na
tela. O perfil também aceita `negocio_id` ou `id` explícito no corpo por
compatibilidade. O header tem precedência e permanece apenas um seletor de alvo.
Ausência de alvo retorna `400 NEGOCIO_ALVO_OBRIGATORIO`.

O backend compara esse alvo com o vínculo persistido e revalida conta, negócio
e vínculo de dona ativos na mesma transação da escrita. Depois de arquivar A e
criar B, uma aba antiga de A recebe `409 NEGOCIO_CONTEXTO_ALTERADO`, sem alterar B
ou iniciar seu upload. Se arquivar durante um upload já iniciado, a gravação é
recusada e o asset novo sem uso é limpo. Perfil, foto e publicação não podem
restaurar operação no negócio arquivado.

O frontend preserva o rascunho e protege novas mutações em caso de conflito ou
resposta com outro ID. `Atualizar Meu negócio` executa somente GET e carrega o
contexto atual antes de permitir outra escrita. Falha nessa leitura mantém a
proteção. Encerramento tem contrato próprio em `encerramento-privacidade.md`.

Perfil não regrava os campos de imagem: `foto_url` e `foto_public_id` pertencem
somente ao upload. Se a confirmação da transação de foto falhar, uma leitura
canônica confere se a imagem nova foi gravada. Limpeza só remove assets sem
referência no banco; indisponibilidade dessa conferência preserva a imagem.

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
