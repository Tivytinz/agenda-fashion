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
2. Crie um token aleatório entre 32 e 255 caracteres.
3. Salve o token em `ASAAS_WEBHOOK_TOKEN` na aplicação.
4. Configure o mesmo token no webhook do Asaas.
5. Envie um evento de teste no Sandbox.

Cada evento recebido fica registrado em `webhook_eventos`. O campo
`status` pode ter um destes valores:

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
