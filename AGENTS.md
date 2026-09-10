# Memória operacional do Agenda Fashion

> Contexto permanente para agentes de desenvolvimento.
> Atualizada em setembro de 2026.

Este arquivo deve ser lido antes de mudanças relevantes no projeto. Ele registra
decisões duráveis de produto, arquitetura, segurança e operação. Detalhes de uma
feature específica ficam nos documentos em `docs/` e no código executável.

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

- **profissional**: pessoa que presta serviços e pode possuir vínculo com um ou
  mais negócios;
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
possui ao menos um serviço ativo.

**Configurar ou confirmar manualmente horários não é gate de publicação nem
etapa canônica de ativação.**

Ao criar o negócio, o backend inicializa na mesma transação uma disponibilidade
padrão para a dona inicial:

- segunda a sexta: 08:00–18:00, com pausa 12:00–13:00;
- sábado: 08:00–13:00;
- domingo: fechado.

`agenda_configuracoes.configurado_em` é marcador técnico de disponibilidade
inicializada. Ele não representa confirmação manual nem deve ser usado para
bloquear publicação ou medir conclusão do onboarding.

`negocios.publicacao_exige_agenda` permanece apenas por compatibilidade com
dados/migrations legados; o runtime atual não deve reintroduzir esse gate.

Depois da publicação, a missão principal é divulgar o perfil e conquistar o
primeiro agendamento. Compartilhamento deve reutilizar os links públicos
rastreáveis existentes do AF.

A disponibilidade continua crítica para gerar slots corretos e pode ser
acompanhada como diagnóstico operacional separado.

Detalhes: `docs/ativacao-profissional-ux.md` e
`docs/ativacao-proxima-acao.md`.

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

Planos pagos usam checkout por PIX. Retorno do navegador não confirma pagamento.
A ativação do plano depende da confirmação financeira autenticada e idempotente
do Asaas.

Mais detalhes: `docs/planos.md`, `docs/checkout-idempotente.md` e documentos de
webhook financeiro.

## Arquitetura atual

- Runtime: Node.js 22.
- Backend: Express 5, JavaScript CommonJS.
- Banco: PostgreSQL via `pg`.
- Frontend: React 19, React Router 7, Vite 7 e CSS.
- Backend em camadas: routes → controllers → services → repositories →
  PostgreSQL.
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

O frontend é uma única aplicação React. Atualmente `/painel/*` e
`/profissional/*` compartilham `WorkspaceLayout` com navegação contextual;
`/admin/*` usa `AdminLayout` + `AdminShell` próprios.

Detalhes técnicos: `docs/arquitetura.md`, `docs/frontend-estilos.md` e
`docs/ux-contextos-visuais.md`.

## Frontend e UX

Priorizar clareza da tarefa e experiência mobile, especialmente Safari/WebKit.

A identidade visual do AF é rosa, branca e grafite, acolhedora e ligada ao
universo de beleza. A marca deve permanecer reconhecível, mas cada contexto pode
ter densidade e composição próprias.

O Admin funciona como um Command Center operacional com design system próprio.
A direção visual é referência, não justificativa para reescrever componentes
que já funcionam sem benefício proporcional.

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

As integrações administrativas de custos são somente leitura no escopo atual
documentado e não devem criar, editar, pausar ou excluir campanhas sem uma nova
decisão de produto e segurança.

Detalhes ficam em `docs/marketing-attribution.md`, `docs/marketing-sync-ga4.md`
e demais documentos de marketing.

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
- tokens e payloads sensíveis não aparecem em logs;
- aprovação de template é estado externo e deve ser consultada quando uma
  decisão depender dela.

Detalhes: `docs/whatsapp-automatico.md`.

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

Toda mudança de banco exige migration nova. Migration já aplicada não é
reescrita para corrigir o passado.

Operações críticas que alteram múltiplas tabelas devem usar transação quando a
atomicidade fizer parte do contrato.

Não introduzir tecnologia, camada ou reescrita ampla apenas por modernização.

## Testes, merge e deploy

Mudanças relevantes devem executar validações proporcionais ao risco. O Quality
Gate atual cobre lint, build, testes frontend, migrations, Jest/PostgreSQL,
audits e Playwright aplicável.

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
