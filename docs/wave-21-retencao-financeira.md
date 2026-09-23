# Wave 21 — Retenção financeira e receita recorrente

> Documento de evidência/workstream do hardening pós-baseline.
>
> A baseline P0 + P1 continua congelada em **67/67 (100%)**. Esta Wave não cria
> novos critérios retroativos; ela melhora a leitura financeira do SaaS depois
> da primeira conversão paga.

## Objetivo

Transformar o ciclo financeiro já protegido pelas Waves 19 e 20 em uma leitura
administrativa que não confunda aquisição, renovação, mudança de plano, atraso e
encerramento.

```text
primeira conversão paga
  → renovação da mesma assinatura
  → atraso observado
      → recuperação
      ou permanência em atraso
  → mudança de plano
  → cancelamento da próxima renovação
  → encerramento efetivo após o período pago
```

A Wave evita tratar como equivalentes:

```text
receita total != receita de renovação
nova assinatura técnica != novo negócio pagante
mudança de plano != renovação
mudança de plano != expansão obrigatoriamente
atraso != churn
cancelamento agendado != perda imediata de acesso
recuperação != nova conversão
```

## Causa observada

Antes da Wave 21, o Admin V2 já expunha receita do período, primeiro pagamento,
assinaturas ativas, reversões e conversão de checkout. A base de recorrência
profissional também preservava o primeiro pagamento da aquisição.

O gap era pós-conversão: pagamentos posteriores não possuíam uma classificação
administrativa que separasse renovação da mesma assinatura do primeiro pagamento
de outra assinatura do mesmo negócio.

Isso impedia responder com segurança perguntas como:

- quanto da receita válida veio de renovação;
- quantas cobranças recorrentes já venceram;
- quantas foram confirmadas;
- quantas tiveram atraso observado;
- quantas se recuperaram;
- quantos cancelamentos ainda mantêm acesso pago;
- quantas assinaturas realmente encerraram depois de um cancelamento voluntário.

## Classificação financeira

A classificação usa o histórico persistido, sem migration nova.

### Conversão inicial

O primeiro pagamento cronológico do negócio em um plano pago é a conversão
inicial.

### Renovação

Um pagamento válido posterior da **mesma assinatura** é receita de renovação.

### Mudança de plano

O primeiro pagamento de uma assinatura paga posterior do mesmo negócio é
classificado como mudança de plano.

O AF não chama esse evento automaticamente de expansão, porque ele pode
representar upgrade, downgrade ou troca lateral.

## Coorte de renovação

A coorte de renovação considera cobranças posteriores à primeira cobrança da
mesma assinatura que possuem vencimento já ocorrido.

A leitura administrativa expõe:

- renovações previstas/vencidas na coorte;
- renovações atualmente confirmadas;
- taxa observada de renovação;
- renovações com atraso observado;
- renovações recuperadas;
- taxa observada de recuperação.

A taxa pode amadurecer depois do fim do período porque uma cobrança vencida pode
ser regularizada posteriormente.

## Atraso e recuperação

Uma cobrança tem atraso observado quando:

1. seu estado atual representa atraso/falha recuperável; ou
2. existe um webhook `PAYMENT_OVERDUE` do Asaas processado para a mesma
   cobrança.

Uma renovação é recuperada somente quando possui evidência processada de atraso
e seu pagamento está atualmente em estado financeiro válido.

Eventos `IGNORED` não promovem uma cobrança a recuperação.

## Cancelamento

A Wave mantém separados:

- **cancelamento de renovação agendado**: assinatura paga ainda ativa, com acesso
  válido até o fim do período já pago;
- **encerramento após cancelamento**: assinatura já inativa e marcada pela
  operação voluntária do titular.

Falha de pagamento recuperável não entra automaticamente como encerramento.

## Churn, LTV e payback

A Wave 21 **não cria um churn oficial**.

O AF ainda precisa de uma definição terminal que trate de forma explícita:

- cancelamento voluntário;
- inadimplência que nunca foi recuperada;
- mudança de plano;
- encerramento/arquivamento do negócio;
- reativação posterior.

Pelo mesmo motivo, LTV e payback continuam fora do escopo oficial desta Wave.

## Admin

A página administrativa de Receita passa a separar:

```text
Receita inicial
Receita de renovação
Mudança de plano
Receita atualmente válida
Valor exposto a reversões
```

e adiciona um bloco de **Retenção financeira** com os fatos observados da coorte
de renovação.

## Banco e performance

Nenhuma migration é necessária.

A classificação reutiliza:

- `pagamentos`;
- `assinaturas`;
- `planos`;
- `webhook_eventos`.

O histórico de webhook é usado apenas para evidência de atraso processado; o
payload redigido não é necessário para essa leitura.

O recorte deve permanecer administrativo e não pode bloquear booking, checkout
ou processamento de webhook.

## Testes

O primeiro recorte adiciona ou reforça:

- serviço administrativo mapeando as novas métricas;
- integração PostgreSQL classificando conversão inicial, renovação e mudança de
  plano;
- integração de atraso observado e recuperação;
- invariante de que a receita válida adicionada pela fixture se decompõe em
  conversão inicial + renovação + mudança de plano;
- frontend administrativo exibindo taxas e valores sem rotular a leitura como
  churn.

## Critério de encerramento

A Wave 21 pode ser encerrada quando:

1. o Quality Gate estiver verde no head final;
2. a classificação integrada não misturar mudança de plano com renovação;
3. atraso e recuperação dependerem de evidência financeira persistida;
4. cancelamento agendado permanecer separado de encerramento;
5. a soma das categorias financeiras classificadas reconciliar a receita válida
   da fixture de regressão;
6. nenhum cálculo chamar atraso ou cancelamento agendado de churn;
7. não houver migration desnecessária;
8. documentação canônica e evidência da Wave 20 estiverem reconciliadas;
9. o PR for mergeado somente com autorização explícita.

## Estado de encerramento

A Wave 21 foi encerrada no head
`8754b2960634f89e3f092dbb34c694d3a62459ee`, com o **Backend CI #1285**
concluído com sucesso.

O PR #280 foi mergeado na `main` pelo commit
`3d95d04a898dd242b0eaa5babd896d5628e2ac6e`.

A baseline P0 + P1 permaneceu congelada em **67/67 (100%)**.
