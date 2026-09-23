# Wave 24 — Episódios pagos e churn observável v1

> Documento de evidência/workstream do hardening pós-baseline.
>
> A baseline funcional P0 + P1 permanece congelada em **67/67 (100%)**.

## Objetivo

Transformar a saída efetiva da base paga em uma leitura de retenção reconstruível
por negócio, sem chamar atraso temporário, troca de plano ou cancelamento ainda
vigente de churn.

A unidade financeira desta Wave é o **negócio**.

```text
profissional != negócio
pagamento != negócio
assinatura técnica != episódio pago
```

## Episódio pago

Um episódio pago começa em um destes fatos:

- `EPISODIO_PAGO_BASELINE`;
- `CONVERSAO_INICIAL`;
- `REATIVACAO_PAGA`.

Renovação e mudança de plano mantêm o episódio aberto.

Um episódio termina somente quando o negócio realmente deixa a base paga e o AF
materializa `ACESSO_PAGO_ENCERRADO`.

## Cutover e histórico

A migration 095 cria o marco `churn_v1_inicio` em
`financeiro_marcos` e registra um snapshot factual da base paga presente no
cutover como `EPISODIO_PAGO_BASELINE`.

Esse snapshot não tenta inferir quando negócios antigos converteram. O histórico
anterior continua classificado como `nao_inferido`.

## Inadimplência

Atraso é inicialmente recuperável.

A regra v1 usa uma janela padrão de **14 dias**:

```text
PAGAMENTO_ATRASADO
  → até 14 dias para recuperação
      → pagamento confirmado: PAGAMENTO_RECUPERADO
      → sem recuperação: ACESSO_PAGO_ENCERRADO
        motivo = INADIMPLENCIA_NAO_RECUPERADA
```

O acesso já é suspenso pelo fluxo financeiro existente. A janela de 14 dias
define terminalidade analítica e de lifecycle; não concede benefício pago extra.

A configuração é:

```text
BILLING_DELINQUENCY_TERMINAL_DAYS=14
```

## Reativação

Se um pagamento chegar depois de um episódio já encerrado, o novo fato principal
é `REATIVACAO_PAGA`, mesmo quando a cobrança pertence à mesma
`assinatura_id`.

Quando houve atraso, `PAGAMENTO_RECUPERADO` continua sendo registrado como fato
complementar da cobrança.

## Idempotência

A saída precisa ser idempotente por fato terminal, não por toda a vida da
assinatura.

- inadimplência terminal usa o pagamento como referência;
- término de período cancelado usa a data de acesso;
- encerramento pelo provedor usa o identificador do webhook quando disponível.

Isso permite que uma mesma assinatura participe de mais de um episódio legítimo
sem duplicar a mesma saída.

## Churn observável v1

O Admin pode calcular **gross logo churn** somente a partir do marco da Wave 24.

```text
negócios da base inicial que tiveram saída terminal
---------------------------------------------------
negócios pagos no início do recorte canônico
```

Reativação permanece separada e não reduz retroativamente o churn bruto.

O Admin também deve separar motivos de saída, principalmente:

- cancelamento voluntário;
- inadimplência não recuperada;
- encerramento pelo provedor;
- outros motivos estruturados.

## Concorrência

O worker revalida a cobrança dentro de transação antes de materializar a saída.

Se a recuperação chegar primeiro, a cobrança deixa de ser elegível.

Se a saída terminal for materializada primeiro, uma confirmação posterior inicia
reativação.

## Fora do escopo

A Wave 24 não cria:

- MRR expansion/contraction;
- NRR;
- LTV;
- payback;
- decisão automática de mídia.

## Critério de encerramento

1. migration 095 aplicar no banco de teste;
2. baseline factual não inventar histórico anterior;
3. atraso menor que a janela não virar saída terminal;
4. atraso maduro recuperado não virar churn;
5. inadimplência não recuperada gerar uma única saída;
6. pagamento posterior a uma saída virar reativação;
7. mudança de plano não encerrar o episódio do negócio;
8. encerramento de uma assinatura antiga não retirar outro plano pago vigente;
9. churn usar negócios da base inicial, não pagamentos;
10. reativação permanecer separada do churn bruto;
11. frontend deixar clara a cobertura temporal;
12. Backend CI e Playwright ficarem verdes;
13. diff final ser revisado antes de qualquer merge.

## Estado de encerramento

A Wave 24 foi encerrada no head
`abf2831cb38721970570e64128b5380d39c2289a`, com o **Backend CI #1298**
concluído com sucesso, incluindo Playwright mobile.

O PR #283 foi mergeado na `main` pelo commit
`4f5ee55f6cd989837af82e95d36e28a33e06825a`.

A baseline P0 + P1 permaneceu congelada em **67/67 (100%)**.
