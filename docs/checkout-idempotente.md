# Checkout idempotente

O endpoint `POST /checkout` exige o header:

```text
Idempotency-Key: <identificador único da tentativa>
```

O frontend gera uma chave por tentativa e reutiliza a mesma chave
quando a resposta falha ou demora. O backend registra a tentativa em
`checkout_tentativas`, com unicidade por negócio.

Comportamentos:

- uma tentativa concluída devolve a resposta já armazenada;
- uma tentativa simultânea devolve HTTP 409;
- uma tentativa com falha pode ser retomada;
- cada retomada incrementa `lease_tentativa`; somente a execução que possui o
  lease corrente pode marcar a tentativa como `COMPLETED` ou `FAILED`;
- uma chave usada com outro plano ou forma de pagamento é rejeitada;
- cobranças PIX são conciliadas no Asaas pela `externalReference`;
- a assinatura atual só é desativada quando o novo pagamento é
  confirmado.

A confirmação financeira não mantém locks do PostgreSQL enquanto cria ou remove
recorrências no Asaas. A transição para o plano pago usa preparação local,
efeito externo idempotente, revalidação/finalização local e limpeza externa. Uma
renovação que já possui `asaas_subscription_id` reutiliza a recorrência
existente em vez de criar outra assinatura mensal.

Detalhes: `docs/asaas-ativacao-recorrencia.md` e
`docs/webhook-processing.md`.

Antes do deploy, execute:

```text
database/migrations/019_checkout_idempotente_webhook_assincrono.sql
```

A correção posterior da faixa válida de tentativas de webhook pertence à
migration `020_corrigir_tentativas_webhook.sql`. O fencing das retomadas do
checkout pertence à migration `076_checkout_tentativa_fencing.sql`; migrations
já aplicadas não devem ser reescritas.
