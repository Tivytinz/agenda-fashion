# Webhook do Asaas

> **Papel documental:** contrato especializado de entrada do provedor Asaas. Retry, fencing, ordenação e estado da fila são definidos em [`webhook-processing.md`](./webhook-processing.md).

O endpoint `POST /webhook/asaas` exige o token configurado no
Asaas. O mesmo valor deve existir no ambiente da aplicação:

```text
ASAAS_WEBHOOK_TOKEN=<token-forte-configurado-no-Asaas>
```

O Asaas envia esse valor no header `asaas-access-token`. Não use a
chave da API (`ASAAS_API_KEY`) como token do webhook.

Configuração operacional:

1. mantenha um token aleatório forte em `ASAAS_WEBHOOK_TOKEN`;
2. configure o mesmo valor no webhook do Asaas;
3. valide a integração com evento de teste no Sandbox quando houver mudança de
   credencial ou contrato;
4. deixe migrations pendentes serem aplicadas pelo fluxo normal de deploy.

As migrations `018_webhook_eventos.sql` e
`019_checkout_idempotente_webhook_assincrono.sql` registram a introdução
histórica dessa infraestrutura; não devem ser reaplicadas manualmente nem
reescritas.

Cada evento recebido fica registrado em `webhook_eventos`. O campo
`status` pode ter um destes valores:

- `PENDING`: salvo e aguardando o worker;
- `PROCESSING`: processamento em andamento;
- `PROCESSED`: evento aplicado com sucesso;
- `IGNORED`: tipo de evento não usado pela aplicação;
- `FAILED`: ocorreu uma falha; o evento pode voltar ao retry enquanto ainda possui tentativas disponíveis e pode se tornar terminal ao esgotar o limite.

A combinação de `provedor` e `evento_id` é única. Assim, uma entrega
repetida não ativa a assinatura mais de uma vez. Tentativas e mensagens
de erro ficam disponíveis para diagnóstico sem salvar o token ou o
payload completo do cliente.

Na ativação da recorrência PIX, a aplicação também consulta o Asaas pela
`externalReference` da assinatura local antes de criar uma nova. Isso
permite recuperar uma assinatura que tenha sido criada no Asaas caso o
processo seja interrompido antes de gravar o identificador no banco.

## Eventos de assinatura

O worker trata os eventos:

- `SUBSCRIPTION_CREATED`;
- `SUBSCRIPTION_UPDATED`;
- `SUBSCRIPTION_INACTIVATED`;
- `SUBSCRIPTION_DELETED`.

Criação e atualização sincronizam o identificador, cliente, valor,
ciclo, forma de pagamento e próxima cobrança. Esses eventos não ativam
o plano: o acesso só é liberado por um pagamento confirmado.

Inativação encerra o acesso e retorna o negócio ao plano gratuito.
Exclusão cancela a renovação; quando existe um período ativo já pago, o
acesso é preservado até `data_proxima_cobranca`.

Assinaturas ainda sem `asaas_subscription_id` podem ser conciliadas pela
`externalReference` no formato
`assinatura:<id>;negocio:<id>;plano:<id>`.

## Processamento assíncrono

A migration
`019_checkout_idempotente_webhook_assincrono.sql` introduziu no registro
somente os campos do payload necessários para o processamento. O endpoint
persiste o evento, responde HTTP 200 e deixa a regra financeira para o worker
interno.

O worker:

- reserva eventos com `FOR UPDATE SKIP LOCKED`;
- recupera processamentos interrompidos há mais de cinco minutos;
- repete falhas com espera progressiva;
- limita cada evento a dez tentativas.
