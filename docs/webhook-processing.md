# Processamento de webhooks financeiros

## Asaas

A fila `webhook_eventos` recebe eventos do Asaas de forma idempotente. Um evento novo entra como `PENDING` com `tentativas = 0`; a primeira reserva de processamento incrementa o contador para 1.

Para evitar retry indefinido e concorrência entre workers, cada evento possui no máximo 10 tentativas. Eventos `PENDING`, `FAILED` ou `PROCESSING` só podem ser reservados enquanto estiverem abaixo desse limite. Um `PROCESSING` pode ser retomado após cinco minutos apenas quando ainda possui tentativas disponíveis.

Cada reserva retorna `lease_tentativa`, correspondente ao número da tentativa corrente. A conclusão ou falha do processamento usa esse valor como fence: se outro worker já tiver reservado uma tentativa mais nova, o worker antigo não pode sobrescrever o estado atual do evento.

Quando a décima tentativa falha, `proxima_tentativa_em` permanece nula. Se o processo morrer durante a décima tentativa e o registro ficar preso em `PROCESSING`, o worker converte o evento para `FAILED` após cinco minutos, sem criar uma décima primeira tentativa.

As regras financeiras processadas pelo webhook continuam devendo ser idempotentes no domínio, pois o controle da fila reduz duplicidade operacional, mas não substitui idempotência de pagamentos, assinaturas e efeitos externos.
