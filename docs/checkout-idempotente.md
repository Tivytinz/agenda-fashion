# Checkout idempotente

> Estado revisado contra a `main` em 26 de agosto de 2026.

O endpoint `POST /checkout` exige o header:

```text
Idempotency-Key: <identificador único da tentativa>
```

O frontend gera uma chave por tentativa e reutiliza a mesma chave quando a resposta falha ou demora. O backend registra a tentativa em `checkout_tentativas`, com unicidade por negócio.

Comportamentos atuais:

- uma tentativa concluída devolve a resposta já armazenada;
- uma tentativa simultânea devolve HTTP 409;
- uma tentativa com falha pode ser retomada;
- uma chave usada com outro plano ou forma de pagamento é rejeitada;
- cobranças PIX são conciliadas no Asaas pela `externalReference`;
- a assinatura atual só é desativada quando o novo pagamento é confirmado.

## Migration

A estrutura de idempotência foi introduzida por:

`database/migrations/019_checkout_idempotente_webhook_assincrono.sql`

No fluxo atual de produção, não execute apenas essa migration manualmente como receita de deploy. O `package.json` executa `migrate:deploy` antes de iniciar o servidor, e o ambiente deve aplicar a sequência pendente de migrations na ordem versionada.

Consulte também `docs/pagamentos.md` e `docs/webhook-asaas.md`.