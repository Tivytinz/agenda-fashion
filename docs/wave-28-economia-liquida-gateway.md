# Wave 28 — Receita líquida de gateway observada v1

> Documento de evidência/workstream do hardening pós-baseline.
>
> A baseline funcional P0 + P1 permanece congelada em **67/67 (100%)**.

## Objetivo

Transformar cobrança bruta em economia observável do gateway sem chamar receita
líquida de gateway de lucro ou margem de contribuição.

A Wave preserva separadamente:

```text
valor bruto da cobrança
netValue observado no Asaas
estornos concluídos
taxa implícita do gateway
receita líquida de gateway
```

## Cutover

A migration 099 cria o marco `economia_liquida_v1_inicio`.

Não há backfill inferido. Cobranças anteriores ao cutover não são tratadas como
economicamente completas apenas porque possuem valor bruto no banco.

## Fonte externa

O Asaas é a fonte do `netValue`, `creditDate` e estado atual da cobrança.
Estornos são reconciliados a partir da lista de refunds da própria cobrança.

O AF continua usando whitelist de campos no webhook. Payload bruto do provedor
não é persistido.

## Billing versus economics

Billing permanece autoridade para entitlement.

A reconciliação econômica roda fora da transação crítica do pagamento:

```text
webhook financeiro
  → aplica estado de billing
  → commit
  → worker econômico consulta estado atual do provedor
  → pagamento_economia / pagamento_estornos
```

Falha da camada econômica não pode reverter assinatura ou plano.

## Fencing

O worker captura `asaas_ultimo_evento_em` e `asaas_ultimo_evento_id` antes da
consulta externa. Antes de persistir a resposta, bloqueia a cobrança local e
revalida o fence.

Se um webhook mais novo chegou durante a chamada HTTP, a resposta antiga é
descartada e o pagamento volta a ser reconciliado.

## Estornos

`pagamento_estornos` é append/update idempotente por chave estável derivada do
refund retornado pelo provedor.

Somente refund com status `DONE` reduz a receita líquida observada.

`PENDING` mantém a cobrança em `REFUND_EM_PROCESSAMENTO`. `CANCELLED` não
reduz receita.

Chargeback em disputa continua exposição econômica e não é transformado em
refund concluído por inferência.

## Receita líquida de gateway

Para uma cobrança economicamente completa:

```text
receita líquida gateway
=
netValue observado
-
SUM(refunds DONE)
```

O valor pode ficar negativo quando um refund devolve o principal, mas a taxa da
cobrança não foi recuperada.

## Cobertura

Estados canônicos:

- `COMPLETO`;
- `AGUARDANDO_LIQUIDACAO`;
- `REFUND_EM_PROCESSAMENTO`;
- `CHARGEBACK_EM_DISPUTA`;
- `REVERSAO_NAO_RECONCILIADA`;
- `DADOS_GATEWAY_INCOMPLETOS`.

Ausência de `netValue` nunca é convertida em taxa zero.

## LTV líquido de gateway

A Wave 28 reutiliza exatamente as coortes e maturidades D30/D60/D90 da Wave 26.

Uma janela com pagamento economicamente incompleto fica indisponível. O AF não
remove negócios incompletos do denominador para fabricar uma média melhor.

## Retorno líquido de aquisição

A Wave 28 reutiliza aquisição, maturidade e custo de mídia da Wave 27 e acrescenta
retorno líquido de gateway D30/D60/D90.

```text
retorno líquido gateway
=
receita líquida gateway da coorte
/
investimento de mídia da mesma coorte
```

Isso ainda não é payback econômico, porque impostos, infraestrutura, suporte,
pessoal e demais custos de contribuição não estão modelados.

## Fora do escopo

- margem de contribuição;
- lucro;
- CAC total da empresa;
- payback econômico definitivo;
- LTV:CAC econômico definitivo;
- rateio de infraestrutura ou pessoal;
- decisão automática de orçamento.

## Critérios de encerramento

1. migration 099 aplicar no banco de teste;
2. `netValue` ausente não virar taxa zero;
3. `creditDate` não ser confundido com `paymentDate`;
4. refund `DONE` reduzir receita pelo valor exato;
5. refund `PENDING` não reduzir receita;
6. múltiplos refunds parciais acumularem sem duplicação;
7. replay do mesmo refund ser idempotente;
8. chargeback em disputa não virar refund concluído;
9. worker não participar da transação crítica do billing;
10. fence impedir persistência de resposta externa obsoleta;
11. LTV líquido reutilizar a coorte/maturidade da Wave 26;
12. retorno líquido reutilizar aquisição/custo da Wave 27;
13. janela incompleta ficar indisponível, não parcialmente calculada;
14. Admin distinguir bruto, líquido de gateway e margem;
15. Wave 27 ser encerrada documentalmente;
16. Backend CI e Playwright ficarem verdes;
17. diff final ser revisado antes de qualquer merge.

## Encerramento

A Wave 28 foi concluída no head
`7dfac372742886d5b09a2e5105c3bbe6b08ca18b`, validado pelo
**Backend CI #1346** com Quality Gate verde. O pipeline aplicou as migrations de
teste, executou Jest + PostgreSQL com coverage, lint/build/test do React, audits
de dependências e Playwright mobile com sucesso.

O PR #287 foi mergeado por squash na `main` pelo commit
`d5142b210f8b68253a19ee8255402c0a4e53dd88` em 23/09/2026.

As evidências do estado executável validado antes do merge satisfazem os
critérios de encerramento desta Wave. A baseline funcional permanece em
**67/67 (100%)**.

Este documento passa a permanecer como evidência histórica da Wave 28. As
decisões duráveis continuam em `AGENTS.md`, `docs/planos.md` e nos documentos
canônicos relacionados.
