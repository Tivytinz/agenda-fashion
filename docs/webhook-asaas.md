# Webhook do Asaas

O endpoint `POST /webhook/asaas` exige o token configurado no
Asaas. O mesmo valor deve existir no ambiente da aplicação:

```text
ASAAS_WEBHOOK_TOKEN=<token-forte-configurado-no-Asaas>
```

O Asaas envia esse valor no header `asaas-access-token`. Não use a
chave da API (`ASAAS_API_KEY`) como token do webhook.

Antes de publicar esta versão:

1. Execute `database/migrations/018_webhook_eventos.sql`.
2. Execute
   `database/migrations/019_checkout_idempotente_webhook_assincrono.sql`.
3. Crie um token aleatório entre 32 e 255 caracteres.
4. Salve o token em `ASAAS_WEBHOOK_TOKEN` na aplicação.
5. Configure o mesmo token no webhook do Asaas.
6. Envie um evento de teste no Sandbox.

Cada evento recebido fica registrado em `webhook_eventos`. O campo
`status` pode ter um destes valores:

- `PENDING`: salvo e aguardando o worker;
- `PROCESSING`: processamento em andamento;
- `PROCESSED`: evento aplicado com sucesso;
- `IGNORED`: tipo de evento não usado pela aplicação;
- `FAILED`: ocorreu uma falha e uma nova entrega pode tentar novamente.

A combinação de `provedor` e `evento_id` é única. Assim, uma entrega
repetida não ativa a assinatura mais de uma vez. Tentativas e mensagens
de erro ficam disponíveis para diagnóstico sem salvar o token ou o
payload completo do cliente.

Na ativação da recorrência PIX, a aplicação também consulta o Asaas pela
`externalReference` da assinatura local antes de criar uma nova. Isso
permite recuperar uma assinatura que tenha sido criada no Asaas caso o
processo seja interrompido antes de gravar o identificador no banco.

## Processamento assíncrono

A migration
`019_checkout_idempotente_webhook_assincrono.sql` adiciona ao registro
somente os campos do payload necessários para o processamento. O
endpoint persiste o evento, responde HTTP 200 e deixa a regra
financeira para o worker interno.

O worker:

- reserva eventos com `FOR UPDATE SKIP LOCKED`;
- recupera processamentos interrompidos há mais de cinco minutos;
- repete falhas com espera progressiva;
- limita cada evento a dez tentativas.
