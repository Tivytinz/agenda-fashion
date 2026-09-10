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

Separadamente, o AF pode criar orientações de ativação para o dono do negócio:

1. `lembrete_primeiro_servico`, quando ainda não existe serviço ativo;
2. `lembrete_divulgar_negocio`, quando o negócio está publicado e possui ao
   menos um serviço ativo.

Esses dois modelos são mutuamente exclusivos. O banco permite no máximo uma
mensagem por negócio e data, e a regra de elegibilidade impede que os dois sejam
enviados para o mesmo negócio no mesmo dia. A cadência real também respeita o
intervalo mínimo configurado; portanto essas orientações não devem ser descritas
como um envio diário obrigatório.

Para visitantes, as mensagens para a cliente só são criadas quando ela marca o
consentimento no formulário do agendamento. Para clientes com conta, vale a
preferência de mensagens escolhida no cadastro e disponível em **Minha conta >
Mensagens no WhatsApp**. O agendamento continua funcionando quando ela não
autoriza.

Contas antigas sem evento auditável de consentimento ficam desativadas até a
cliente autorizar explicitamente. A fila consulta novamente essa preferência
antes de reservar e antes de enviar cada mensagem pendente.

Avisos para profissionais possuem consentimento operacional separado das
orientações de marketing.

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

## Migrations

A evolução do fluxo está distribuída pelas migrations de WhatsApp. Entre as
principais estão:

- `021_mensagens_automaticas_whatsapp.sql`: fila inicial e consentimento do agendamento;
- `022_status_entrega_whatsapp.sql`: rastreamento de entrega;
- `041_lembrete_whatsapp_profissional.sql`: lembrete da profissional;
- `044_lembretes_diarios_whatsapp_negocio.sql`: estrutura histórica das orientações ligadas ao negócio;
- `046_notificacoes_whatsapp_clientes.sql`: preferência de mensagens das clientes;
- `048_metricas_admin_whatsapp.sql`: índice de apoio às métricas administrativas;
- `052_consentimento_whatsapp_meta.sql`: separação de consentimento operacional e marketing;
- `053_respostas_conversa_whatsapp.sql`: respostas idempotentes aos quebra-gelos;
- `054_consentimento_comprovavel_optout_global.sql`: consentimento comprovável e opt-out global;
- `055_optout_global_duravel_whatsapp.sql`: aplicação durável do opt-out global a agendamentos existentes.

O nome histórico da migration `044` não define a cadência atual do produto. O
runtime respeita `WHATSAPP_BUSINESS_REMINDER_MAX_SENDS`,
`WHATSAPP_BUSINESS_REMINDER_INTERVAL_DAYS` e
`WHATSAPP_BUSINESS_REMINDER_HOUR`.

Migrations já aplicadas não devem ser reescritas para renomear esse histórico.

## Templates da Meta

Os seis templates transacionais pertencem à categoria `UTILITY`, idioma
`Portuguese (BR)`. Os dois templates de ativação pertencem à categoria
`MARKETING`. Os nomes e a ordem das variáveis precisam permanecer compatíveis
com o backend.

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

Confira os dados e prepare-se para o atendimento.
```

Se o modelo já estiver ativo na Meta com conteúdo diferente, confirme o estado
no WhatsApp Manager antes de alterar o nome/configuração usado em produção.

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

### `lembrete_primeiro_servico`

Categoria: `MARKETING`.

Destinatário: dono de negócio que autorizou as orientações de ativação e
permanece sem serviços ativos após o período mínimo de elegibilidade.

O modelo não possui variáveis. Ele direciona para:
`https://app.agendafashion.com.br/painel/servicos/novo`.

Inclua um botão de resposta rápida **Parar marketing**, com payload
`PARAR_MARKETING`, para que o webhook aplique o descadastro sem exigir login.

### `lembrete_divulgar_negocio`

Categoria: `MARKETING`.

Destinatário: dono de negócio publicado, com ao menos um serviço ativo e que
autorizou as orientações de marketing.

Ordem das variáveis:

1. nome do dono;
2. nome do negócio;
3. URL pública completa do negócio.

Inclua um botão de resposta rápida **Parar marketing**, com payload
`PARAR_MARKETING`.

O conjunto de orientações pode ser enviado no máximo três vezes, com intervalo
mínimo de três dias, a partir das 10h no fuso do negócio. Os limites são
configurados por:

```text
WHATSAPP_BUSINESS_REMINDER_MAX_SENDS
WHATSAPP_BUSINESS_REMINDER_INTERVAL_DAYS
WHATSAPP_BUSINESS_REMINDER_HOUR
```

## Variáveis do Railway

Use `docs/whatsapp.env.example` como referência. As principais variáveis de
configuração são:

```text
WHATSAPP_NOTIFICATIONS_ENABLED=true
WHATSAPP_ACCESS_TOKEN=
WHATSAPP_BUSINESS_ACCOUNT_ID=
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
WHATSAPP_TEMPLATE_PRIMEIRO_SERVICO=lembrete_primeiro_servico
WHATSAPP_TEMPLATE_DIVULGAR_NEGOCIO=lembrete_divulgar_negocio
WHATSAPP_FIRST_SERVICE_REMINDER_ENABLED=false
WHATSAPP_SHARE_REMINDER_ENABLED=false
WHATSAPP_BUSINESS_REMINDER_HOUR=10
WHATSAPP_BUSINESS_REMINDER_MAX_SENDS=3
WHATSAPP_BUSINESS_REMINDER_INTERVAL_DAYS=3
WHATSAPP_BUSINESS_REMINDER_SCAN_INTERVAL_MS=300000
WHATSAPP_WEBHOOK_VERIFY_TOKEN=
WHATSAPP_APP_SECRET=
WHATSAPP_CONVERSATION_AUTOREPLIES_ENABLED=false
```

Use um token de acesso permanente de usuário do sistema na ativação final. O
processador recusa iniciar se as credenciais da API ou os segredos do webhook
estiverem ausentes quando o recurso correspondente exigir essas credenciais.

A aprovação dos templates é estado externo e não deve ser tratada como verdade
estática deste documento. Confirme os modelos em **Administração > WhatsApp**,
que consulta a conta configurada. O WABA não é o ID do número de telefone e pode
ser diferente do ID geral do Gerenciador de Negócios.

Ative cada automação somente depois que o respectivo modelo estiver disponível
e o consentimento aplicável puder ser comprovado. Desativar a preferência
cancela a elegibilidade conforme o fluxo implementado; mensagens pendentes são
revalidadas antes do envio.

`PARAR MARKETING` interrompe a categoria de marketing. Pedidos globais como
`SAIR`, `PARAR` e `STOP`, além das formas claras reconhecidas pelo webhook,
aplicam o opt-out global implementado.

Para um teste controlado de template, `WHATSAPP_TEST_RECIPIENT` pode ser usado
pelo script específico. Ele nunca substitui o destinatário da fila automática e
deve ser removido depois do teste.

## Quebra-gelos e respostas automáticas

Configure estes quatro quebra-gelos no número oficial:

1. `Como funciona o Agenda Fashion?`;
2. `Quero criar minha agenda online`;
3. `Quais são os planos disponíveis?`;
4. `Preciso de ajuda`.

Quando `WHATSAPP_CONVERSATION_AUTOREPLIES_ENABLED=true`, o webhook normaliza o
texto, reconhece essas intenções e pode enviar uma resposta livre dentro da
janela iniciada pela própria pessoa. O envio não depende de consentimento de
marketing porque responde a uma ação solicitada no chat.

Cada mensagem recebida é deduplicada pelo `wamid`. O webhook também confere o
`WHATSAPP_PHONE_NUMBER_ID` antes de responder, evitando processar mensagens de
outro número da mesma conta como se fossem do número oficial do AF.

## Consulta operacional

O painel **Administração > WhatsApp** é a consulta operacional preferencial. Ele
mostra separadamente:

- aprovação, categoria, idioma e qualidade consultados na Meta;
- automações habilitadas no ambiente;
- mensagens geradas, pendentes, aceitas, entregues, lidas, canceladas e com
  falha por template;
- taxas de entrega e leitura quando existe base para o cálculo.

Se a Meta estiver indisponível ou a WABA não estiver configurada, o painel não
deve inventar um status; as métricas locais podem continuar visíveis com o
estado externo marcado como não verificado.

Nunca salve o token da Meta em commits, prints ou mensagens de suporte.
