# Memória operacional do Agenda Fashion

> Contexto permanente para agentes de desenvolvimento.
> Atualizada em setembro de 2026.

Este arquivo deve ser lido antes de mudanças relevantes no projeto. Ele registra
decisões duráveis de produto, arquitetura, segurança e operação. Detalhes de uma
feature específica ficam nos documentos em `docs/` e no código executável.

O mapa de navegação e a classificação da documentação especializada ficam em
`docs/README.md`. Use esse índice para localizar a fonte canônica de cada domínio
e evitar criar documentos concorrentes para a mesma regra.

Em caso de divergência:

1. código executável e migrations representam o estado implementado;
2. testes representam comportamentos esperados;
3. este arquivo e `docs/` representam decisões e intenção do produto.

Uma divergência conhecida deve ser corrigida, não usada como justificativa para
presumir que a documentação antiga continua válida.

## Objetivo do produto

O Agenda Fashion (AF) é um SaaS brasileiro de descoberta e agendamento para o
mercado de beleza e estética.

O objetivo é se tornar referência no Brasil ao conectar clientes a
profissionais e negócios, facilitar descoberta e transformar interesse em
agendamentos simples, seguros e confiáveis.

O AF deve gerar valor para os dois lados do marketplace:

- profissionais e negócios precisam publicar oferta, receber agendamentos,
  reduzir trabalho manual e acompanhar crescimento;
- clientes finais precisam encontrar oferta relevante, consultar disponibilidade
  real e agendar com poucos passos.

## Entidades e contextos

Não tratar como equivalentes:

- **profissional**: pessoa que presta serviços; no modelo atual, uma conta pode
  possuir no máximo um vínculo ativo com papel `profissional`, sem impedir que a
  mesma conta também seja dona do próprio negócio;
- **negócio**: unidade operacional que possui serviços, equipe, agenda, plano e
  perfil público;
- **cliente final**: pessoa que descobre e agenda serviços, com conta ou como
  visitante conforme o fluxo permitido.

A identidade principal fica em `usuarios`. Papéis de negócio pertencem a
`usuarios_negocios.papel`, atualmente `dono` e `profissional`. Administração
global usa `usuarios_administradores`.

Uma mesma conta pode atuar em mais de um contexto. O frontend muda navegação e
apresentação conforme rota, sessão e vínculos, mas essas escolhas não substituem
a autorização do backend.

O perfil profissional pertence à identidade única da conta e é marcado por
`usuarios.perfil_profissional_ativado_em`. Cadastro com intenção profissional,
criação do próprio negócio e aceite válido de convite ativam esse perfil sem criar
uma segunda conta. A ativação por criação de negócio ou convite participa da
mesma transação lógica do vínculo correspondente. Um `Client` já existente e
seu histórico permanecem ligados ao mesmo `usuarios.id`; inativar ou remover um
vínculo profissional não desfaz o fato de que a conta possui perfil profissional.

O contexto de negócio deve ser explícito quando a rota já expressa a intenção:
`/painel/*` representa o vínculo de dona e `/profissional/*` representa o vínculo
`profissional`. O backend precisa validar o vínculo persistido correspondente;
não deve resolver uma rota profissional escolhendo silenciosamente um negócio de
dona apenas porque esse vínculo possui prioridade no contexto principal da
sessão. `GET /minha-sessao` mantém `negocio` como contexto principal para
compatibilidade e também expõe `vinculos` para clientes capazes de selecionar o
contexto correto.

## Funil principal do AF

Para aquisição e ativação profissional, acompanhar o funil real:

```text
anúncio/origem
  → cadastro profissional
  → negócio criado
  → serviço ativo
  → negócio publicado
  → primeiro agendamento válido
  → checkout iniciado
  → pagamento/assinatura
  → recorrência e retenção
```

A passagem pelos horários é observável no onboarding como diagnóstico operacional,
mas não é etapa canônica de ativação e não é requisito para o negócio estar
publicado. Ela mede que a profissional confirmou, aceitou ou personalizou uma
disponibilidade antes de seguir a jornada.

`checkout iniciado`, clique, cadastro, negócio criado e receita são fatos
diferentes. Não usar uma etapa como proxy automático de outra.

O primeiro agendamento válido é o primeiro agendamento não cancelado do
negócio. Ele mede primeira reserva válida; não confirma comparecimento nem
receita.

## Onboarding, publicação e disponibilidade

Todo novo negócio deve ser criado com os dados estruturais exigidos pelo backend
para o fluxo atual. Descrição, fotos e complemento permanecem opcionais quando o
contrato vigente assim definir.

A publicação é automática quando o negócio atende aos requisitos estruturais e
possui ao menos um serviço ativo, desde que a proprietária não tenha
despublicado o perfil manualmente.

A despublicação manual é uma intenção persistida em
`negocios.despublicado_manual_em`. Enquanto esse marcador estiver preenchido,
salvar o perfil, criar/editar/reativar serviços ou qualquer outra sincronização
automática de elegibilidade não pode republicar o negócio. Somente uma ação
explícita da proprietária para publicar novamente limpa o marcador; essa ação
continua sujeita à elegibilidade validada no backend.

**Configurar, confirmar ou personalizar horários não é gate de publicação.**
A publicação deve ser decidida pelo backend antes da tela de horários aparecer
na primeira jornada.

Ao criar o negócio, o backend inicializa uma disponibilidade padrão para a dona
inicial:

- segunda a sexta: 08:00–18:00, com pausa 12:00–13:00;
- sábado: 08:00–13:00;
- domingo: fechado.

Depois que o primeiro serviço é salvo e o backend confirma a publicação, a
interface apresenta `Horários` como terceiro momento visível da primeira
jornada. O objetivo é mostrar que o AF é uma agenda editável sem transformar a
disponibilidade em requisito de publicação.

Na confirmação rápida:

- `Confirmar horários` salva a sugestão exibida e continua;
- `Pular por agora` pula apenas a edição manual, salva a mesma sugestão e
  continua;
- `Ajustar horários` abre o editor antes do salvamento.

Se o salvamento dos horários falhar, a interface não deve avançar. Quando houver
uma intenção válida de plano pago, ela deve ser preservada durante
`Negócio → Serviço → Horários` e seguir para o checkout somente depois do
salvamento da agenda; sem intenção de plano, o fluxo segue para o painel.

`agenda_configuracoes.configurado_em` é um marcador técnico legado de que a
disponibilidade foi inicializada. Desde a migration 065 ele recebe valor já na
inicialização automática e **não representa confirmação ou salvamento manual**.
Para distinguir personalização explícita, usar `origem_horarios`,
`primeira_personalizacao_em` e `ultima_personalizacao_em`. Nenhum desses campos
deve ser usado para bloquear publicação.

`agenda_configuracoes.origem_horarios` continua separando a origem da
disponibilidade. O runtime atual cria a configuração com `padrao_af` e, no
salvamento explícito da agenda, marca a origem como `personalizado` junto dos
timestamps de personalização.

`negocios.publicacao_exige_agenda` permanece apenas por compatibilidade com
dados/migrations legados; o runtime atual não deve reintroduzir esse gate.

Depois da passagem pela agenda, a missão principal é divulgar o perfil e
conquistar o primeiro agendamento, exceto quando uma intenção de plano pago
válida conduzir ao checkout. Compartilhamento deve reutilizar os links públicos
rastreáveis existentes do AF.

A disponibilidade continua crítica para gerar slots corretos e pode ser
acompanhada como diagnóstico operacional separado.

Detalhes: `docs/ativacao-profissional-ux.md` e
`docs/ativacao-proxima-acao.md`.

## Ciclo operacional do agendamento

Agendamentos ativos usam `agendado`/ `confirmado` por compatibilidade de
runtime; o fluxo de produto trata a reserva confirmada como o estado operacional
normal antes de um terminal.

Regras duráveis:

- ausência do cliente só pode virar falta/não comparecimento após 15 minutos do
  início previsto;
- cancelamento operacional do negócio continua possível em booking ativo quando
  o atendimento não puder ocorrer ou precisar ser interrompido, com motivo
  auditável;
- reagendamento é uma operação transacional: o novo slot é validado antes da
  atualização da reserva e o booking atual é ignorado apenas na checagem do
  próprio conflito;
- serviço, preço, duração e antecedência de cancelamento permanecem snapshots do
  booking durante o reagendamento;
- após o horário previsto, o booking ainda pode ser reagendado se o atendimento
  não tiver começado e o novo início for futuro;
- `atendimento_iniciado_em`/`atendimento_iniciado_por` registram o início real
  do serviço; depois desse marco o booking não pode mais ser reagendado;
- o histórico de reagendamento preserva ator, profissional anterior/novo e
  horários anterior/novo;
- a elegibilidade profissional↔serviço é explícita em `profissional_servicos`;
- perfil público, criação de booking e troca de responsável no reagendamento
  devem usar essa mesma relação como fonte de verdade;
- a proprietária administra os serviços habilitados de cada integrante da equipe;
- novos serviços são habilitados automaticamente apenas para a proprietária que os
  criou; novas profissionais entram sem serviços até configuração explícita;
- o backfill da migration 081 materializa os pares legados para preservar o
  comportamento já existente antes da introdução da elegibilidade explícita;
- criação e reagendamento serializam a validação de elegibilidade com a edição da
  matriz para impedir corrida entre desabilitação e confirmação da reserva.
- dias, faixas e novos bloqueios manuais pertencem ao vínculo
  profissional–negócio; conflitos de bookings continuam globais por profissional;
- o início previsto de cada booking possui instante canônico em
  `agendamentos.inicio_previsto_em` (`TIMESTAMPTZ`) e snapshot do IANA usado
  em `fuso_horario_snapshot`; comparações temporais e conflitos globais entre
  negócios usam o instante absoluto, e a derivação de slots converte reservas
  ocupadas para o IANA do negócio consultado sem reinterpretar o instante
  histórico;
- bloqueios legados sem `negocio_id` são tratados como indisponibilidade global
  somente para compatibilidade e não podem ser removidos silenciosamente por um
  negócio específico;
- booking visitante recebe capability HMAC e um link seguro com a capability no
  fragmento `#token=`; o link autoriza somente consulta/cancelamento daquele
  booking e nunca substitui o cutoff;
- confirmação e cancelamento direto registram comunicação transacional e
  notificação interna para a equipe; falha de entrega pós-commit não pode reverter
  o estado principal do booking;
- `CANCELAMENTO_SOLICITADO` é estado legado proibido para novos fluxos. Migração
  automática só decide quando a evidência persistida é suficiente; casos passados
  ambíguos ficam em revisão auditável até resolução terminal.

O `client_id` interno de `agendamentos` aponta para `clientes`; o
`cliente_id` legado continua sendo apenas o vínculo opcional com uma conta
autenticada em `usuarios`. Visitantes também possuem Client interno sem ganhar
credencial de login.

## Planos e monetização

O plano gratuito é uma oferta ativa e deve entregar valor real antes de qualquer
pressão por upgrade.

| Plano | Valor mensal | Agendamentos/mês | Profissionais | Serviços |
| --- | ---: | ---: | ---: | ---: |
| Grátis | R$ 0,00 | 10 | 1 | 2 |
| Autônoma | R$ 49,90 | 20 | 1 | 4 |
| Studio | R$ 99,90 | 30 | 1 | 10 |
| Salão | R$ 199,90 | Ilimitados | 5 | Ilimitados |

O slug interno do plano gratuito permanece `inicial` por compatibilidade.
Limites de plano, preço e elegibilidade são regras do backend.

Convites de equipe preservam a intenção da profissional mesmo quando o negócio
não possui capacidade no plano: o convite pode ser aceito com vínculo
`profissional` inativo e `motivo_inatividade = 'aguardando_vaga_plano'`.
Esse estado não consome limite, não concede workspace, não recebe agendamentos
e não participa da matriz profissional-serviço. Quando houver capacidade, a
dona escolhe explicitamente quem ativar; a ativação revalida plano, contexto
ativo e eventual vínculo profissional ativo em outro negócio dentro do backend.

Downgrade de plano nunca remove a proprietária, vínculos ou reservas existentes.
Quando o novo limite de profissionais fica abaixo da equipe ativa, o backend
inativa automaticamente apenas profissionais não proprietárias excedentes,
começando pelas ativações mais recentes. Esses vínculos usam
`motivo_inatividade = 'excedente_limite_plano'`; `ativado_em` registra a
ativação mais recente para manter a ordem de downgrade determinística.

Planos pagos usam checkout por PIX. O backend só permite iniciar checkout pago
para a proprietária ativa de um negócio ativo e já publicado; esconder ou
redirecionar o botão no frontend não substitui essa validação. A disponibilidade
manual não é um gate financeiro: a primeira jornada pode ordenar Horários antes
do checkout, mas o backend de billing usa a publicação persistida como condição
de elegibilidade.

Retorno do navegador não confirma pagamento. A ativação do plano depende da
confirmação financeira autenticada e idempotente do Asaas. Estados externos do
provedor são preservados para auditoria, enquanto a experiência do produto
normaliza situações relevantes como `FALHA_DE_PAGAMENTO` e
`CHECKOUT_EXPIRADO`. Checkout inicial expirado não libera benefício pago e
falha de renovação pode retornar temporariamente o negócio ao plano gratuito sem
apagar dados.

Dentro de `FALHA_DE_PAGAMENTO`, a conta distingue cobrança atrasada/recuperável
de estorno ou disputa. Quando uma cobrança recorrente do Asaas fornece
`invoiceUrl`, o AF pode persistir e oferecer essa fatura à proprietária somente
após validar HTTPS e domínio oficial `asaas.com`; abrir a fatura não confirma
pagamento. A reativação continua dependendo de webhook financeiro válido.

Na UX da conta, a ação de recuperação deve ser apresentada como
**Regularizar pagamento**, sem transformar o nome do provedor em protagonista da
interface. Quando a regularização abrir uma página hospedada externamente, a UI
deve informar de forma neutra que a proprietária será direcionada para um
ambiente seguro de pagamento.

Cancelar a renovação não encerra imediatamente o período já quitado. Enquanto a
assinatura cancelada ainda estiver `ativo = TRUE`, a data deve ser apresentada
como **acesso até**, nunca como próxima cobrança. No fim do período, o plano
retorna ao gratuito e os dados do negócio permanecem preservados. O fim do
período pago não depende de nova navegação da proprietária: os background
workers reconciliam cancelamentos vencidos usando a mesma operação transacional
do entitlement e registram `ACESSO_PAGO_ENCERRADO` de forma idempotente.

Um negócio pode possuir no máximo uma cobrança PIX pendente de contratação ou
upgrade por vez, independentemente do plano escolhido. Trocar de plano antes do
pagamento não deve criar cobranças concorrentes. A tela de assinatura deve
separar explicitamente a assinatura/plano atualmente em uso de qualquer upgrade
pendente.

Mais detalhes: `docs/planos.md`, `docs/checkout-idempotente.md` e documentos de
webhook financeiro.

## Arquitetura atual

- Runtime: Node.js 22.
- Backend: Express 5, JavaScript CommonJS.
- Banco: PostgreSQL via `pg`.
- Frontend: React 19, React Router 7, Vite 7 e CSS.
- Backend em camadas: routes → controllers → services → repositories →
  PostgreSQL.
- O teste de fronteiras arquiteturais impede acesso direto ao banco em routes e
  controllers e mantém apenas a exceção de infraestrutura do readiness para
  SQL direto em services.
- O domínio financeiro separa registro, conta, webhooks e processamento de
  pagamentos; persistência de assinaturas fica em repositories.
- Autenticação: JWT em cookie `HttpOnly`, bcrypt e Google Identity.
- Imagens: Busboy, validação de conteúdo e Cloudinary.
- Pagamentos: Asaas.
- Notificações: WhatsApp Cloud API oficial da Meta.
- E-mail transacional: Resend onde configurado.
- Marketing: GA4, Google Ads, Meta Ads/CAPI, TikTok Ads e Pinterest Ads conforme
  integrações documentadas.
- Testes: Jest/Supertest/PostgreSQL, Vitest/Testing Library e Playwright.
- CI/CD: GitHub Actions e Railway.
- Deploy: migrations antes da aplicação e healthcheck em `/health/ready`.

O frontend é uma única aplicação React. As rotas privadas de negócio continuam
entrando pela resolução contextual de `WorkspaceLayout`: vínculos de dona são
delegados para `OwnerShell` com design system `--owner-*`, enquanto vínculos de
profissional são delegados para `ProfessionalShell` com design system
`--professional-*`. Os dois shells carregam CSS por contexto e compartilham
apenas primitives neutras quando isso reduz duplicação. `/admin/*` usa
`AdminLayout` + `AdminShell` próprios.

Detalhes técnicos: `docs/arquitetura.md`, `docs/frontend-estilos.md` e
`docs/ux-contextos-visuais.md`.

## Frontend e UX

Priorizar clareza da tarefa e experiência mobile, especialmente Safari/WebKit.

A identidade visual do AF é rosa, branca e grafite, acolhedora e ligada ao
universo de beleza. A marca deve permanecer reconhecível, mas cada contexto pode
ter densidade e composição próprias.

O Admin funciona como um Command Center operacional com design system próprio.
O contexto da dona possui workspace de gestão próprio. O contexto profissional
possui shell de rotina própria, com navegação curta focada em agenda, horários e
conta. Essas diferenças visuais não alteram os contratos de autorização do
backend.

Ao alterar uma interface, considerar:

- carregamento;
- estado vazio;
- erro;
- sucesso;
- sessão expirada;
- permissões;
- responsividade;
- contraste e foco;
- conteúdo coberto por elementos `fixed`/`sticky`;
- comportamento em WebKit.

Quando houver apenas um profissional elegível em um fluxo de agendamento, não
exigir uma escolha sem utilidade.

Os arquivos oficiais de marca ficam em `frontend/src/assets/brand/`; evitar
substitutos improvisados.

## Analytics, aquisição e growth

Avaliar crescimento pelo funil completo, não apenas por CTR, CPC, CPM, cliques
ou cadastros brutos.

Métricas prioritárias incluem:

- custo por profissional ativado;
- taxa de ativação até primeiro agendamento;
- custo por assinante quando houver base financeira confiável;
- conversão para pago;
- recorrência e retenção;
- receita e LTV quando houver definição e dados suficientes.

Diferenciar Google Ads, Meta Ads, TikTok Ads, Pinterest Ads, orgânico e outras
origens conforme a evidência disponível.

Atribuição incompleta não deve ser corrigida por suposição. UTM, click IDs,
vínculos externos e evidência bruta são preservados para auditoria. Tráfego sem
evidência suficiente permanece classificado como incompleto/sem evidência em
vez de ser promovido artificialmente para campanha oficial ou orgânico.

CAC, ROAS e decisões de orçamento dependem de cobertura, custo, maturidade e
amostra adequados. Ausência de assinatura, isoladamente, não prova que aquisição
freemium falhou.

Conversão do perfil deve usar visitas externas ao negócio como denominador e
agendamentos reais não cancelados como resultado. Eventos de navegador são
telemetria diagnóstica e não substituem a tabela `agendamentos`.

Eventos críticos do ciclo de booking (`booking_created`,
`booking_rescheduled`, `booking_cancelled`, `booking_completed` e
`booking_no_show`) são fatos de domínio emitidos pelo backend a partir do
estado persistido e gravados em `analytics_eventos` com
`origem='backend'`. Eles usam `event_uuid` como `event_id` externo,
`occurred_at`, IDs de profissional/negócio/Client/agendamento/serviço
aplicáveis e atores humanos padronizados. Essas gravações participam da mesma
transação lógica da mutação do booking para evitar evento sem estado ou estado
crítico sem evento. Telemetria homônima do frontend permanece diagnóstica e não
deve ser somada a esses fatos transacionais.

Durante a migração de Analytics, `eventos_produto` e o Analytics V2 first-party
podem coexistir. Eventos equivalentes devem ser reconciliados em uma janela
comparável, nunca somados como se fossem fontes independentes de verdade. A
retirada do pipeline legado exige estabilidade observada, investigação de
divergências e revisão de todas as dependências restantes.

Métricas de clientes únicos, recorrência e origem do cliente usam
`agendamentos.client_id` como identidade. `cliente_id` legado e telefone não
devem ser usados para fundir visitantes sem evidência de identidade persistida.

Na monetização, distinguir intenção de checkout, pagamento confirmado, assinatura
efetivamente ativa, reembolso/reversão e receita. Enquanto o schema financeiro
não persistir valor e data econômica exatos de estornos parciais e chargebacks,
o Admin não deve chamar uma subtração aproximada de "receita líquida". Expor
separadamente receita atualmente válida e o valor integral das cobranças
afetadas por reversão/disputa.

Na leitura financeira do Admin, o primeiro pagamento cronológico de um negócio
pago representa conversão inicial; pagamentos válidos posteriores da mesma
assinatura representam renovação; o primeiro pagamento de uma assinatura paga
posterior do mesmo negócio representa mudança de plano. Mudança de plano não
deve ser chamada automaticamente de expansão porque pode ser upgrade, downgrade
ou troca lateral. A coorte de renovação usa cobranças posteriores à primeira da
mesma assinatura cujo vencimento já ocorreu. Atraso recuperável, cancelamento da
próxima renovação e encerramento do acesso pago são fatos distintos. Cobrança
recuperada exige pagamento atualmente válido e evidência processada de atraso
anterior. Essas leituras são descritivas e não definem churn, LTV ou payback
oficiais sem contrato e maturidade adicionais.

Transições pagas novas devem ser registradas também em `assinatura_eventos`,
como fatos append-only do domínio. A tabela distingue conversão inicial,
renovação confirmada, reativação paga, mudança de plano, atraso recuperável,
recuperação, reversão financeira, cancelamento da renovação e encerramento do
acesso pago. Cada efeito usa chave idempotente estável e participa da mesma
transação local da mudança que representa. `webhook_eventos` continua sendo a
fila/auditoria do provedor; `assinatura_eventos` representa o significado de
produto do AF. Não fazer backfill especulativo quando o histórico antigo não
provar a transição.

Conversões de assinatura para provedores de mídia devem ser idempotentes por
assinatura e pagamento financeiro. Webhooks repetidos da mesma cobrança não
duplicam entrega, mas um pagamento posterior que se torne o primeiro válido após
invalidação do anterior precisa poder gerar uma nova entrega.

As integrações administrativas de custos são somente leitura no escopo atual
documentado e não devem criar, editar, pausar ou excluir campanhas sem uma nova
decisão de produto e segurança.

Detalhes ficam em `docs/marketing-attribution.md`, `docs/marketing-sync-ga4.md`,
`docs/analytics-pipeline-reconciliation.md` e demais documentos de marketing.

## Conteúdo e comunicação

A estratégia editorial do AF deve acompanhar o estado real do produto e o funil
de profissionais, negócios e clientes. Conteúdo não deve anunciar roadmap,
mockup, interface gerada por IA ou comportamento antigo como se já estivesse
implementado.

Cada peça relevante deve ter público, etapa do funil, hipótese de comunicação,
CTA e forma de medição definidos. Curtidas, visualizações, CTR, CPC ou cadastro
isolado não substituem primeiro agendamento válido, assinatura, recorrência ou
retenção quando esses forem os resultados que a peça pretende influenciar.

Aprendizados de conteúdo só se tornam regras permanentes após evidência
suficiente e repetida. Resultado de um único post, campanha temporária ou
tendência passageira não pertence à memória operacional.

Para criativos com IA generativa, créditos devem ser tratados como orçamento de
produção. Roteiro, referências, prompt e plano de edição devem ser revisados
antes da geração paga. Texto, números, métricas e interface crítica não devem
depender de vídeo generativo quando puderem ser compostos com precisão na
pós-produção ou capturados do produto real.

Detalhes: `docs/estrategia-conteudo.md` e `docs/runway-criativos.md`.

## Machine Learning

O primeiro caso de Machine Learning do AF é a previsão de risco de falta em
agendamentos. A implantação é incremental: fundação de dados, validação de
maturidade, baseline reproduzível, previsão em modo shadow e somente depois um
experimento de intervenção não punitiva.

Regras duráveis:

- `falta` e `realizado` são os únicos rótulos do primeiro modelo; cancelamento,
  booking criado e passagem do horário não inventam comparecimento;
- features precisam representar somente informações disponíveis no instante da
  previsão e não podem usar desfechos futuros;
- a base de ML não copia nome, telefone, WhatsApp, e-mail, observações ou texto
  livre;
- visitantes não são unidos silenciosamente por telefone para formar histórico;
- ML roda fora do caminho crítico do agendamento e uma falha sua não pode
  bloquear criação, reagendamento ou lifecycle;
- antes do primeiro baseline, a maturidade precisa ser auditada globalmente e
  por negócio, tipo de cliente e janela temporal para detectar concentração,
  baixa cobertura e mudança de distribuição;
- todo modelo começa em modo shadow e precisa de versão, período de treino,
  métricas e features auditáveis;
- score não pode cancelar, recusar, cobrar, bloquear, reordenar ou expor um
  rótulo negativo sobre o cliente;
- qualquer intervenção futura precisa demonstrar redução de faltas sem piorar
  cancelamentos, reclamações, privacidade ou entregabilidade.

Detalhes: `docs/machine-learning-no-show.md`.

## WhatsApp e automações

O WhatsApp complementa o produto; o agendamento não depende de atendimento
manual pelo canal.

Mensagens para clientes, avisos operacionais para profissionais e orientações de
ativação/marketing possuem finalidades e consentimentos próprios.

Regras duráveis:

- consentimento deve ser respeitado e revalidado conforme o fluxo;
- opt-out deve interromper a categoria correspondente, e pedidos globais devem
  aplicar a regra global implementada;
- mensagens e webhooks precisam ser idempotentes;
- filas devem tolerar retry e concorrência sem duplicar efeitos;
- no encerramento do processo, schedulers devem parar de aceitar novos ciclos e
  o servidor deve aguardar workers ativos antes de fechar o pool do banco;
- tokens e payloads sensíveis não aparecem em logs;
- aprovação de template é estado externo e deve ser consultada quando uma
  decisão depender dela.

Detalhes: `docs/whatsapp-automatico.md`.

## Encerramento e privacidade operacional

Negócio encerrado entra em estado terminal normal de arquivamento:
`ativo = FALSE`, `publicado = FALSE` e `arquivado_em` preenchido. O
arquivamento exige ausência de bookings operacionais e de acesso pago, renovação,
checkout ou operação financeira pendente; convites ainda pendentes tornam-se
não aceitáveis, sem apagar histórico.

Encerramento definitivo de conta é lógico quando referências históricas precisam
ser preservadas. Profissional com booking operacional atribuído não pode encerrar
definitivamente a conta. Proprietária só encerra a identidade depois que o
negócio puder ser arquivado com segurança.

Conta de cliente pode ser desativada sem cancelar automaticamente reservas.
Enquanto houver booking operacional, o `Client` e os dados mínimos permanecem,
e o AF entrega um acesso por capacidade criptográfica específica da reserva para
consulta/cancelamento conforme o cutoff. Essa credencial não deve aparecer em
query de API ou logs.

Detalhes: `docs/encerramento-privacidade.md`.

## Segurança e privacidade

Estas regras são obrigatórias:

1. autenticação e autorização são validadas no backend;
2. isolamento entre negócios não depende de IDs enviados pelo navegador;
3. preços, limites e regras financeiras não são confiados ao frontend;
4. segredos nunca aparecem no Git, frontend ou logs;
5. webhooks e operações financeiras são autenticados e idempotentes;
6. dados pessoais só são expostos quando necessários para a finalidade da
   operação;
7. redirecionamento ou botão oculto no React não substitui controle de acesso.

Encerramento e privacidade seguem um fluxo de desativação/arquivamento, não de
deleção física indiscriminada:

- negócio só pode ser arquivado pela proprietária quando não houver booking
  ativo nem pendência de acesso pago, checkout ou operação financeira;
- arquivar remove o negócio da descoberta, desativa seus vínculos operacionais,
  cancela convites pendentes e preserva históricos necessários;
- conta profissional não pode ser encerrada definitivamente enquanto possuir
  booking ativo atribuído;
- desativar conta de cliente não cancela reservas existentes: o `Client`
  interno e os dados mínimos operacionais permanecem, com acesso HMAC específico
  por booking para consulta e cancelamento enquanto a política permitir;
- conta proprietária só pode ser encerrada definitivamente depois que o negócio
  puder ser arquivado com segurança na mesma transação lógica;
- `desativado_em`, `encerrado_definitivo_em` e `arquivado_em` distinguem
  perda de acesso, encerramento da identidade operacional e encerramento do
  negócio sem apagar evidências sujeitas a retenção.

Detalhes: `docs/encerramento-privacidade.md`.

## Engenharia e banco

Antes de alterar algo:

1. investigar a causa raiz;
2. entender o fluxo completo;
3. avaliar impacto em frontend, backend, banco, segurança, integrações e testes;
4. preferir mudanças pequenas, modulares e reversíveis;
5. preservar comportamentos que já funcionam;
6. criar ou atualizar testes proporcionais ao risco;
7. revisar o diff antes de considerar a alteração pronta.

SQL novo pertence a repositories, não a routes/controllers e, salvo legado em
migração, não deve ser introduzido em services.

Configuração obrigatória do runtime é validada centralmente no startup. Uma
integração habilitada não pode iniciar com credenciais parciais.

E-mail, Google Measurement, GA4 Data API, Meta, custos de mídia, TikTok,
Pinterest, Copilot e WhatsApp seguem contratos condicionais no validador
central: flag ativa exige o conjunto completo de credenciais.

Os workers podem continuar no processo web ou rodar em processo dedicado com
`npm run worker`. O web só deve receber `BACKGROUND_WORKERS_ENABLED=false`
depois que o processo dedicado estiver implantado e saudável.

O diagnóstico administrativo `/admin/saude/operacional` expõe apenas métricas
seguras de processo, execução dos workers e atraso das filas; nunca credenciais
ou payloads de clientes.

Toda mudança de banco exige migration nova. Migration já aplicada não é
reescrita para corrigir o passado.

Recuperação do PostgreSQL crítico tem meta de RPO ≤ 1 hora e RTO ≤ 4 horas.
Enquanto não houver evidência de PITR/backup recorrente e de restore controlado
medido, o AF não declara essas metas como comprovadas. Alterar backup, PITR,
retenção ou infraestrutura de produção exige autorização explícita. O runbook e
a condição de saída ficam em `docs/backup-recovery.md`.

Operações críticas que alteram múltiplas tabelas devem usar transação quando a
atomicidade fizer parte do contrato.

Não introduzir tecnologia, camada ou reescrita ampla apenas por modernização.

## Testes, merge e deploy

Mudanças relevantes devem executar validações proporcionais ao risco. O Quality
Gate atual cobre lint, build, testes frontend, migrations, Jest/PostgreSQL,
audits e Playwright aplicável.

Mudanças em caminhos públicos críticos de performance (home, catálogo, perfil,
componentes/estilos relacionados e scripts de medição) também disparam o
`Performance QA` no pull request para `main`. Essa workflow permanece
read-only, mede API p95 contra o alvo representativo configurado e mede o LCP da
build da própria branch. O disparo manual continua disponível para revalidação
operacional.

Fluxo esperado:

```text
branch
  → PR
  → Quality Gate
  → revisão do diff
  → merge autorizado
  → deploy Railway
  → migrations
  → /health/ready
  → smoke test e logs
```

Não fazer push, merge, deploy ou alteração destrutiva sem solicitação explícita
do usuário.

Um deployment `SUCCESS` não substitui validação do comportamento modificado.

Detalhes: `docs/deploy-seguro.md` e `docs/dependency-security.md`.

## Prioridades de decisão

Ao comparar soluções, priorizar nesta ordem:

1. confiabilidade dos agendamentos;
2. segurança e privacidade;
3. aquisição e ativação de profissionais;
4. conversão, retenção e receita;
5. experiência mobile de clientes e profissionais;
6. manutenção e escalabilidade;
7. melhorias visuais e otimizações secundárias.

Funcionalidade nova deve resolver um problema identificável do produto, indicar
qual etapa do funil pretende melhorar e como o resultado será observado.

## Como manter esta memória

Atualizar `AGENTS.md` quando uma decisão durável mudar produto, arquitetura,
integrações, infraestrutura, segurança, analytics, planos ou regras críticas.

Não usar este arquivo para métricas temporárias, resultado momentâneo de
campanha, estado de aprovação externo ou detalhes de layout que podem mudar sem
alterar o contrato do produto.

Documentação especializada deve concentrar detalhes de implementação e
operação. Ao mudar uma regra permanente, atualizar os documentos afetados no
mesmo conjunto de mudanças sempre que possível.
