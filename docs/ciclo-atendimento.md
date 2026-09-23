# Ciclo persistido de atendimento

> **Papel documental:** fonte canônica para estados, transições, cancelamento e regras temporais do lifecycle de agendamentos. Invariantes de concorrência, snapshots e segurança do acesso visitante permanecem nos documentos especializados ligados em `docs/README.md`.

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

O início real do atendimento é registrado por `atendimento_iniciado_em` e
`atendimento_iniciado_por`. A ação `iniciado` não cria um novo valor em
`agendamentos.status`: o booking permanece `agendado` ou `confirmado`
até alcançar um estado terminal.

As transições terminais de comparecimento aceitas pela agenda são:

```text
agendado   -> realizado
agendado   -> falta
confirmado -> realizado
confirmado -> falta
```

Cancelamento e reagendamento permanecem em fluxos próprios. Reagendamento
operacional usa `PATCH /agendamentos/:id/reagendar-operacional` e não é
representado como uma troca de status terminal.

Uma tentativa de trocar um estado terminal por outro retorna conflito em vez de
reescrever o histórico. Repetir a mesma transição terminal é idempotente.

## Cancelamento

Cancelamento permanece separado das transições de comparecimento e possui três contextos distintos.

### Cliente autenticada

`PATCH /agendamentos/:id/cancelar` permite que a cliente autenticada cancele apenas um compromisso pertencente à própria conta.

A regra de antecedência usada é o snapshot persistido em `agendamentos.antecedencia_cancelamento_horas`. Alterar depois a configuração atual da profissional não retroage sobre um booking já criado.

### Visitante

`PATCH /agendamentos/:id/cancelar-visitante` exige a capability emitida na criação do agendamento visitante e aplica a mesma política congelada no booking.

A capability não transforma o visitante em usuário autenticado e não amplia acesso a outros compromissos.

### Operação do negócio

`PATCH /agendamentos/:id/cancelar-operacional` é uma exceção operacional iniciada pelo negócio:

- a dona pode cancelar bookings ativos `agendado` ou `confirmado` do negócio ativo resolvido pelo backend;
- a profissional pode cancelar somente compromissos atribuídos a ela;
- usuário ou vínculo de outro negócio não recebe acesso ao compromisso;
- a antecedência contratual de cancelamento da cliente não bloqueia essa ação operacional do negócio;
- o cancelamento exige um motivo operacional categorizado; o detalhe livre é opcional, exceto em `outro`, e o texto persistido fica limitado a 300 caracteres;
- `cliente_ausente` não substitui no-show: durante a tolerância de 15 minutos a ação é rejeitada e, depois dela, o fluxo orienta registrar `falta`;
- `atendimento_interrompido` permite registrar a exceção operacional quando um booking ativo não puder ser concluído;
- repetir o cancelamento operacional de um compromisso já cancelado é idempotente e não sobrescreve sua auditoria original;
- a notificação de cancelamento pelo WhatsApp é enfileirada na mesma transação da alteração persistida.

O frontend pode ocultar a ação quando ela não se aplica, mas autorização, escopo do negócio e regra temporal continuam backend-authoritative.

Cancelamento não cria um novo horário nem representa reagendamento. O
reagendamento operacional possui endpoint e transação próprios para preservar o
mesmo booking sem misturar os dois fatos de domínio.

## Autorização

A transição é backend-authoritative.

Dentro do contexto de negócio resolvido pelo backend:

- a dona pode iniciar ou registrar falta nos atendimentos do negócio quando a regra temporal permitir;
- `realizado` só pode ser persistido pela profissional responsável pelo booking, inclusive quando a própria dona é a profissional atribuída;
- a profissional pode atualizar apenas atendimentos atribuídos a ela;
- vínculos inativos ou outro negócio não autorizam a operação;
- o agendamento é bloqueado durante a transação para evitar corrida com outra alteração de estado.

A limitação atual de seleção explícita de contexto multi-negócio continua documentada separadamente. Este fluxo não deve ser usado para ampliar acesso entre negócios.

## Regra temporal

O backend usa `negocios.fuso_horario` como autoridade temporal.

- `iniciado` só pode ser registrado a partir do início previsto;
- `falta` só pode ser registrada após 15 minutos de tolerância contados do início previsto;
- `realizado` só pode ser registrado depois do término previsto;
- o término usa `agendamentos.duracao_minutos` como snapshot.

O frontend pode esconder/desabilitar ações antes desse momento, mas a validação real permanece no backend.

## Auditoria

A migration `069_ciclo_atendimento.sql` adiciona:

- `agendamentos.status_atendimento_em`;
- `agendamentos.status_atendimento_por`.

Esses campos registram quando e por quem `realizado` ou `falta` foi persistido.

A migration `071_cancelamento_operacional_auditoria.sql` complementa o histórico de cancelamento com:

- `agendamentos.cancelado_por`;
- `agendamentos.cancelamento_origem`, limitado a `cliente`, `visitante` ou `negocio`;
- `agendamentos.motivo_cancelamento`, opcional e limitado a 300 caracteres.

Cancelamentos históricos anteriores à migration podem permanecer com autoria/origem nulas; a migration não inventa retroativamente quem executou uma ação antiga.

## Avaliação

Avaliação exige `status = 'realizado'`.

A regra existe em duas camadas:

1. service do ciclo de atendimento retorna erro amigável para cliente;
2. trigger no PostgreSQL impede que qualquer caminho de escrita grave avaliação em status diferente de `realizado`.

Portanto, horário passado sozinho não libera avaliação.

Na experiência autenticada de `Minha agenda`, um atendimento `realizado` sem avaliação oferece nota de 1 a 5 estrelas. Depois do primeiro envio, a nota persistida é exibida e a interface deixa de oferecer uma nova avaliação, acompanhando a regra backend-authoritative que impede avaliação duplicada.

## Histórico da cliente

`GET /meus-agendamentos` retorna o status persistido.

A interface separa:

- Agendados: `agendado` e `confirmado`;
- Realizados: `realizado`;
- Não realizados: `falta`;
- Cancelados: `cancelado`.

A falta não é convertida em cancelamento nem em realizado.

## Retorno e recorrência

Atendimentos `realizado` e `falta` podem oferecer o CTA `Agendar novamente` quando o negócio e o serviço ainda podem ser identificados.

O clique nesse CTA registra `reagendamento_iniciado`, com negócio, serviço, agendamento de origem e status de origem. Esse evento mede intenção de retorno e não deve ser contado como novo agendamento, receita ou retenção concluída. A recorrência efetiva continua dependendo de um novo `agendamento_concluido` e, quando aplicável, do lifecycle desse novo compromisso.

A origem de visualização do perfil não deve assumir `inicio` sem evidência. Entradas internas propagam categorias conhecidas (`inicio`, `busca`, `favoritos` e `meus_agendamentos`), enquanto links rastreáveis gerados pelo próprio AF com `af_source=agenda_fashion` e mídia de compartilhamento são classificados como `compartilhamento`. Parâmetros desconhecidos ou navegações sem evidência continuam em `nao_informada`, evitando atribuição artificial no funil.

## Métricas operacionais

Métricas de comparecimento seguem o lifecycle persistido, não o relógio:

- `realizados_hoje` conta somente `status = 'realizado'`;
- `pendentes_hoje` conta `agendado` e `confirmado` que ainda aguardam desfecho operacional;
- `falta` não é promovida a realizado nem permanece como pendência.

A primeira reserva válida usada na ativação continua sendo o primeiro agendamento não cancelado. Ela mede reserva criada e não deve ser reinterpretada como comparecimento ou receita.

Métricas financeiras preexistentes com natureza estimada ou prevista não são convertidas automaticamente em receita realizada por este lifecycle.

## Limites de plano

Uma falta continua contando como agendamento utilizado no mês.

Motivo: a reserva consumiu capacidade operacional do negócio. Marcar no-show não deve liberar artificialmente capacidade do plano depois que o compromisso ocorreu.

Cancelamentos continuam fora do consumo conforme a regra vigente.

## Privacidade multi-negócio

Quando uma profissional também possui compromisso em outro negócio por um contexto atualmente permitido, a agenda pode preservar a ocupação necessária para evitar conflito físico, mas não expõe `agendamento_id`, cliente, serviço nem ações de lifecycle desse outro negócio.

A intenção durável do produto permite que uma profissional possua vínculo com mais de um negócio, mas a modelagem atual ainda possui componentes globais por profissional, como disponibilidade semanal e bloqueios, além de não expor seleção explícita de contexto ativo. A migração que remover a restrição legada de um único vínculo profissional ativo deve ser feita junto do isolamento `negócio + profissional`, para não fazer uma alteração de agenda em um negócio afetar silenciosamente outro.

## Fora deste escopo

Ainda permanecem separados:

- habilitação completa de múltiplos vínculos profissionais ativos, junto do contexto ativo explícito;
- disponibilidade semanal e bloqueios por `negócio + profissional`;
- política de correção/reabertura de estado terminal;
- cadastro manual de agendamento;
- derivação nacional automática do fuso horário;
- métricas financeiras que dependam de uma definição formal de receita realizada.
