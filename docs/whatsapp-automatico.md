# Mensagens automáticas pelo WhatsApp

## Escopo

O Agenda Fashion usa a WhatsApp Cloud API oficial da Meta e uma fila
persistente no PostgreSQL.

O fluxo cria até seis mensagens para cada agendamento:

1. novo agendamento para o profissional;
2. confirmação para a cliente;
3. lembrete para a cliente, por padrão 24 horas antes;
4. lembrete para a profissional, por padrão 24 horas antes;
5. cancelamento para o profissional;
6. cancelamento para a cliente.

As mensagens para a cliente só são criadas quando ela marca o consentimento no
formulário. O agendamento continua funcionando quando ela não autoriza.

## Garantias da fila

- O agendamento e as mensagens são gravados na mesma transação.
- A restrição única por agendamento, tipo e destinatário evita duplicidade.
- Falhas temporárias recebem até cinco tentativas, com espera progressiva.
- Erros permanentes de autenticação, configuração ou template não são repetidos.
- Dois workers podem rodar sem reservar a mesma mensagem, por causa de
  `FOR UPDATE SKIP LOCKED`.
- Confirmações e cancelamentos expiram após duas horas.
- O lembrete expira no horário do atendimento.
- Cancelar o agendamento cancela as mensagens pendentes do fluxo ativo.
- O número brasileiro é enviado no padrão internacional `55 + DDD + número`.
- Tokens de acesso não são gravados no banco nem impressos nos logs de erro.

O status da fila `SENT` significa que a Meta aceitou a mensagem e retornou um
`wamid`. O webhook em `/webhook/whatsapp` atualiza `status_entrega` para
`SENT`, `DELIVERED`, `READ` ou `FAILED`.

## Migration

Antes de publicar o código que usa a fila, execute:

```bash
node scripts/executar-migration.js database/migrations/021_mensagens_automaticas_whatsapp.sql
```

A migration:

- adiciona `agendamentos.whatsapp_consentido_em`;
- cria `whatsapp_mensagens`;
- cria os índices, restrições e trigger de `updated_at`.

Ela é idempotente para criação de tabela, coluna e índices.

Depois, execute a migration de rastreamento de entrega:

```bash
node scripts/executar-migration.js database/migrations/022_status_entrega_whatsapp.sql
```

Para habilitar o lembrete da profissional, execute também:

```bash
node scripts/executar-migration.js database/migrations/041_lembrete_whatsapp_profissional.sql
```

## Templates da Meta

Crie os seis templates na categoria `UTILITY`, idioma `Portuguese (BR)`.
Os nomes e a ordem das variáveis precisam ser exatamente os mesmos usados pelo
backend.

### `novo_agendamento`

Destinatário: profissional ou WhatsApp do negócio.

```text
✨ Novo agendamento recebido!

Olá, {{1}}! Você tem um novo horário marcado pelo Agenda Fashion. 💅

👤 Cliente: {{2}}
📱 WhatsApp: {{3}}
💖 Serviço: {{4}}
📅 Data: {{5}}
⏰ Horário: {{6}}

Prepare tudo com carinho para oferecer uma experiência incrível. Cada novo agendamento é mais um passo para o crescimento do seu negócio! ✨
```

### `confirmacao_agendamento_cliente`

Destinatário: cliente que autorizou mensagens.

```text
💖 Agendamento confirmado!

Olá, {{1}}! Seu horário foi reservado com sucesso pelo Agenda Fashion. ✨

🏢 Negócio: {{2}}
💅 Serviço: {{3}}
📅 Data: {{4}}
⏰ Horário: {{5}}

Está tudo certo para o seu atendimento. Esperamos que você tenha uma experiência incrível! ✨
```

### `lembrete_agendamento`

Destinatário: cliente que autorizou mensagens.

```text
⏰ Lembrete do seu agendamento!

Olá, {{1}}! Passando para lembrar que seu horário está chegando. 💅✨

🏢 Negócio: {{2}}
💖 Serviço: {{3}}
📅 Data: {{4}}
⏰ Horário: {{5}}

Organize-se para chegar no horário combinado. Esperamos por você! 💖
```

### `lembrete_agendamento_profissional`

Destinatário: profissional ou WhatsApp do negócio.

```text
⏰ Atendimento chegando!

Olá, {{1}}! Você tem um atendimento chegando. 💖

👤 Cliente: {{2}}
📱 WhatsApp: {{3}}
💅 Serviço: {{4}}
📅 Data: {{5}}
⏰ Horário: {{6}}

Confira sua agenda no Agenda Fashion e prepare-se para o atendimento.
```

### `cancelamento_agendamento_profissional`

Destinatário: profissional ou WhatsApp do negócio.

```text
⚠️ Agendamento cancelado

Olá, {{1}}. Um agendamento da sua agenda foi cancelado.

👤 Cliente: {{2}}
📱 WhatsApp: {{3}}
💖 Serviço: {{4}}
📅 Data: {{5}}
⏰ Horário: {{6}}

Esse horário agora está disponível novamente na sua agenda.
```

### `cancelamento_agendamento`

Destinatário: cliente que autorizou mensagens.

```text
⚠️ Agendamento cancelado

Olá, {{1}}. Seu agendamento foi cancelado.

🏢 Negócio: {{2}}
💖 Serviço: {{3}}
📅 Data: {{4}}
⏰ Horário: {{5}}

Você pode acessar o Agenda Fashion para escolher um novo horário quando desejar. Esperamos atender você em breve! 💖
```

## Variáveis do Railway

Use `docs/whatsapp.env.example` como referência. As obrigatórias para ativação
são:

```text
WHATSAPP_NOTIFICATIONS_ENABLED=true
WHATSAPP_ACCESS_TOKEN=
WHATSAPP_PHONE_NUMBER_ID=
WHATSAPP_API_VERSION=
WHATSAPP_TEMPLATE_LANGUAGE=pt_BR
WHATSAPP_TEMPLATE_NOVO_AGENDAMENTO=novo_agendamento
WHATSAPP_TEMPLATE_CONFIRMACAO_CLIENTE=confirmacao_agendamento_cliente
WHATSAPP_TEMPLATE_LEMBRETE_CLIENTE=lembrete_agendamento
WHATSAPP_TEMPLATE_LEMBRETE_PROFISSIONAL=lembrete_agendamento_profissional
WHATSAPP_TEMPLATE_CANCELAMENTO_PROFISSIONAL=cancelamento_agendamento_profissional
WHATSAPP_TEMPLATE_CANCELAMENTO_CLIENTE=cancelamento_agendamento
WHATSAPP_PROFESSIONAL_REMINDER_ENABLED=false
WHATSAPP_WEBHOOK_VERIFY_TOKEN=
WHATSAPP_APP_SECRET=
```

Use um token de acesso permanente de usuário do sistema na ativação final.
O processador recusa iniciar se as credenciais da API ou os segredos do webhook
estiverem ausentes.

Os cinco modelos originais estão aprovados pela Meta. Ative o lembrete da
profissional somente depois que `lembrete_agendamento_profissional` também
aparecer como ativo. Mantenha `WHATSAPP_NOTIFICATIONS_ENABLED=true` em
produção. Para um teste controlado:

Depois da aprovação do novo modelo, altere no Railway:

```text
WHATSAPP_PROFESSIONAL_REMINDER_ENABLED=true
```

1. configure `WHATSAPP_TEST_RECIPIENT` com o número autorizado na Meta;
2. execute `node scripts/testar-template-novo-agendamento.js`;
3. confira o recebimento antes de ligar o processador;
4. configure o webhook da Meta usando `/webhook/whatsapp`;
5. remova `WHATSAPP_TEST_RECIPIENT`;
6. confirme `WHATSAPP_NOTIFICATIONS_ENABLED=true`.

`WHATSAPP_TEST_RECIPIENT` nunca substitui o destinatário da fila automática.
Isso impede que um teste redirecione mensagens reais de várias clientes.

## Consulta operacional

```sql
SELECT
  id,
  agendamento_id,
  tipo,
  status,
  tentativas,
  agendado_para,
  expira_em,
  enviado_em,
  meta_message_id,
  status_entrega,
  status_entrega_em,
  entregue_em,
  lida_em,
  falhou_em,
  meta_codigo_erro,
  falha_retentavel,
  ultimo_erro
FROM whatsapp_mensagens
ORDER BY id DESC
LIMIT 50;
```

Nunca salve o token da Meta em commits, prints ou mensagens de suporte.
