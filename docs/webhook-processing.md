# Processamento de webhooks financeiros

## Asaas

A fila `webhook_eventos` recebe eventos do Asaas de forma idempotente. Um evento novo entra como `PENDING` com `tentativas = 0`; a primeira reserva de processamento incrementa o contador para 1.

Para evitar retry indefinido e concorrência entre workers, cada evento possui no máximo 10 tentativas. Eventos `PENDING`, `FAILED` ou `PROCESSING` só podem ser reservados enquanto estiverem abaixo desse limite. Um `PROCESSING` pode ser retomado após cinco minutos apenas quando ainda possui tentativas disponíveis.

Cada reserva retorna `lease_tentativa`, correspondente ao número da tentativa corrente. A conclusão ou falha do processamento usa esse valor como fence: se outro worker já tiver reservado uma tentativa mais nova, o worker antigo não pode sobrescrever o estado atual do evento.

Quando a décima tentativa fica presa em `PROCESSING` por mais de cinco minutos, o worker pode marcá-la como `FAILED` terminal. Se o mesmo worker original concluir depois disso, ele ainda pode reconciliar o evento como `PROCESSED` ou `IGNORED` somente quando o número da tentativa continua igual e nenhuma tentativa mais nova assumiu o registro. Qualquer finalização que não atualizar uma linha é tratada como `WEBHOOK_LEASE_LOST` e não pode ser registrada como sucesso apenas em memória ou log.

As regras financeiras processadas pelo webhook continuam devendo ser idempotentes no domínio, pois o controle da fila reduz duplicidade operacional, mas não substitui idempotência de pagamentos, assinaturas e efeitos externos.

## Conversões Meta e Google

Conversões de assinatura originadas por webhooks financeiros são persistidas em `marketing_conversoes_entregas` antes do envio aos provedores. A chave `(provedor, tipo_evento, chave_evento)` é única, de modo que eventos Asaas diferentes referentes à mesma ativação não criem múltiplas entregas para Meta ou Google.

A fila de conversões usa os estados `PENDING`, `PROCESSING`, `SENT`, `IGNORED` e `FAILED`, reserva com `FOR UPDATE SKIP LOCKED`, possui no máximo cinco tentativas e recupera processamento abandonado após cinco minutos. Falhas temporárias do provedor entram em retry sem bloquear pagamento, assinatura ou o webhook financeiro.

`Subscribe` da Meta mantém `event_id` estável no formato `subscribe:<assinatura_id>`. O evento `purchase` do Google mantém `transaction_id` estável no formato `af-subscription-<assinatura_id>`. Esses identificadores complementam a outbox local: como uma chamada HTTP externa pode ter sido aceita antes de uma queda impedir a confirmação local, a entrega é operacionalmente *at-least-once* e depende também das chaves estáveis para deduplicação no provedor.

Renovação, falta de consentimento ou integração desabilitada são resultados terminais e ficam como `IGNORED`; erros HTTP, timeout e falhas temporárias permanecem elegíveis a retry até o limite configurado.
