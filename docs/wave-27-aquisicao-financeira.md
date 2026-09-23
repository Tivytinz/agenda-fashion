# Wave 27 — Aquisição paga × retorno bruto observado v1

> Documento de evidência/workstream do hardening pós-baseline.
>
> A baseline funcional P0 + P1 permanece congelada em **67/67 (100%)**.

## Objetivo

Conectar aquisição profissional, negócio, campanha, custo de mídia, primeira
conversão paga e receita futura na mesma coorte financeira.

A Wave 27 não usa LTV e CAC de painéis independentes como se fossem
automaticamente comparáveis. Primeiro materializa uma identidade financeira
imutável no nível do negócio.

## Unidade

A unidade permanece o **negócio**.

```text
profissional adquirido
  → negócio original
  → primeira conversão paga
  → receita observada do mesmo negócio
```

Troca de plano, nova assinatura técnica, churn e reativação não criam uma nova
aquisição.

## Cutover

A migration 098 cria o marco `aquisicao_financeira_v1_inicio` e a tabela
`marketing_negocio_aquisicoes`.

Somente `CONVERSAO_INICIAL` canônica posterior ao cutover pode materializar um
snapshot. Histórico anterior não é inferido.

## Snapshot de aquisição

O snapshot congela:

- negócio;
- primeira conta que apareceu como dona;
- first-touch persistido dessa conta;
- campanha oficial resolvida;
- classificação da atribuição;
- método de resolução;
- primeira conversão paga;
- primeiro pagamento;
- plano de entrada.

Transferência futura de propriedade ou correção posterior de vínculo de campanha
não reescreve silenciosamente a interpretação financeira já materializada.

A materialização acontece fora da transação crítica do pagamento. Falha de
analytics nunca pode reverter uma ativação paga válida. Um worker idempotente
reconcilia snapshots pendentes a partir de `assinatura_eventos`.

## Custo canônico

O custo observado é diário por campanha e reutiliza a regra já implementada
desde a migration 037.

`marketing_campanha_gastos_manter_fonte_unica` garante que exista apenas uma
fonte efetiva para a mesma campanha/dia: ao gravar uma fonte nova, as fontes
anteriores daquele dia são removidas. Portanto a Wave 27 não cria uma segunda
precedência entre manual, Google Ads, Meta Ads, TikTok Ads ou Pinterest Ads.

A migration 098 também fotografa `objetivo_snapshot` no próprio custo diário.
Assim, mudar uma campanha de `profissional` para `cliente` no futuro não
reclassifica silenciosamente o custo histórico já persistido.

A leitura financeira soma o fato diário persistido. Se um negócio pago oficial
foi adquirido em uma data sem custo da própria campanha, a janela correspondente
fica com `cobertura_custo_incompleta` em vez de fabricar CAC.

## CAC de mídia observado

```text
investimento de mídia maduro
────────────────────────────
novos negócios pagos atribuídos
```

O nome permanece **CAC de mídia observado** porque o AF ainda não incorpora
custos de vendas, suporte, gateway, impostos, infraestrutura marginal ou outras
parcelas de CAC econômico.

Profissionais adquiridos que nunca convertem continuam representados no
investimento da coorte. O gasto não é redistribuído apenas entre quem pagou.

## Maturidade

A base usa a maturidade de monetização configurada no backend mais a janela de
receita:

```text
D30 = monetização + 30 dias
D60 = monetização + 60 dias
D90 = monetização + 90 dias
```

Com a configuração atual de 21 dias, isso corresponde a 51, 81 e 111 dias.

O código usa a configuração vigente; não hardcoda 21 dias.

## Receita e retorno bruto

A receita continua usando pagamentos observados do mesmo negócio.

Para cada janela madura:

```text
retorno bruto Dn =
receita bruta observada Dn
──────────────────────────
investimento de mídia maduro
```

```text
LTV bruto observado / CAC mídia =
LTV bruto observado Dn
──────────────────────
CAC de mídia observado
```

Quando numerador e denominador usam exatamente a mesma coorte, as duas leituras
são matematicamente relacionadas, mas têm interpretações diferentes.

## Limites

A Wave 27 não declara:

- CAC econômico total;
- payback econômico;
- LTV líquido;
- margem de contribuição;
- lucro por cliente;
- decisão automática de escalar, manter ou pausar mídia.

A frase permitida é **recuperação de receita bruta observada**.

Refund, estorno e disputa continuam como exposição separada; partial refund não
vira receita líquida estimada.

## Critérios de encerramento

1. migration 098 aplicar no banco de teste;
2. aquisição financeira ser única por negócio;
3. primeiro dono permanecer congelado após transferência;
4. campanha oficial permanecer congelada após correção posterior;
5. falha na materialização não afetar pagamento;
6. retry do worker não duplicar snapshot;
7. a Wave reutilizar a fonte única diária já garantida pela migration 037;
8. substituição da fonte do dia não duplicar investimento;
9. mudança posterior do objetivo da campanha não reclassificar custo histórico;
10. negócio pago maduro sem custo no dia de aquisição bloquear a comparação;
11. CAC usar toda a despesa madura da campanha, inclusive dias sem conversão;
12. pagante contar apenas quando a conversão ocorrer dentro da janela de
    monetização da aquisição;
13. D30/D60/D90 usarem a mesma base financeira madura;
14. churn não apagar receita histórica;
15. reativação não criar nova aquisição;
16. reversões permanecerem exposição separada;
17. Admin diferenciar CAC de mídia de CAC econômico;
18. régua atual de decisão de mídia não ser alterada automaticamente;
19. Wave 26 ser encerrada documentalmente;
20. Backend CI e Playwright ficarem verdes;
21. diff final ser revisado antes de qualquer merge.

## Estado de encerramento

A Wave 27 foi encerrada no head
`24640fec15e0fc889d3f66e14eb456f1ce65e2c6`, com o **Backend CI #1338**
concluído com sucesso, incluindo Playwright mobile.

O PR #286 foi mergeado na `main` pelo commit
`1c39a6cf3435a3809183a8c4d008b7f612729116`.

A baseline P0 + P1 permaneceu congelada em **67/67 (100%)**.
