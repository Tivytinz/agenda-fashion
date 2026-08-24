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
mensagem por negócio e data, e a regra de elegibilidade impede que
os dois sejam enviados para o mesmo negócio no mesmo dia.

Para visitantes, as mensagens para a cliente só são criadas quando ela marca o
consentimento no formulário do agendamento. Para clientes com conta, vale a
preferência de mensagens escolhida no cadastro e disponível em **Minha conta >
Mensagens no WhatsApp**. O agendamento continua funcionando quando ela não
autoriza.

Contas existentes são migradas como autorizadas e permanecem assim até a
cliente desativar a preferência. A fila consulta novamente essa preferência
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

Para habilitar os lembretes diários dos negócios, execute:

```bash
node scripts/executar-migration.js database/migrations/044_lembretes_diarios_whatsapp_negocio.sql
```

A migration adiciona o consentimento de Marketing à conta e amplia a fila para
mensagens ligadas ao negócio, com idempotência por negócio, tipo e dia.

Para habilitar a preferência de mensagens das clientes, execute:

```bash
node scripts/executar-migration.js database/migrations/046_notificacoes_whatsapp_clientes.sql
```

A migration adiciona o consentimento à conta e autoriza os cadastros já
existentes. Novos cadastros respeitam a escolha explícita feita no formulário.

Para manter as métricas administrativas eficientes conforme a fila cresce,
execute também:

```bash
node scripts/executar-migration.js database/migrations/048_metricas_admin_whatsapp.sql
```

A migration cria um índice por data e tipo de mensagem; ela não altera nem
remove registros existentes.

Depois, aplique a migration de consentimento operacional e auditoria:

```bash
node scripts/executar-migration.js database/migrations/052_consentimento_whatsapp_meta.sql
```

Ela separa os avisos operacionais do marketing e registra a origem, versão do
texto, telefone, data e eventual cancelamento do consentimento.

Para ativar respostas idempotentes aos quebra-gelos, aplique também:

```bash
node scripts/executar-migration.js database/migrations/053_respostas_conversa_whatsapp.sql
```

A migration registra somente o `wamid`, o telefone e a intenção reconhecida.
Mensagens livres que não correspondem aos quebra-gelos ou ao descadastro não
são armazenadas nessa tabela.

## Templates da Meta

Crie os seis templates transacionais na categoria `UTILITY`, idioma
`Portuguese (BR)`. Os dois templates de ativação descritos depois pertencem à
categoria `MARKETING`. Os nomes e a ordem das variáveis precisam ser exatamente
os mesmos usados pelo backend.

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

Se o modelo já estiver ativo na Meta com a frase promocional anterior, atualize
o conteúdo no WhatsApp Manager e aguarde a nova aprovação antes de trocar o
modelo usado em produção.

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

Destinatário: dono de negócio que autorizou o lembrete diário e permanece sem
serviços ativos 24 horas depois do cadastro.

O modelo não possui variáveis. Ele deve direcionar para:
`https://app.agendafashion.com.br/painel/servicos/novo`.

Inclua também um botão de resposta rápida **Parar marketing**, com payload
`PARAR_MARKETING`, para que o webhook aplique o descadastro sem exigir login.

### `lembrete_divulgar_negocio`

Categoria: `MARKETING`.

Destinatário: dono de negócio publicado, com ao menos um serviço ativo e que
autorizou o lembrete diário.

Ordem das variáveis:

1. nome do dono;
2. nome do negócio;
3. URL pública completa do negócio.

Inclua um botão de resposta rápida **Parar marketing**, com payload
`PARAR_MARKETING`.

O conjunto de orientações pode ser enviado no máximo três vezes, com intervalo
mínimo de três dias, a partir das 10h no fuso do negócio. Os limites são configurados por
`WHATSAPP_BUSINESS_REMINDER_MAX_SENDS`,
`WHATSAPP_BUSINESS_REMINDER_INTERVAL_DAYS` e
`WHATSAPP_BUSINESS_REMINDER_HOUR`.

## Variáveis do Railway

Use `docs/whatsapp.env.example` como referência. As obrigatórias para ativação
são:

```text
WHATSAPP_NOTIFICATIONS_ENABLED=true
WHATSAPP_ACCESS_TOKEN=
WHATSAPP_BUSINESS_ACCOUNT_ID=
WHATSAPP_PHONE_NUMBER_ID=
WHATSAPP_BUSINESS_ACCOUNT_ID=
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

Use um token de acesso permanente de usuário do sistema na ativação final.
O processador recusa iniciar se as credenciais da API ou os segredos do webhook
estiverem ausentes.

Não trate a aprovação como uma informação estática da documentação. Confirme
os oito modelos em **Administração > WhatsApp**, que cruza os nomes e o idioma
configurados com `/{WHATSAPP_BUSINESS_ACCOUNT_ID}/message_templates`. O token
usado nessa consulta precisa ter a permissão `whatsapp_business_management`.
O identificador da conta do WhatsApp (WABA) não é o ID do número de telefone e
pode ser diferente do ID geral do Gerenciador de Negócios.

Ative o lembrete da profissional somente depois que
`lembrete_agendamento_profissional` aparecer como ativo. Mantenha
`WHATSAPP_NOTIFICATIONS_ENABLED=true` em produção. Para um teste controlado:

Os lembretes diários também começam desativados. Ative cada flag somente após
o respectivo modelo aparecer como ativo na Meta. Apenas contas com
consentimento explícito entram na rotina. O consentimento pode ser dado no
cadastro profissional ou pelo convite destacado no painel; **Minha conta**
mantém o controle permanente para interromper os envios. Contas antigas sem
consentimento não são ativadas silenciosamente: recebem o convite no painel
para que a autorização fique comprovável. Desativar a opção cancela a
elegibilidade imediatamente; mensagens ainda pendentes são invalidadas antes
do envio. Respostas `SAIR`, `PARAR` e `STOP` também cancelam o marketing e são
registradas pelo webhook.

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

## Quebra-gelos e respostas automáticas

Configure exatamente estes quatro quebra-gelos no número oficial:

1. `Como funciona o Agenda Fashion?`;
2. `Quero criar minha agenda online`;
3. `Quais são os planos disponíveis?`;
4. `Preciso de ajuda`.

Quando a flag `WHATSAPP_CONVERSATION_AUTOREPLIES_ENABLED=true` estiver ativa,
o webhook normaliza acentos e pontuação, reconhece esses textos e envia uma
resposta livre dentro da janela de atendimento iniciada pela própria pessoa.
O envio não depende de consentimento de marketing porque responde a uma ação
solicitada no chat. Outros textos não recebem resposta automática.

Cada mensagem recebida é deduplicada pelo `wamid`, impedindo resposta repetida
se a Meta reenviar o mesmo evento. O webhook também confere o
`WHATSAPP_PHONE_NUMBER_ID` antes de responder, evitando que uma mensagem de
outro número da mesma conta seja tratada pelo número do AF.

Depois do deploy e das migrations:

1. mantenha a flag desativada durante o primeiro healthcheck;
2. teste o webhook e as quatro opções com um WhatsApp que nunca conversou com
   o número do AF;
3. altere `WHATSAPP_CONVERSATION_AUTOREPLIES_ENABLED=true`;
4. repita os quatro testes e confira os registros de entrega.

## Consulta operacional

O painel **Administração > WhatsApp** é a consulta operacional preferencial.
Ele mostra separadamente:

- aprovação, categoria, idioma e qualidade consultados na Meta;
- automações realmente habilitadas nas variáveis do ambiente;
- mensagens geradas, pendentes, aceitas, entregues, lidas, canceladas e com
  falha por template;
- taxa de entrega sobre mensagens aceitas e taxa de leitura sobre mensagens
  entregues.

Se a Meta estiver indisponível ou a WABA não estiver configurada, o painel não
inventa um status: exibe **Não verificado** e mantém as métricas locais do banco
visíveis. A integração administrativa é somente leitura e não altera modelos.

Para inspeção direta no banco:

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
