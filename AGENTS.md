# Memória operacional do Agenda Fashion

> Contexto permanente para agentes de desenvolvimento.

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

## Princípios de produto e experiência

A direção canônica está em `docs/principios-produto.md`. O `AGENTS.md` mantém
somente os princípios que precisam orientar qualquer decisão transversal:

1. **Simplicidade é o mais alto nível de sofisticação:** reduzir esforço e
   escolhas inúteis sem remover informação, controle, acessibilidade ou
   segurança.
2. **Clareza em cada passo:** deixar evidente contexto, estado, consequência e
   próxima ação.
3. **Elegância com propósito:** preservar a identidade rosa, branca e grafite,
   acolhedora e ligada à beleza, sem decoração que prejudique a tarefa.
4. **Confiança antes de conveniência:** agenda, preço, disponibilidade, sessão e
   permissões refletem estado persistido e validação real.
5. **Funcionar na rotina real:** mobile e Safari/WebKit são prioritários, com
   acessibilidade, responsividade e recuperação de erro.
6. **Entregar valor antes de pedir mais:** o Grátis precisa permitir experiência
   real de valor; upgrade aparece por necessidade contextual e escolha explícita.
7. **Automatizar com controle:** automação e IA poupam trabalho sem retirar
   consentimento, autonomia ou autoridade das regras determinísticas/backend.
8. **Evoluir por problemas e resultados reais:** funcionalidades precisam resolver
   um problema identificável e ser avaliadas por evidência proporcional.
9. **O limite é o sucesso:** a ambição do AF é medida pelo sucesso real de
   clientes, profissionais e negócios, não por volume de features.
10. **Fortalecer mulheres empreendedoras e impulsionar seus negócios:** orientar
    crescimento com autonomia, respeito e sem promessas de faturamento.
11. **Manter cada negócio nos trilhos do crescimento:** indicar uma próxima ação
    útil por vez, conectando organização, divulgação, primeiro agendamento,
    recorrência, retenção e monetização.

Emojis nativos fazem parte da identidade visual. Não padronizar sua aparência
com imagens, fontes ou sprites; sobrancelhas e cílios permanecem as exceções com
ícones próprios por não possuírem emoji Unicode específico. A logomarca oficial
continua sendo asset da marca. Detalhes de representação e acessibilidade ficam
em `docs/principios-produto.md` e `docs/ativacao-profissional-ux.md`.

Orientações do produto devem usar dados reais: reservas não canceladas não viram
atendimentos ou receita por inferência; amostra insuficiente não autoriza
oportunidade analítica inventada; despublicação manual não pode ser tratada como
cadastro incompleto nem revertida automaticamente.

Detalhes operacionais de formulários, idempotência, mídia, recuperação por GET,
guards de saída, concorrência e contexto de negócio pertencem a
`docs/frontend-formularios-estado-api.md`, `docs/contexto-negocio.md`,
`docs/ativacao-profissional-ux.md` e `docs/frontend-seguranca.md`.

## Integração contínua e merge

Mudanças preparadas por agentes devem permanecer em pull request draft até existir
autorização explícita do usuário para integrar. Marcar a PR como pronta para revisão
significa que essa autorização já foi dada e permite que o workflow habilite
auto-merge por squash. Os gates obrigatórios de CI e as regras de proteção da
branch continuam sendo condição de integração: autorização não substitui checks,
e falha ou cancelamento não deve ser contornado por merge forçado.

## Domínio público canônico

A origem pública oficial do Agenda Fashion é:

```text
https://agendafashion.com.br
```

Site público, descoberta, autenticação e áreas operacionais continuam na mesma
aplicação React e no mesmo domínio; os contextos são separados por rota, sessão
e autorização, não por subdomínio.

`app.agendafashion.com.br` é apenas host legado de compatibilidade. Navegações
HTML GET/HEAD recebidas nele devem redirecionar permanentemente para a mesma rota
e query no domínio canônico quando `PUBLIC_APP_URL` estiver apontando para a
origem oficial. APIs, webhooks e chamadas não HTML não devem ser forçados por
esse redirect para não quebrar integrações durante a transição.

`www.agendafashion.com.br` é alias de entrada e segue o mesmo redirecionamento
HTML para o domínio raiz. DNS, certificado e vínculo dos aliases com o serviço
de produção precisam permanecer funcionais: um redirect no Express não resolve
um host que retorna erro antes de alcançar a aplicação. Mudanças nesses vínculos
seguem o runbook de domínios em `docs/deploy-seguro.md`.

`agenda-fashion-production.up.railway.app` é endereço de infraestrutura e não
deve ser divulgado como URL de produto.

Backend e frontend devem manter `PUBLIC_APP_URL` e `VITE_PUBLIC_APP_URL`
alinhados em `https://agendafashion.com.br`. A allowlist de CORS e callbacks
OAuth de produção também devem usar a origem canônica, salvo compatibilidade
temporária explicitamente justificada.

A sessão de produção usa cookie `__Host-` host-only. Por isso, a migração do
host legado para o domínio raiz pode exigir uma autenticação única novamente;
não ampliar o `Domain` do cookie apenas para compartilhar sessão entre hosts.

## SEO e descoberta pública

A home e as páginas públicas deliberadamente indexáveis devem entregar no HTML
server-side título, descrição, canonical e metadados sociais apontando para a
origem pública canônica. A home também publica dados estruturados factuais de
`Organization` e `WebSite`; não adicionar avaliações, preços ou outros dados
estruturados que não existam como fatos confiáveis do produto.

Favicons e ícones de instalação usados por navegadores e crawlers devem possuir
URLs públicas estáveis, sem depender de caminhos internos de `src/`. O sitemap
continua refletindo somente oferta pública real, e páginas sem oferta válida não
devem ser criadas apenas para capturar palavras-chave.

`lastmod` do sitemap só deve ser emitido quando houver uma data válida e factual
de atualização. Ausência de data não vira época Unix nem data do request/deploy;
a URL continua no sitemap, sem esse campo. Entradas repetidas preservam a data
válida mais recente.

`robots.txt` controla rastreamento, não deve ser usado como substituto de
`noindex`. Rotas HTML que precisam ficar fora do índice e são acessíveis sem
autenticação devem permanecer rastreáveis o suficiente para o crawler observar
a diretiva `noindex`. Áreas operacionais e URLs sensíveis sem valor para busca
podem continuar bloqueadas de rastreamento, mantendo autorização real no
backend como controle de segurança.

O perfil público pode embutir no HTML um bootstrap inicial para reduzir o caminho crítico de renderização, mas esse payload deve ser montado por DTO/whitelist explícita de campos públicos e serializado com escape seguro para contexto HTML. O bootstrap deve incluir os dados necessários para renderizar negócio, serviços e profissionais sem estado parcial; a revalidação posterior não pode apagar conteúdo válido já exibido por falha transitória. Validações autoritativas de disponibilidade, plano, autorização e criação de agendamento permanecem no backend e nunca podem depender desse bootstrap.

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
global usa `usuarios_administradores`, com papel único `admin`. Papéis legados
não devem ser reintroduzidos nem usados para conceder permissões.
A matriz por ação fica em `docs/admin-permissoes-matriz.md`.

Uma mesma conta pode atuar em mais de um contexto. O frontend muda navegação e
apresentação conforme rota, sessão e vínculos, mas essas escolhas não substituem
a autorização do backend.

O contexto cliente pode ser expresso por `/cliente/conta` mesmo quando a mesma
identidade também é dona, profissional ou administradora. Essa rota preserva a
experiência pública/cliente e não deve trocar silenciosamente para um workspace
operacional. `/conta` permanece rota dinâmica de compatibilidade para os demais
contextos.

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
negócio. O estado legado `cancelamento_solicitado`, enquanto permanecer em
revisão sem desfecho confiável, não conta como evidência de ativação. O marco
mede primeira reserva válida; não confirma comparecimento nem receita.

## Onboarding, publicação e disponibilidade

A entrada pública para profissionais deve permanecer visível e preservar a
intenção profissional entre descoberta, cadastro e login. Conta autenticada sem
negócio reutiliza a mesma identidade na criação; vínculos ativos levam ao
workspace autorizado, priorizando o contexto de dona quando a mesma conta também
for profissional. Retornos internos protegidos e a exceção RN50 mantêm
precedência.

A primeira jornada profissional é focada em **Conta → Negócio → Serviço →
Horários**. Negócio, serviço e disponibilidade usam os mesmos contratos das
telas operacionais; onboarding não cria versões paralelas das entidades. A
resposta canônica de cada escrita permite seguir para a próxima etapa sem exigir
uma segunda gravação. Resultado incerto exige reconciliação por leitura, não
reenvio cego da mutação.

A publicação é automática quando o negócio atende aos requisitos estruturais e
possui ao menos um serviço ativo, salvo despublicação manual persistida. Apenas
ação explícita da dona pode limpar essa intenção, sempre sujeita à elegibilidade
validada no backend. **Configurar ou personalizar horários não é gate de
publicação.**

O AF inicializa uma disponibilidade padrão editável para a dona. Todos os dias
fechados também constituem configuração válida: o perfil pode continuar
publicado, mas não gera slots. A política de antecedência de cancelamento pertence
ao negócio e novas reservas congelam a regra aplicável no momento da confirmação.
Detalhes de horários sugeridos, compatibilidade legada e snapshots ficam em
`docs/ativacao-profissional-ux.md` e `docs/snapshots-historicos-agendamento.md`.

A profissional ativa edita a própria disponibilidade; a dona pode editar a
disponibilidade de profissionais ativas do mesmo negócio. Seletores de contexto
escolhem qual vínculo o usuário pretende operar, mas nunca concedem permissão: o
backend revalida conta, papel, negócio e alvo em cada operação.

A agenda operacional usa a disponibilidade persistida e o fuso IANA do negócio.
Reservas existentes continuam visíveis e tratáveis conforme o lifecycle mesmo
quando a profissional foi inativada, sem criar novos slots nem reativar o
vínculo. Intervalos que atravessam dia ou grade permanecem ocupados por toda a
duração congelada da reserva.

Depois do primeiro salvamento explícito de horários, a missão principal é
**conquistar o primeiro agendamento válido**. Se não houver disponibilidade
estrutural agendável, a orientação prioriza corrigir horários/equipe antes de
divulgar; havendo disponibilidade, o AF apresenta compartilhamento do perfil.
Essa condição orienta divulgação, não publicação. Após o primeiro agendamento
válido, a rotina do dia tem precedência sobre orientação, upgrade e
consentimentos.

Uma intenção de plano pago pode acompanhar a jornada, mas não provoca checkout
automático ao concluir Horários. Upgrade e pagamento continuam decisões
explícitas e contextuais.

Detalhes canônicos: `docs/ativacao-profissional-ux.md`,
`docs/ativacao-proxima-acao.md`, `docs/contexto-negocio.md`,
`docs/frontend-formularios-estado-api.md` e
`docs/confiabilidade-compromissos-agenda.md`.

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
- a detecção de reagendamento sem alteração compara responsável e instante
  canônico, preservando o comportamento quando o fuso do negócio é corrigido;
- serviço, preço, duração e antecedência de cancelamento permanecem snapshots do
  booking durante o reagendamento;
- após o horário previsto, o booking ainda pode ser reagendado se o atendimento
  não tiver começado e o novo início for futuro;
- RN45: qualquer reserva `agendado`/`confirmado` no negócio impede remover o
  vínculo profissional, inclusive reserva passada e vínculo inativo. A passagem
  do relógio não resolve a pendência; é necessário um desfecho válido do lifecycle;
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
credencial de login. Um booking visitante não é automaticamente reivindicado
por uma conta criada depois apenas por coincidência de nome ou WhatsApp; a posse
continua vinculada à capability específica da reserva. Qualquer reconciliação
futura exige mecanismo explícito e seguro de verificação de posse.

## Planos e monetização

O plano gratuito é uma oferta ativa e deve entregar valor real antes de qualquer
pressão por upgrade.

| Plano | Valor mensal | Agendamentos/mês | Profissionais | Serviços |
| --- | ---: | ---: | ---: | ---: |
| Grátis | R$ 0,00 | 10 | 1 | 5 |
| Autônoma | R$ 10,00 | 20 | 3 | 10 |
| Studio | R$ 20,00 | 30 | 6 | 15 |
| Salão | R$ 30,00 | Ilimitados | 9 | Ilimitados |

O slug interno do plano gratuito permanece `inicial` por compatibilidade.
Preço, capacidade, entitlement e elegibilidade são regras do backend; valores ou
limites enviados pelo frontend nunca são autoridade.

Convites podem preservar a intenção de uma profissional sem capacidade
disponível, mantendo vínculo inativo até ativação explícita. Downgrade não apaga
proprietária, vínculos, configurações ou reservas; quando necessário, reduz
capacidade ativa de forma determinística e reversível. Inativação manual também
preserva histórico e libera capacidade. A própria dona não é inativada por essa
regra. Detalhes pertencem a `docs/convites-profissionais.md` e
`docs/planos.md`.

RN50 mantém para profissional inativa apenas o acesso restrito às próprias
reservas existentes e às transições terminais permitidas. Não concede novas
reservas, agenda, serviços, equipe ou assinatura. Cancelamento e reagendamento
permanecem sob controle da dona enquanto o vínculo estiver inativo. A
autorização é revalidada no backend em cada consulta/escrita.

Upgrade na área da dona é contextual, não publicidade permanente. O backend
resolve o próximo plano e suas capacidades; uma recomendação não pode esconder
contraction financeira nem transformar clique, checkout iniciado ou cobrança
criada em receita. Comparação de planos permanece escolha explícita.

Planos pagos usam checkout PIX. Só a dona ativa de negócio ativo e publicado pode
iniciar contratação paga. O valor cobrado precisa corresponder ao snapshot
contratado; divergência externa não libera entitlement. Um negócio não pode
acumular cobranças PIX pendentes concorrentes por troca de plano.

Retorno do navegador, criação de cobrança ou programação de recorrência não
confirmam pagamento. Acesso pago depende de confirmação financeira autenticada e
idempotente. Cancelar renovação preserva o período já quitado; ao fim do acesso,
o negócio retorna ao plano gratuito sem apagar seus dados.

Checkout, renovação, cancelamento, estorno e reconciliação são sagas idempotentes.
Efeitos mutáveis no Asaas permanecem fora de transações PostgreSQL; estado
incerto fica durável e reconciliável; respostas antigas não alteram geração
financeira nova; e programação de cobrança nunca substitui evidência de
pagamento.

Métricas financeiras precisam distinguir caixa recebido, MRR contratado,
churn, reativação, LTV bruto, economia de gateway, margem de contribuição e
retorno sobre CAC. Cada métrica só existe quando seu contrato, cutover, cobertura
e maturidade estiverem documentados; ausência de custo, reversão ou fonte não
pode virar zero por conveniência. Billing continua autoridade de entitlement e
leituras econômicas não o reescrevem.

Fontes e detalhes canônicos: `docs/planos.md`,
`docs/checkout-idempotente.md`, `docs/asaas-ativacao-recorrencia.md`,
`docs/webhook-processing.md`, `docs/prontidao-financeira-recorrencia.md` e
os documentos históricos de Waves 19–32 indexados em `docs/README.md`.

## Arquitetura atual

- Runtime: Node.js 22.
- Backend: Express 5 em JavaScript CommonJS, organizado em routes → controllers
  → services → repositories → PostgreSQL.
- Frontend: React 19, React Router 7, Vite 7 e CSS.
- Autenticação: JWT em cookie `HttpOnly`, bcrypt e Google Identity; Bearer no
  navegador existe somente como compatibilidade de migração legada.
- Imagens: Busboy, validação de conteúdo e Cloudinary.
- Pagamentos: Asaas.
- Notificações: WhatsApp Cloud API oficial da Meta.
- E-mail transacional: Resend onde configurado.
- Marketing: GA4, Google Ads, Meta Ads/CAPI, TikTok Ads e Pinterest Ads conforme
  integrações documentadas.
- Testes: Jest/Supertest/PostgreSQL, Vitest/Testing Library e Playwright.
- CI/CD: GitHub Actions e Railway; migrations precedem a aplicação e produção usa
  readiness em `/health/ready`.

SQL novo pertence a repositories; routes/controllers não acessam banco
diretamente. Validação crítica, autorização, preços, capacidade, contexto de
negócio e regras financeiras permanecem no backend.

O frontend é uma única aplicação com contextos público, cliente, dona,
profissional e admin separados por rota, sessão, shell e autorização. Diferença
visual ou seleção de contexto nunca altera permissões persistidas.

Operações assíncronas antigas não podem sobrescrever sessão, formulário, mídia ou
contexto mais recente. Timeout/cancelamento cobrem a leitura completa da
resposta; 401 antigo não apaga autenticação nova; resultado de escrita incerto é
reconciliado por leitura quando o domínio exigir. A sessão principal usa cookie
HttpOnly e analytics não reutiliza Bearer legado.

Detalhes de nomes de módulos, ownership de CSS, cliente HTTP, hooks, shells,
telemetria e fronteiras internas pertencem a `docs/arquitetura.md`,
`docs/backend-arquitetura.md`, `docs/frontend-arquitetura.md`,
`docs/frontend-formularios-estado-api.md`, `docs/frontend-seguranca.md` e
`docs/session-security.md`.

## Frontend e UX

Priorizar clareza da tarefa e experiência mobile, especialmente Safari/WebKit.

A identidade visual do AF é rosa, branca e grafite, acolhedora e ligada ao
universo de beleza. A marca deve permanecer reconhecível, mas contextos público,
cliente, dona, profissional e admin podem ter densidade e composição próprias.
Essas diferenças nunca substituem autorização do backend.

O Admin é um centro de comando de leitura, diagnóstico e operações
explicitamente autorizadas. Requisitos de segurança, dinheiro, permissão ou
integridade só contam como cobertos com evidência verificável no backend e
testes proporcionais ao risco. Não declarar RNF/performance conforme sem medição
representativa real. Histórico de Waves administrativas permanece como evidência
em `docs/admin-*.md`, não como regra duplicada nesta memória.

A dona possui workspace de gestão; a profissional possui rotina curta focada em
agenda, horários e conta. Quando a mesma identidade possui mais de um contexto,
a troca é explícita e preserva o vínculo escolhido.

Toda tela deve tratar, quando aplicável:

- carregamento, vazio, erro e sucesso;
- sessão expirada e permissões;
- responsividade, teclado virtual e conteúdo sob `fixed`/`sticky`;
- contraste, foco, áreas de toque e navegação por teclado;
- cancelamento/obsolescência de respostas assíncronas;
- comportamento em Safari/WebKit.

Quando houver apenas uma profissional elegível no booking, não exigir escolha
sem utilidade. A confirmação ainda deve deixar claro quem realizará o serviço.

Usar os assets oficiais da marca; não introduzir substitutos improvisados.
Detalhes de shells, componentes, estilos, jornadas e baseline administrativa
ficam em `docs/ux-contextos-visuais.md`, `docs/frontend-arquitetura.md`,
`docs/frontend-qa-prontidao.md`, `docs/frontend-estilos.md` e
`docs/admin-console.md`.

## Analytics, aquisição e growth

Avaliar crescimento pelo funil completo. CTR, CPC, CPM, cliques e cadastro são
sinais intermediários; sucesso precisa ser conectado, conforme o objetivo, a
ativação, primeiro agendamento válido, recorrência, retenção, assinatura e
receita.

Diferenciar profissional, negócio e cliente final e preservar origem por Google
Ads, Meta Ads, TikTok Ads, Pinterest Ads, orgânico e demais canais apenas quando
a evidência suportar essa classificação.

Parâmetros de campanha e click IDs dependem do consentimento aplicável. Sem
consentimento, telemetria técnica first-party pode continuar apenas dentro do
contrato permitido. Revogação interrompe nova atribuição opcional e remove o que
o navegador não deve mais conservar.

Atribuição incompleta não é corrigida por suposição. Evidência bruta, UTM,
click IDs e vínculos externos permanecem auditáveis; tráfego sem prova suficiente
continua incompleto/sem evidência.

Fatos críticos de booking e monetização vêm do backend a partir do estado
persistido. Telemetria do frontend é diagnóstica e não pode ser somada a fatos
transacionais como se fosse outra fonte independente. Pipelines legados e novos
só podem ser aposentados depois de reconciliação observada.

Conversão, checkout, cobrança criada, pagamento confirmado, assinatura ativa,
renovação, reversão e receita são fatos distintos. Métricas como CAC, ROAS, MRR,
GRR/NRR, LTV, margem e retorno só podem ser usadas quando cobertura, maturidade,
cutover e definição forem suficientes.

A identidade de cliente para recorrência usa identidade persistida; telefone não
deve fundir visitantes silenciosamente. A identidade de aquisição financeira do
negócio não pode ser reescrita por renovação, troca de plano, reativação ou
mudança posterior de proprietária.

Conversões server-side para mídia devem ser idempotentes e derivar do fato
financeiro canônico. Consentimento é revalidado na entrega e falhas operacionais
não devem ser mascaradas como inelegibilidade legítima.

Integrações administrativas de custos continuam somente leitura no escopo atual
documentado; criar, editar, pausar ou excluir campanhas exige nova decisão de
produto e segurança.

Detalhes canônicos: `docs/marketing-attribution.md`,
`docs/analytics-pipeline-reconciliation.md`,
`docs/inteligencia-crescimento.md`,
`docs/custo-qualidade-aquisicao-profissional.md`,
`docs/prontidao-financeira-recorrencia.md` e documentos específicos de cada
plataforma.

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

## Copilot e IA generativa

O Copilot de divulgação usa decisão e texto determinísticos como caminho padrão.
LLM é opcional e experimental, nunca é condição para a recomendação funcionar e
seu valor deve ser medido por impacto incremental no funil compartilhamento →
visita → agendamento iniciado → agendamento concluído. Regras de provider,
fallback, contrato e telemetria pertencem a `docs/copilot-v1.md` e
`docs/arquitetura-copilot.md`.

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

Na topologia web atual, mutações autenticadas por cookie usam defesa CSRF em camadas: cookie `SameSite=Lax`, CORS restrito e validação de metadados de origem do navegador (`Sec-Fetch-Site`, `Origin` e `Referer`) quando presentes. Requests unsafe com cookie de sessão e evidência cross-site devem ser rejeitados. Não há token CSRF dedicado enquanto a arquitetura permanecer same-origin/JSON com esse contrato; qualquer mudança para `SameSite=None`, frontend/API em origens distintas, mutação via formulário tradicional ou embedding cross-site exige reabrir o threat model antes do deploy.

O browser não deve persistir perfil de usuário ou negócio em `localStorage` para acelerar bootstrap. A persistência local da sessão web fica restrita ao marcador técnico `session_active` e à compatibilidade legada ainda existente; nome, e-mail, WhatsApp, foto e contexto de negócio permanecem em memória e são reidratados por `GET /minha-sessao`. Chaves antigas `usuario` e `negocio` devem ser removidas no bootstrap.

O header `X-Agenda-Access` faz parte do contrato de capability de booking e deve permanecer permitido pelo CORS para que a mesma capability continue funcionando caso frontend e API usem origens permitidas distintas. Isso não amplia o escopo da capability nem substitui validação backend.

APIs de acesso por capability de reserva (visitante ou cliente desativado) não
aceitam credencial por query string. Consulta usa `X-Agenda-Access` e cancelamento
usa o corpo JSON previsto no contrato. Sucesso e erro desses caminhos enviam
`Cache-Control: no-store` para impedir armazenamento de dados da reserva em cache.

A retirada de transporte Bearer legado exige evidência operacional sem registrar credenciais. A observabilidade pode contar apenas a classe de transporte (`cookie` ou `bearer`) e timestamps agregados do processo; nunca registrar o token, o header `Authorization`, usuário, rota ou payload para esse diagnóstico. Contador zero em um único processo/deploy não prova ausência histórica e não autoriza remoção automática da compatibilidade.

O frontend web não deve propagar Bearer legado em chamadas normais. Quando encontrar a chave histórica `token` no `localStorage`, deve fazer uma migração única e validada para o cookie HttpOnly pelo endpoint dedicado, remover o token local e seguir usando somente cookie. O backend pode manter aceitação temporária de Bearer para clientes legados enquanto a janela operacional ainda não justificar a retirada total.

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

Cache `immutable` só pode ser aplicado quando a URL do asset muda junto com o conteúdo ou quando o arquivo é realmente imutável. Assets públicos de filename estável que podem ser substituídos entre deploys precisam revalidar no HTTP em vez de depender de limpeza manual de cache.

Páginas públicas de aquisição incluídas no sitemap e tratadas como alvo de SEO devem entregar title, description, canonical e metadata social relevante no HTML inicial; metadata client-side continua sendo complemento para navegação SPA, não substituto para crawlers que não executam JavaScript.

## Testes, merge e deploy

Mudanças relevantes devem executar validações proporcionais ao risco. O Quality
Gate atual cobre lint, build, testes frontend, migrations, Jest/PostgreSQL,
audits e Playwright aplicável. A suíte E2E deve preservar cobertura relevante de
Chromium/WebKit e aceitação full-stack e pode ser paralelizada para reduzir o
caminho crítico sem reduzir cobertura. Quantidade de shards, imagem de runner,
preflight de browsers e detalhes de rede do CI pertencem a
`docs/deploy-seguro.md`.

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

Não registrar uma data manual de "última atualização": o histórico do Git é a
fonte temporal confiável do arquivo e evita cabeçalhos que envelhecem sem relação
com o conteúdo.

Não usar este arquivo para métricas temporárias, resultado momentâneo de
campanha, estado de aprovação externo ou detalhes de layout que podem mudar sem
alterar o contrato do produto.

Quando já existir documento canônico ou runbook para um domínio, o `AGENTS.md`
deve guardar apenas o invariante necessário para orientar decisões futuras e
apontar para a fonte especializada. Nomes de arquivos internos, versão de imagem
de CI, quantidade de shards, leases, migrations específicas e estados de
implementação ficam no documento canônico quando não forem parte essencial do
contrato durável.

Documentação especializada deve concentrar detalhes de implementação e
operação. Ao mudar uma regra permanente, atualizar os documentos afetados no
mesmo conjunto de mudanças sempre que possível.

Esta deve ser a seção final do arquivo. Novas regras duráveis precisam ser
incorporadas ao domínio correspondente, não anexadas depois da política de
manutenção.
