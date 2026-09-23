# Retenção de webhooks

> **Papel documental:** política especializada de retenção e minimização de dados da fila definida em [`webhook-processing.md`](./webhook-processing.md). Este arquivo não redefine retry, ordenação ou regras financeiras.

## Objetivo

Os registros de `webhook_eventos` cumprem duas funções diferentes:

1. impedir reprocessamento do mesmo `provedor + evento_id`;
2. manter temporariamente o payload mínimo necessário para processamento, retry e diagnóstico.

A política de retenção preserva a primeira função mesmo depois que o payload deixa de ser necessário.

## Regra

Eventos em `PROCESSED` ou `IGNORED`, com `processado_em` anterior à janela de retenção, têm somente `payload` e `erro` redigidos (`NULL`).

A linha do evento não é apagada. Permanecem `provedor`, `evento_id`, tipo, recurso, status e timestamps, de forma que a constraint única de idempotência continue bloqueando uma entrega antiga repetida pelo provedor.

Eventos `PENDING`, `PROCESSING` ou `FAILED` não são redigidos por essa rotina, porque ainda podem precisar do payload para retry ou diagnóstico.

## Janela

A janela padrão é de 180 dias.

Pode ser ajustada por `WEBHOOK_RETENTION_DAYS` entre 30 e 730 dias. Valor ausente, inválido ou fora desse intervalo volta para 180 dias.

O worker de webhook chama a manutenção no máximo uma vez a cada 24 horas por processo. Em múltiplas réplicas a operação continua idempotente: uma execução posterior simplesmente não encontra payload já redigido.

## Falhas

Falha na retenção não pode interromper a fila financeira. O worker registra aviso e continua processando webhooks e conversões. A tentativa é limitada temporalmente para evitar uma falha persistente gerando log a cada ciclo de 30 segundos.
