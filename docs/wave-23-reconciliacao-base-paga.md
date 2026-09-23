# Wave 23 — Reconciliação temporal da base paga

> Documento de evidência/workstream do hardening pós-baseline.
>
> A baseline P0 + P1 continua congelada em **67/67 (100%)**.

## Objetivo

Fechar a lacuna temporal restante depois da Wave 22: uma renovação cancelada
não pode permanecer tecnicamente ativa depois do fim do período já pago apenas
porque a proprietária ainda não abriu uma tela que consulta o plano.

A Wave preserva a semântica já consolidada:

```text
renovação cancelada
  != saída imediata da base paga

fim do período pago
  → assinatura inativa
  → negócio volta ao plano gratuito
  → equipe é reconciliada com o limite
  → ACESSO_PAGO_ENCERRADO
```

## Causa

Antes desta Wave, `expirarCancelamentoComReconciliacao()` já fazia a mutação
correta e transacional, mas era acionada de forma lazy por leituras do plano.

Isso permitia que uma assinatura com `data_proxima_cobranca <= CURRENT_DATE`
continuasse com `ativo = TRUE` até uma navegação posterior.

Esse atraso não muda a regra comercial, mas pode deixar temporariamente
inconsistentes:

- o estoque administrativo de assinaturas pagas ativas;
- o instante local em que `ACESSO_PAGO_ENCERRADO` é materializado;
- leituras futuras de retenção que dependam da saída efetiva da base paga.

## Solução

A Wave adiciona um worker idempotente de reconciliação financeira.

Ele:

1. busca negócios com assinatura paga ainda ativa, status
   `CANCELED/CANCELLED` e fim do período já vencido;
2. processa em lote limitado;
3. reutiliza `expirarCancelamentoComReconciliacao()`, sem criar uma segunda
   regra de expiração;
4. mantém plano gratuito, assinatura inativa, reconciliação da equipe e
   `ACESSO_PAGO_ENCERRADO` na mesma transação lógica já existente;
5. tolera retry e concorrência: uma segunda execução encontra o estado já
   reconciliado e não duplica o evento canônico.

O worker só existe quando os background workers do runtime estão ativos. Em uma
topologia com processo dedicado, o serviço web deve continuar com
`BACKGROUND_WORKERS_ENABLED=false` e o processo `npm run worker` executa a
reconciliação.

## Configuração

Valores padrão:

```text
BILLING_RECONCILIATION_INTERVAL_MS=300000
BILLING_RECONCILIATION_BATCH_SIZE=100
```

O intervalo é configurável entre 1 minuto e 1 hora. O lote aceita de 1 a 500
negócios.

## Banco e performance

A migration 094 adiciona um índice parcial para a consulta recorrente:

```text
assinaturas(data_proxima_cobranca, negocio_id)
WHERE ativo = TRUE
  AND status IN ('CANCELED', 'CANCELLED')
  AND data_proxima_cobranca IS NOT NULL
```

Não há reescrita de histórico financeiro e não há backfill de
`assinatura_eventos`.

## Admin

O estoque de assinaturas pagas ativas passa a excluir cancelamentos cujo período
já venceu, mesmo durante a pequena janela entre o vencimento e o próximo ciclo
do worker.

O Admin também expõe a quantidade atual de cancelamentos vencidos ainda
pendentes de reconciliação. O estado saudável esperado depois de um ciclo é
zero.

Essa métrica é operacional. Ela não é churn.

## Reversões

A Wave não redefine estorno parcial nem `REFUND_IN_PROGRESS` como encerramento
do acesso pago. O Admin pode continuar mostrando o valor integral exposto a
reversões/disputas como diagnóstico financeiro, enquanto
`REVERSAO_FINANCEIRA` no lifecycle permanece um fato de domínio materializado
pelos estados que efetivamente passam pela saga de suspensão.

## Fora do escopo

A Wave 23 não cria:

- churn oficial;
- LTV;
- payback;
- expansion/contraction MRR;
- NRR;
- automação de decisão de mídia.

Essas métricas dependem primeiro de uma base paga temporalmente consistente.

## Critério de encerramento

A Wave pode ser encerrada quando:

1. migration 094 aplicar no banco de teste;
2. o worker reconciliar cancelamentos vencidos sem navegação;
3. retry ou concorrência não duplicar `ACESSO_PAGO_ENCERRADO`;
4. uma falha em um negócio não impedir o restante do lote;
5. o Admin não contar cancelamento vencido como assinatura paga ativa;
6. o diagnóstico de pendência cair para zero após reconciliação;
7. runtime validar intervalo e tamanho de lote;
8. shutdown aguardar execuções agendadas;
9. Backend CI e Playwright ficarem verdes;
10. Wave 22 for encerrada documentalmente;
11. o diff final for revisado antes de qualquer merge.

## Estado de encerramento

A Wave 23 foi encerrada no head
`71f27e28f2ad55644abc0665c80d85cdf8d71da9`, com o **Backend CI #1295**
concluído com sucesso.

O PR #282 foi mergeado na `main` pelo commit
`faeeacb7e1cb6044396a714615cdd1b95964283a`.

A baseline P0 + P1 permaneceu congelada em **67/67 (100%)**.
