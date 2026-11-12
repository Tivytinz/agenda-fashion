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
só representa essa autorização operacional quando a transição é realizada pelo
proprietário do repositório; o workflow de auto-merge deve rejeitar
`ready_for_review` de outros atores. Os gates obrigatórios de CI e as regras de
proteção da branch continuam sendo condição de integração: autorização não
substitui checks, e falha ou cancelamento não deve ser contornado por merge
forçado.

## Domínio público canônico

A origem pública oficial do Agenda Fashion é:

```text
https://agendafashion.com.br
```

Site público, autenticação e áreas operacionais permanecem na mesma aplicação e
origem; rota, sessão e autorização separam os contextos.

`app.agendafashion.com.br` é host legado de compatibilidade e
`www.agendafashion.com.br` é alias de entrada. Navegações HTML devem convergir
para o domínio raiz sem forçar APIs, webhooks ou integrações a redirects que
possam quebrar contratos. DNS, certificados e aliases precisam continuar
funcionais até a requisição alcançar a aplicação.

URLs de infraestrutura, como hosts `.railway.app`, não são URLs de produto.
Backend, frontend, CORS e OAuth de produção devem permanecer alinhados à origem
canônica, salvo compatibilidade temporária explicitamente documentada.

A sessão de produção usa cookie host-only; não ampliar o domínio do cookie apenas
para compartilhar sessão entre hosts. Regras operacionais de redirects, DNS,
certificados e transição de host ficam em `docs/deploy-seguro.md` e
`docs/frontend-entrega-runtime.md`.

## SEO e descoberta pública

Páginas deliberadamente indexáveis precisam entregar no HTML inicial title,
description, canonical e metadata social coerentes com o domínio canônico.
Dados estruturados só podem representar fatos confiáveis do produto; não inventar
avaliações, preços ou oferta.

Sitemap deve refletir oferta pública real. `lastmod` só existe quando há data
factual válida; ausência de data não vira época Unix, horário do request ou
deploy.

`robots.txt` controla rastreamento, não substitui `noindex`. Segurança e
autorização nunca dependem de SEO.

Bootstrap server-side de página pública pode reduzir o caminho crítico, mas usa
DTO/whitelist explícita e escape seguro. Ele não se torna autoridade de
disponibilidade, plano, permissão ou criação de booking; o backend continua
validando essas regras.

Detalhes de cache, favicon, sitemap, metadata, noindex e entrega HTML pertencem a
`docs/frontend-entrega-runtime.md`.

## Entidades e contextos

Não tratar como equivalentes:

- **profissional**: pessoa que presta serviços;
- **negócio**: unidade operacional com serviços, equipe, agenda, plano e perfil;
- **cliente final**: pessoa que descobre e agenda, com conta ou como visitante.

A identidade principal fica em `usuarios`. Papéis do negócio pertencem a
`usuarios_negocios.papel` (`dono` e `profissional`); administração global
usa `usuarios_administradores` com papel `admin`. Papéis legados não devem
voltar a conceder permissão.

Uma mesma conta pode atuar em mais de um contexto. No modelo atual, pode ser dona
do próprio negócio e profissional em outro, mantendo no máximo um vínculo ativo
com papel `profissional`. Alterar esse limite exige decisão explícita de
produto e revisão de agenda, autorização e UX.

Rotas explícitas de dona, profissional, cliente e admin selecionam a intenção de
contexto, mas o backend sempre valida o vínculo persistido correspondente.
Contexto principal da sessão existe por compatibilidade e não autoriza trocar
silenciosamente de papel.

Ativar perfil profissional reutiliza a mesma identidade; criar negócio ou aceitar
convite não cria segunda conta nem apaga histórico de cliente. Inativar/remover
um vínculo também não apaga a identidade profissional já adquirida.

Detalhes de seleção, permissões, matriz e multi-contexto ficam em
`docs/contexto-negocio.md`, `docs/admin-permissoes-matriz.md`,
`docs/public-shell.md` e `docs/ux-contextos-visuais.md`.

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

O cadastro determina o fuso horário IANA a partir do estado do endereço, sem
confiar no fuso do aparelho. Em estado com mais de um fuso operacional (ex.: AM
e PE), a profissional confirma explicitamente o fuso local antes da criação;
o backend valida a correspondência entre estado e fuso e não grava um default
incorreto. O cadastro oferece um link de busca no Google Maps gerado a partir
do endereço, mas essa busca não equivale à verificação de coordenadas; a dona
confere o local. Links de localização enviados na criação precisam ser HTTPS
e de provedores de mapas reconhecidos.

Após a criação, alterar o estado do negócio também exige revisar o fuso
IANA. Em UF de fuso único, a escolha pode ser derivada; em UF ambígua, deve
ser explicitamente confirmada pela proprietária. A API valida essa escolha
e só altera o fuso quando não existirem agendamentos futuros ativos
(`agendado` ou `confirmado`), preservando o snapshot dos agendamentos já
confirmados. A proprietária precisa resolver/reagendar os próximos horários
antes de alterar o fuso. Nunca atualizar silenciosamente o fuso somente
porque o endereço foi editado sem validação no backend.

A localização de novas criações e de links **alterados** no perfil exige
HTTPS de um provedor de mapas reconhecido. Links legados anteriormente
persistidos continuam aceitos quando permanecem inalterados; a regra de
publicação anterior também os tolera temporariamente para evitar
despublicação retroativa sem inventário/migração controlada. Não confundir
essa exceção de compatibilidade com um endereço geocodificado/verificado.
Links de busca gerados no AF tornam-se pendentes de regeneração se o endereço
for alterado. Não reescrever links personalizados sem ação explícita da dona.

Na etapa 2, o botão Voltar retorna a `/cadastro?tipo=profissional`
(etapa 1), preservando a intenção de plano e o rascunho da criação do
negócio. Depois de criar a conta, retornar à etapa 1 abre a edição inline dos dados
da MESMA identidade, sem reenviar o cadastro ou sair para `/conta`.
Nome e WhatsApp usam `PUT /conta`; e-mail usa `PUT /conta/email`, com
senha atual, unicidade e desativação da verificação do endereço anterior;
a troca de senha usa `PUT /conta/senha`, também com senha atual, e reautentica
com a nova senha após a revogação das sessões antigas.
Sem alterações, Continuar não faz chamadas de gravação. Ao salvar, a sessão
é reconciliada antes de retornar à etapa 2. Credenciais nunca são retidas em
rascunhos; apenas a saída real e confirmada descarta o rascunho do negócio.
E-mail de conta sem senha disponível exige fluxo de reautenticação próprio
antes de ser alterado; não contornar a proteção no frontend.

Rascunhos ainda não enviados podem sobreviver a uma recarga por até 30 minutos
em `sessionStorage`, vinculados à conta e somente à guia. Nunca usar `localStorage`
para dados pessoais do formulário, nem guardar senha ou token. Limpar o rascunho
após criação confirmada, saída descartada, expiração ou troca de identidade.
A recuperação de rascunhos exige posse confirmada da guia por um
identificador opaco, compartilhado apenas para verificar clones de
`sessionStorage`. Sem confirmação (inclusive storage bloqueado), descartar
o rascunho copiado em vez de associá-lo a outra guia. Nenhum dado pessoal
do rascunho deve entrar no armazenamento compartilhado.

A chave de idempotência continua independente do rascunho: uma resposta de
criação incerta exige consulta canônica, não reenvio automático de POST.

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

O horário ter passado não prova atendimento. Estados persistidos distinguem
reserva ativa, cancelamento, realizado e falta; `realizado` e `falta` são
terminais no fluxo operacional atual.

Regras duráveis:

- falta só pode ser registrada depois da tolerância temporal definida; atendimento
  iniciado impede registrar falta;
- realizado só pode ser confirmado pela responsável autorizada e depois do
  momento permitido pelo lifecycle;
- cancelamento e reagendamento são fluxos próprios e auditáveis, não atalhos de
  status;
- reagendamento é transacional, revalida slot, responsável e elegibilidade, e
  preserva snapshots comerciais e de cancelamento da reserva;
- serviço/profissional elegível precisa vir da matriz persistida; o frontend não
  pode inventar capacidade;
- conflitos de horário são globais por profissional, mesmo quando disponibilidade
  recorrente pertence ao contexto profissional + negócio;
- comparações temporais usam o instante canônico da reserva e o fuso do negócio
  apenas para apresentação/derivação local;
- vínculo profissional com booking operacional não pode ser removido apenas
  porque o relógio passou; é necessário desfecho válido;
- comunicação pós-commit não reverte estado principal do booking quando falha;
- visitante acessa somente a própria reserva por capability específica, que não
  vira login nem autoriza outros bookings;
- nome ou WhatsApp não reivindicam automaticamente uma reserva visitante para uma
  conta criada depois;
- estados legados ambíguos não devem ser promovidos automaticamente a fato de
  atendimento sem evidência suficiente.

RN50 preserva para vínculo profissional inativo apenas consulta das próprias
reservas existentes e registro terminal permitido; não reabre agenda, serviços,
equipe ou novas reservas. Cancelamento e reagendamento permanecem com a dona
enquanto o vínculo estiver inativo.

Detalhes canônicos: `docs/ciclo-atendimento.md`,
`docs/agendamento-integridade.md`,
`docs/snapshots-historicos-agendamento.md`,
`docs/cancelamento-agendamento-visitante.md` e
`docs/confiabilidade-compromissos-agenda.md`.

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

Fontes canônicas: `docs/planos.md`, `docs/checkout-idempotente.md`,
`docs/asaas-ativacao-recorrencia.md`, `docs/webhook-processing.md` e
`docs/prontidao-financeira-recorrencia.md`. As Waves 19–32 indexadas em
`docs/README.md` permanecem evidência histórica, não fonte concorrente de regra.

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

Regras transversais obrigatórias:

1. autenticação, autorização e isolamento entre negócios são validados no
   backend;
2. IDs, papéis, preços, limites e regras financeiras enviados pelo navegador não
   são autoridade;
3. segredos nunca aparecem no Git, frontend, analytics ou logs;
4. webhooks e operações financeiras precisam de autenticação, idempotência e
   replay seguro;
5. dados pessoais são minimizados conforme finalidade e autorização;
6. esconder botão ou redirecionar no React não substitui controle de acesso;
7. respostas antigas não podem apagar sessão ou contexto autenticado mais novo.

A sessão web principal usa cookie HttpOnly. Compatibilidade Bearer existe somente
para migração/clientes legados e não deve voltar ao caminho normal do frontend.
Sua retirada exige evidência operacional sem registrar credenciais.

Mutações por cookie mantêm proteção CSRF compatível com a topologia same-origin
atual. Alterar origem, `SameSite`, embedding cross-site ou modo de autenticação
exige reabrir o threat model antes do deploy.

Capabilities de booking são credenciais de escopo mínimo: não trafegam em query
de API, não viram sessão geral e respostas sensíveis usam política de cache
compatível com dados privados.

Desativação e arquivamento preservam histórico obrigatório sem conceder acesso
operacional indevido. Exclusão física indiscriminada não substitui política de
retenção e encerramento.

Detalhes: `docs/session-security.md`, `docs/frontend-seguranca.md`,
`docs/auditoria-rbac.md`, `docs/encerramento-privacidade.md` e
`docs/dependency-security.md`.

## Engenharia e banco

Antes de alterar algo:

1. investigar a causa raiz e o fluxo completo;
2. avaliar frontend, backend, banco, segurança, integrações e testes;
3. preferir mudanças pequenas, modulares e reversíveis;
4. preservar comportamento que já funciona;
5. criar/atualizar testes proporcionais ao risco;
6. revisar o diff e as validações antes de considerar a mudança pronta.

SQL novo pertence a repositories; routes/controllers não acessam banco
diretamente. Operações críticas que exigem atomicidade usam transação e efeitos
externos não devem permanecer dentro de locks de banco sem necessidade.

Toda mudança de banco exige migration nova. Migration aplicada não é reescrita
para corrigir o passado.

Configuração obrigatória é validada no startup. Integração habilitada não pode
iniciar com credenciais parciais, e workers só podem ser separados do processo
web depois que o processo dedicado estiver implantado e saudável.

Diagnósticos administrativos expõem apenas métricas operacionais seguras, nunca
credenciais ou payloads sensíveis.

O PostgreSQL crítico mantém meta de RPO ≤ 1 hora e RTO ≤ 4 horas, mas essas metas
só podem ser declaradas comprovadas após backup/PITR e restore controlado medidos.
Alterações em backup, retenção, PITR ou infraestrutura de produção exigem
autorização explícita.

Não introduzir tecnologia, camada ou reescrita ampla apenas por modernização.
Detalhes arquiteturais, runtime, workers, cache, performance e recuperação ficam
em `docs/backend-arquitetura.md`, `docs/arquitetura.md`,
`docs/frontend-entrega-runtime.md`, `docs/performance-qa.md` e
`docs/backup-recovery.md`.

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
