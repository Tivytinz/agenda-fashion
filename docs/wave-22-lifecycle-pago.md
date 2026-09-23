# Wave 22 — Lifecycle pago canônico e reativação

> Documento de evidência/workstream do hardening pós-baseline.
>
> A baseline P0 + P1 continua congelada em **67/67 (100%)**.

## Objetivo

Parar de depender de inferências frágeis para explicar o ciclo de vida pago e
registrar, no momento da transição, fatos financeiros de domínio idempotentes.

```text
primeira conversão paga
  → renovação confirmada
  → atraso recuperável
      → recuperação
      ou permanência em atraso
  → reversão financeira
  → mudança de plano
  → cancelamento da renovação
  → encerramento do acesso pago
  → eventual reativação
```

## Fonte canônica

A migration 093 cria `assinatura_eventos`.

A tabela é append-only e contém:

- negócio, assinatura e pagamento relacionados quando aplicável;
- tipo e motivo da transição;
- plano anterior e plano novo quando aplicável;
- origem local da decisão;
- detalhes estruturados mínimos;
- `ocorrido_em`;
- `chave_idempotencia` única.

`webhook_eventos` continua sendo a fila/auditoria do Asaas.
`assinatura_eventos` representa o significado de produto dentro do AF.

## Tipos iniciais

- `CONVERSAO_INICIAL`;
- `RENOVACAO_CONFIRMADA`;
- `PAGAMENTO_ATRASADO`;
- `PAGAMENTO_RECUPERADO`;
- `REVERSAO_FINANCEIRA`;
- `RENOVACAO_CANCELADA`;
- `ACESSO_PAGO_ENCERRADO`;
- `REATIVACAO_PAGA`;
- `PLANO_ALTERADO`.

## Classificação

### Conversão inicial

Primeiro pagamento válido do negócio sem histórico pago anterior.

### Renovação

Pagamento válido posterior da mesma assinatura.

### Mudança de plano

Primeiro pagamento de uma nova assinatura enquanto outra assinatura paga ainda
está vigente. A classificação não presume expansão: pode ser upgrade, downgrade
ou troca lateral.

### Reativação

Primeiro pagamento de uma nova assinatura quando existe histórico pago anterior,
mas não existe outra assinatura paga vigente.

### Atraso e recuperação

Estados recuperáveis como `OVERDUE` geram `PAGAMENTO_ATRASADO`.

Uma confirmação posterior gera `PAGAMENTO_RECUPERADO` quando existe um evento
canônico de atraso do mesmo pagamento. Para a transição entre histórico legado e
a nova tabela, um `PAYMENT_OVERDUE` processado anteriormente também é aceito
como evidência.

### Reversão

Refund, desfazimento de recebimento e chargeback não são atraso. Esses estados
geram `REVERSAO_FINANCEIRA`.

### Cancelamento e encerramento

Cancelar a renovação gera `RENOVACAO_CANCELADA` sem encerrar imediatamente o
acesso já pago.

Quando o acesso pago é efetivamente encerrado, o AF registra
`ACESSO_PAGO_ENCERRADO`. Se existir cancelamento canônico anterior, seu motivo é
preservado na saída.

## Idempotência e transação

As chaves seguem o fato que precisa ser único:

```text
pagamento:<id>:<tipo>
assinatura:<id>:<tipo>
```

O evento participa da mesma transação local da mutação correspondente. Retry de
webhook ou repetição da mesma operação não cria fatos duplicados.

## Histórico anterior

A Wave não faz backfill especulativo.

Dados anteriores à migration 093 continuam disponíveis nas tabelas financeiras e
em `webhook_eventos`, mas só eventos novos ou transições com evidência executada
após a Wave entram na fonte canônica.

## Admin

O Admin de Receita mantém a leitura analítica da Wave 21 e adiciona um bloco
**Lifecycle canônico** com contadores desde a Wave 22:

- conversões iniciais;
- renovações confirmadas;
- reativações pagas;
- mudanças de plano;
- pagamentos atrasados;
- pagamentos recuperados;
- reversões financeiras;
- renovações canceladas;
- saídas da base paga.

Esses contadores não são chamados de churn.

## Churn, LTV e payback

A Wave 22 ainda não cria essas métricas oficialmente.

A fonte canônica reduz a ambiguidade, mas churn exige uma regra explícita para
inadimplência não recuperada, reativação posterior, encerramento do negócio e
janela temporal. LTV e payback exigem coortes maduras e custo confiável.

## Testes

A Wave adiciona ou reforça:

- idempotência da tabela `assinatura_eventos`;
- classificação conversão × renovação × mudança de plano × reativação;
- separação entre atraso e reversão;
- recuperação somente com evidência anterior de atraso;
- cancelamento voluntário na mesma transação local;
- encerramento do acesso pago com motivo preservado;
- integração do lifecycle com o Admin de Receita;
- ausência de rótulo de churn no frontend.

## Critério de encerramento

A Wave 22 pode ser encerrada quando:

1. migration 093 aplicar no banco de teste;
2. Backend CI e Playwright ficarem verdes;
3. retries não duplicarem `assinatura_eventos`;
4. atraso e reversão permanecerem separados;
5. reativação não for classificada como simples mudança de plano;
6. cancelamento de renovação não virar saída imediata da base paga;
7. o Admin ler a fonte canônica sem inventar backfill;
8. documentação canônica refletir a nova regra;
9. o PR for mergeado com autorização explícita.

## Estado atual

A Wave está **em andamento**.
