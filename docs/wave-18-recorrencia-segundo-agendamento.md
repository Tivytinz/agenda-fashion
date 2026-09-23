# Wave 18 — Recorrência e segundo agendamento

> Hardening da passagem entre primeiro valor e repetição de valor depois da
> conclusão da Wave 17.
>
> A baseline P0 + P1 continua congelada em **67/67 (100%)**. A Wave 18 não cria
> critérios retroativos; ela protege a recorrência real e sua observabilidade.

## Objetivo

A Wave 18 passa a proteger a jornada:

```text
primeiro agendamento válido
  → cliente consulta histórico
  → cliente escolhe “Agendar novamente”
  → serviço anterior é preservado
  → profissional elegível é resolvida novamente
  → cliente escolhe novo horário
  → novo booking é persistido
  → recorrência observada do negócio
```

A distinção central é:

```text
intenção de repetir
  != criação do novo booking
  != recorrência observada
```

Nenhum clique ou evento de navegador substitui o novo registro real em
`agendamentos`.

## Causa e risco observados

Antes da Wave 18, o runtime já oferecia `Agendar novamente` no histórico da
cliente e o dashboard já calculava recorrência por `client_id`. Porém havia
quatro lacunas de integração:

1. a UI emitia `reagendamento_iniciado`, apesar de a ação criar uma nova
   reserva;
2. esse nome não fazia parte da allowlist do pipeline legado;
3. o Analytics V2 também não distinguia uma repetição iniciada a partir do
   histórico;
4. a recorrência histórica aparecia no mesmo dashboard que indicadores
   filtrados por período, sem explicitar a diferença de janela.

Isso poderia gerar perda silenciosa de telemetria e leitura errada do funil de
retenção.

## Implementação

### Analytics

A ação `Agendar novamente` passa a usar o evento legado já comparável:

```text
agendamento_iniciado
origem = agendar_novamente
```

No Analytics V2, o mesmo comportamento é normalizado para:

```text
booking_started
intent = repeat_booking
entry_point = customer_agenda
source_booking_status = realizado | falta
```

A missão `retornar_ao_negocio` entra na allowlist do pipeline legado. Os dois
pipelines continuam fail-soft e não bloqueiam navegação ou booking.

`booking_rescheduled` permanece reservado à alteração transacional de uma
reserva existente.

### Jornada da cliente

A regressão mobile passa a validar:

1. cliente autenticada acessa `/minha-agenda`;
2. abre histórico de atendimento realizado;
3. seleciona `Agendar novamente`;
4. o link preserva apenas o serviço e a origem do histórico;
5. a profissional anterior não é fixada;
6. a profissional atualmente elegível é resolvida pelo perfil;
7. quando existe uma única profissional elegível, não há escolha inútil;
8. cliente escolhe novo horário;
9. confirmação reutiliza a identidade autenticada;
10. o navegador não envia nome/WhatsApp como autoridade do booking autenticado;
11. novo booking é criado;
12. tela de sucesso é exibida;
13. a jornada permanece sem overflow horizontal na matriz mobile.

### Recorrência no dashboard

`clientes_unicos`, `clientes_recorrentes` e `taxa_recorrencia` continuam
sendo históricos do negócio, calculados a partir de agendamentos não cancelados
e agrupados por `agendamentos.client_id`.

A interface passa a identificar explicitamente esse contexto histórico. O
seletor `Hoje / 7 dias / 30 dias / Este mês` continua valendo para as métricas
que realmente usam o recorte temporal.

A inteligência de crescimento pode continuar avaliando
`RECORRENCIA_BAIXA_COM_AMOSTRA`, desde que trate esse sinal como histórico e
não o apresente como taxa do período selecionado.

## Impactos

### Produto e growth

A Wave melhora a leitura da etapa:

```text
primeiro agendamento
  → tentativa de retorno
  → segundo agendamento real
  → recorrência observada
```

Isso permite medir atrito de repetição sem inflar retenção com cliques.

### Frontend

Mudanças concentradas em observabilidade do histórico da cliente, contexto da
recorrência no dashboard e regressão E2E mobile.

### Backend

O contrato de ingestão de analytics recebe apenas propriedades seguras para
`booking_started`. Não há mudança de regra de booking, autorização, preço,
plano ou pagamento.

### Banco

Nenhuma migration é necessária nesta Wave. A fonte canônica de recorrência
continua sendo `agendamentos.client_id`.

### Segurança e privacidade

A nova telemetria não inclui nome, telefone, WhatsApp, e-mail ou texto livre.
No fluxo autenticado, o backend continua sendo responsável pela identidade da
cliente.

## Testes

A Wave adiciona ou reforça:

- unitário da UI de histórico para o evento correto de repetição;
- contrato do pipeline legado;
- contrato do Analytics V2;
- dashboard pós-ativação com contexto histórico explícito;
- Playwright mobile até o segundo booking e sucesso.

## Critério de encerramento

A Wave 18 pode ser encerrada quando:

1. o Quality Gate estiver verde no head final;
2. a nova jornada E2E passar na matriz mobile suportada;
3. o evento de repetição for aceito nos dois pipelines sem PII;
4. o novo booking não reutilizar a profissional anterior por conveniência;
5. o dashboard não apresentar recorrência histórica como se fosse métrica do
   período;
6. o diff final não introduzir migrations nem mudanças financeiras fora do
   escopo;
7. o PR for mergeado com autorização explícita.

## Estado de encerramento

A Wave 18 foi encerrada no head
`b4920b27b5edf2c094b83e604778e2bee0f4d1ee`, com **Backend CI #1275** e
**Performance QA #30** concluídos com sucesso. O PR #277 foi mergeado na
`main` pelo commit
`ecf5738ab4a8fd9ba3c0bb75a58bf3912b129284`.

A baseline P0 + P1 permaneceu congelada em **67/67 (100%)**.
