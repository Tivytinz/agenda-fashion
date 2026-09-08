# Processamento de webhooks financeiros

## Asaas

A fila `webhook_eventos` recebe eventos do Asaas de forma idempotente. Um evento novo entra como `PENDING` com `tentativas = 0`; a primeira reserva de processamento incrementa o contador para 1.

Para evitar retry indefinido e concorrência entre workers, cada evento possui no máximo 10 tentativas. Eventos `PENDING`, `FAILED` ou `PROCESSING` só podem ser reservados enquanto estiverem abaixo desse limite. Um `PROCESSING` pode ser retomado após cinco minutos apenas quando ainda possui tentativas disponíveis.

Cada reserva retorna `lease_tentativa`, correspondente ao número da tentativa corrente. A conclusão ou falha do processamento usa esse valor como fence: se outro worker já tiver reservado uma tentativa mais nova, o worker antigo não pode sobrescrever o estado atual do evento.

Quando a décima tentativa fica presa em `PROCESSING` por mais de cinco minutos, o worker pode marcá-la como `FAILED` terminal. Se o mesmo worker original concluir depois disso, ele ainda pode reconciliar o evento como `PROCESSED` ou `IGNORED` somente quando o número da tentativa continua igual e nenhuma tentativa mais nova assumiu o registro. Qualquer finalização que não atualizar uma linha é tratada como `WEBHOOK_LEASE_LOST` e não pode ser registrada como sucesso apenas em memória ou log.

As regras financeiras processadas pelo webhook continuam devendo ser idempotentes no domínio, pois o controle da fila reduz duplicidade operacional, mas não substitui idempotência de pagamentos, assinaturas e efeitos externos.

## Conversões Meta e Google

Conversões de assinatura originadas por webhooks financeiros são persistidas em `marketing_conversoes_entregas` antes do envio aos provedores. O estado financeiro é confirmado pela transação própria do domínio; depois disso, o webhook só é concluído quando a persistência das entregas termina. Se a gravação da outbox falhar ou o processo morrer antes dela, o registro durável em `webhook_eventos` permanece elegível a retry e consegue reconstruir a conversão a partir do pagamento confirmado. A chave `(provedor, tipo_evento, chave_evento)` é única, de modo que eventos Asaas diferentes referentes à mesma ativação não criem múltiplas entregas para Meta ou Google.

A identificação do primeiro pagamento é histórica: ela usa os pagamentos confirmados da assinatura e não depende de a assinatura continuar atualmente `ACTIVE`. Isso permite reconstruir com segurança a entrega durante um retry mesmo quando, depois da confirmação original, o negócio já trocou ou cancelou a assinatura. O valor enviado aos provedores é relido da cobrança confirmada em `pagamentos`, em vez de confiar no preço armazenado no payload da outbox.

A fila de conversões usa os estados `PENDING`, `PROCESSING`, `SENT`, `IGNORED` e `FAILED`, reserva com `FOR UPDATE SKIP LOCKED`, possui no máximo cinco tentativas e recupera processamento abandonado após cinco minutos. Uma falha temporária recebe `proxima_tentativa_em` e só volta à fila quando esse horário vence; `FAILED` com `proxima_tentativa_em = NULL` é terminal e não volta a ser reservado. Se a quinta tentativa ficar presa e for encerrada pelo limpador, o mesmo lease ainda pode reconciliar posteriormente um resultado `SENT` ou `IGNORED`, sem permitir que uma tentativa mais antiga sobrescreva uma mais nova. Dentro de uma mesma instância da aplicação, ticks concorrentes compartilham a execução já em andamento; entre instâncias, `FOR UPDATE SKIP LOCKED` e o lease continuam sendo a proteção de concorrência.

`Subscribe` da Meta mantém `event_id` estável no formato `subscribe:<assinatura_id>`. O evento `purchase` do Google mantém `transaction_id` estável no formato `af-subscription-<assinatura_id>`. Esses identificadores complementam a outbox local: como uma chamada HTTP externa pode ter sido aceita antes de uma queda impedir a confirmação local, a entrega é operacionalmente *at-least-once* e depende também das chaves estáveis para deduplicação no provedor.

`pagamentos.data_pagamento` é uma coluna `DATE`: ela confirma e ordena pagamentos por dia, mas não registra o instante exato da confirmação. A outbox não inventa essa precisão. Sem um timestamp explícito confiável, Meta usa o horário efetivo do envio e Google Measurement Protocol omite `timestamp_micros`. Os serviços aceitam um timestamp explícito quando existir uma fonte confiável, mas persistir o instante financeiro exato exigirá uma decisão de schema própria, com `TIMESTAMPTZ` ou outro evento durável equivalente.

Renovação, falta de consentimento ou integração intencionalmente desabilitada são resultados terminais e ficam como `IGNORED`. Identificadores inválidos e provedor desconhecido são falhas técnicas terminais e ficam como `FAILED`, sem novo retry. Erros HTTP, timeout e outras falhas temporárias permanecem elegíveis a retry até o limite configurado. Ao esgotar o limite, o worker registra um aviso operacional com identificador da entrega, provedor, tentativa e erro, sem incluir o payload ou dados pessoais.

Ao buscar o perfil para Meta CAPI ou Google Measurement, somente o vínculo de dono ativo e uma conta de usuário ativa podem fornecer consentimento e identificadores de marketing.
