# Wave 26 — Coortes de receita e LTV bruto observável v1

> Documento de evidência/workstream do hardening pós-baseline.
>
> A baseline funcional P0 + P1 permanece congelada em **67/67 (100%)**.

## Objetivo

Medir receita acumulada observada por negócio desde a primeira conversão paga,
sem projetar lifetime futuro e sem tratar MRR como caixa recebido.

A unidade financeira permanece o **negócio**.

```text
negócio != assinatura técnica
MRR != receita recebida
churn != remoção do denominador histórico
reativação != nova aquisição
```

## Cutover

A migration 097 cria o marco `ltv_v1_inicio`.

Somente uma `CONVERSAO_INICIAL` canônica cujo próprio primeiro pagamento
ocorre no ou depois do cutover entra na coorte oficial de LTV v1.

Negócios já pagos antes do cutover não recebem um lifetime artificial a partir
da Wave 26. O histórico anterior continua `nao_inferido`.

## Fonte monetária

O LTV bruto observado usa `pagamentos.valor` com
`data_pagamento IS NOT NULL`, agrupado por todas as assinaturas do mesmo
negócio.

Isso é deliberadamente diferente do ledger de MRR:

```text
MRR = valor recorrente contratado
LTV bruto observado = caixa bruto historicamente observado
```

A situação atual de estorno, refund ou disputa é exibida separadamente como
**valor exposto a reversões**. O AF não calcula LTV líquido enquanto não existir
persistência confiável do valor econômico exato de reversões parciais.

## Janelas e maturidade

A Wave 26 publica três janelas:

- D30;
- D60;
- D90.

Para Dn, um negócio só entra no denominador quando sua primeira conversão paga
já completou pelo menos n dias.

```text
imaturo => métrica indisponível / aguardando maturidade
maduro sem renovação => receita observada legítima, possivelmente só o primeiro pagamento
```

Não usar zero para representar falta de maturidade.

## Denominador

Churn não remove o negócio da coorte.

Reativação posterior continua no mesmo lifetime do negócio e a receita observada
depois da reativação entra normalmente na janela correspondente.

Isso evita survivorship bias.

## Coortes mensais

A UI agrupa negócios pelo mês de sua primeira conversão paga canônica e mostra:

- negócios da coorte;
- negócios maduros D30/D60/D90;
- LTV bruto observado D30/D60/D90.

O resumo geral é ponderado pelo número de negócios maduros, não pela média
simples das médias mensais.

## Segmentação

A Wave 26 não atribui LTV por campanha nem por plano atual.

O evento `CONVERSAO_INICIAL` já preserva o plano de entrada, mas Wave 27 deve
tratar a ligação entre aquisição, investimento e retorno usando snapshot
financeiro próprio antes de calcular CAC payback.

## Fora do escopo

A Wave 26 não cria:

- LTV projetado por fórmula;
- LTV líquido;
- LTV de margem;
- CAC payback;
- LTV:CAC;
- decisão automática de mídia;
- machine learning de churn.

## Critérios de encerramento

1. migration 097 aplicar no banco de teste;
2. cutover de LTV não inventar histórico anterior;
3. unidade do lifetime ser o negócio;
4. troca de plano não criar nova coorte;
5. nova assinatura técnica não criar novo cliente;
6. reativação continuar no mesmo lifetime;
7. churn permanecer no denominador;
8. D30 imaturo retornar indisponível, não zero;
9. D30/D60/D90 usar apenas bases maduras equivalentes;
10. LTV usar pagamentos observados, não MRR;
11. reversão permanecer exposição separada;
12. partial refund não gerar LTV líquido inventado;
13. coortes mensais manterem maturidade explícita;
14. Admin diferenciar LTV bruto, MRR e caixa do período;
15. Wave 25 ser encerrada documentalmente;
16. Backend CI e Playwright ficarem verdes;
17. diff final ser revisado antes de qualquer merge.

## Estado atual

A Wave 26 está **em andamento**.
