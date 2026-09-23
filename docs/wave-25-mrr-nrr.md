# Wave 25 — MRR canônico, expansion/contraction e NRR v1

> Documento de evidência/workstream do hardening pós-baseline.
>
> A baseline funcional P0 + P1 permanece congelada em **67/67 (100%)**.

## Objetivo

Transformar os episódios pagos da Wave 24 em um ledger monetário reconstruível
por negócio, sem recalcular fatos históricos a partir do preço atual do catálogo.

A unidade financeira permanece o **negócio**.

```text
receita recebida != MRR
plano atual != valor histórico contratado
nova aquisição != expansion
atraso recuperável != churned MRR
```

## Cutover monetário

A migration 096 cria o marco `mrr_v1_inicio` e registra a base mensal presente
naquele instante como `MRR_BASELINE`.

A origem do valor é `assinaturas.valor`, não `planos.valor`.

O AF não tenta inferir MRR anterior ao cutover.

## Periodicidade

A Wave 25 suporta MRR canônico apenas para recorrências `MONTHLY`.

Registros legados sem periodicidade explícita são tratados como mensais por
compatibilidade com o contrato atual do AF. Uma periodicidade futura diferente
não é normalizada silenciosamente e fica fora da leitura canônica até existir
uma regra comercial própria.

## Ledger monetário

Eventos financeiros novos podem carregar:

```text
valor_mensal_anterior
valor_mensal_novo
periodicidade_snapshot
```

As principais fronteiras são:

| Fato | Antes | Depois | Leitura |
| --- | ---: | ---: | --- |
| `CONVERSAO_INICIAL` | 0 | valor contratado | New MRR |
| `RENOVACAO_CONFIRMADA` | igual | igual | sem delta |
| `PLANO_ALTERADO` | valor anterior | valor novo | expansion / contraction / lateral |
| `VALOR_RECORRENTE_ALTERADO` | valor anterior | valor novo | expansion / contraction |
| `PAGAMENTO_ATRASADO` | igual | igual | MRR em risco |
| `PAGAMENTO_RECUPERADO` | igual | igual | risco encerrado |
| `ACESSO_PAGO_ENCERRADO` | valor anterior | 0 | Churned MRR |
| `REATIVACAO_PAGA` | 0 | valor contratado | Reactivation MRR |

A classificação de expansion e contraction é monetária:

```text
delta > 0  → expansion
delta < 0  → contraction
delta = 0  → lateral
```

Nome ou ordem comercial do plano não substitui o delta financeiro.

## MRR em risco

Atraso recuperável e reversão/disputa não removem MRR do ledger enquanto o
episódio pago ainda não terminou.

O Admin pode mostrar esse valor separadamente como **MRR em risco**. Quando a
saída terminal é materializada, o valor deixa o MRR e passa a
`Churned MRR`.

## NRR v1

O denominador usa somente negócios com MRR na base inicial do recorte.

```text
NRR =
MRR final dos negócios da base inicial
--------------------------------------
MRR desses negócios no início
```

New MRR não entra no denominador nem no numerador da coorte inicial.

Reativação de um negócio que já pertencia à base inicial pode voltar a compor o
MRR final dessa coorte, mas o churn e a reativação continuam expostos como fatos
separados.

## GRR v1

GRR ignora expansion e não deixa uma reativação apagar uma saída terminal
observada no período.

Por negócio da base inicial:

- se houve saída terminal, retenção bruta daquele negócio é zero;
- sem saída terminal, conta no máximo o MRR que possuía no início.

## Reconciliação do bridge

A leitura total deve fechar:

```text
MRR inicial
+ New MRR
+ Reactivation MRR
+ Expansion MRR
- Contraction MRR
- Churned MRR
= MRR final
```

Qualquer divergência é diagnóstico de integridade e não deve ser escondida.

## Fora do escopo

A Wave 25 não cria:

- LTV;
- CAC payback;
- annualização de planos que não existem no catálogo;
- receita líquida contábil;
- decisão automática de mídia.

## Critérios de encerramento

1. migration 096 aplicar no banco de teste;
2. baseline monetária usar `assinaturas.valor`;
3. alteração futura de `planos.valor` não reescrever o histórico;
4. mudança paga maior gerar expansion;
5. mudança paga menor gerar contraction;
6. mudança lateral gerar delta zero;
7. alteração de valor na mesma assinatura gerar fato próprio;
8. renovação normal não gerar expansion;
9. atraso recuperável permanecer como MRR em risco;
10. saída terminal gerar `valor_mensal_novo = 0`;
11. reativação gerar MRR sem apagar churn anterior;
12. New MRR ficar fora da NRR;
13. GRR ignorar expansion;
14. bridge monetário reconciliar;
15. periodicidade não suportada ficar explícita;
16. Admin diferenciar MRR de caixa recebido;
17. Wave 24 ser encerrada documentalmente;
18. Backend CI e Playwright ficarem verdes;
19. diff final ser revisado antes de qualquer merge.

## Estado de encerramento

A Wave 25 foi encerrada no head
`627ead4149ef827c21c09ed46e2f366856341655`, com o **Backend CI #1310**
concluído com sucesso, incluindo Playwright mobile.

O PR #284 foi mergeado na `main` pelo commit
`0b17d84b979d26f63a813c1c06b8730bb533b761`.

A baseline P0 + P1 permaneceu congelada em **67/67 (100%)**.
