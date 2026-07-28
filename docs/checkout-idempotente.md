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
- uma chave usada com outro plano ou forma de pagamento é rejeitada;
- PIX e cartão são conciliados no Asaas pela `externalReference`;
- a assinatura atual só é desativada quando o novo pagamento é
  confirmado.

Antes do deploy, execute:

```text
database/migrations/019_checkout_idempotente_webhook_assincrono.sql
```
