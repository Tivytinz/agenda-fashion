# Arquitetura Oficial — Agenda Fashion

> Atualizada em setembro de 2026.
>
> O contexto permanente de produto e as instruções para agentes ficam em
> [`AGENTS.md`](../AGENTS.md). Este documento descreve a arquitetura técnica
> atual e aponta para documentos especializados quando o detalhe não precisa
> ser repetido aqui.

## 1. Objetivo do produto

O Agenda Fashion (AF) é um SaaS brasileiro de descoberta e agendamento para
profissionais, negócios e clientes de beleza e estética.

A arquitetura existe para sustentar principalmente:

- descoberta de negócios e serviços;
- agendamento confiável;
- operação de profissionais e donos;
- aquisição e ativação de profissionais;
- monetização por planos;
- comunicação e automações;
- mensuração de aquisição, recorrência e receita;
- evolução segura do produto sem reescritas desnecessárias.

---

## 2. Stack atual

| Área | Tecnologia |
| --- | --- |
| Runtime | Node.js 22 |
| Backend | Express 5 e JavaScript CommonJS |
| Banco de dados | PostgreSQL com `pg` |
| Frontend | React 19, React Router 7, Vite 7 e CSS |
| Autenticação | JWT em cookie `HttpOnly`, bcrypt e Google Identity |
| Uploads | Busboy, validação de imagem e Cloudinary |
| Testes backend | Jest, Supertest e PostgreSQL de teste |
| Testes frontend | Vitest, Testing Library e Playwright |
| Pagamentos | Asaas |
| Notificações | WhatsApp Cloud API e e-mail transacional via Resend |
| Marketing | GA4, Google Ads, Meta Ads/CAPI, TikTok Ads e Pinterest Ads |
| CI/CD | GitHub Actions e Railway |
| Domínio principal | `app.agendafashion.com.br` |

A stack atual continua adequada ao estágio do AF. Nova tecnologia deve entrar
quando resolver um problema concreto melhor do que a base existente, e não
apenas por ser mais recente.

---

## 3. Arquitetura do backend

O backend segue arquitetura em camadas:

```text
Cliente
  ↓
Routes
  ↓
Controllers
  ↓
Services
  ↓
Repositories
  ↓
PostgreSQL
```

Responsabilidades transversais, como autenticação, validação, configuração,
tratamento de erros, providers e integrações externas, apoiam essas camadas.

O servidor monta as rotas sem um prefixo global `/api`. Alterar esse contrato
exige migração coordenada, e não a introdução parcial do prefixo em endpoints
isolados.

### Routes

Registram endpoints, aplicam middlewares e encaminham a requisição ao
controller. Não são o lugar para SQL ou regras centrais de negócio.

### Controllers

Traduzem HTTP para o caso de uso: extraem os dados necessários, chamam o
service, devolvem a resposta e encaminham erros ao tratamento central.

### Services

Concentram regras de negócio e coordenação dos casos de uso. Podem combinar
repositories, validators, utils e providers externos. SQL novo deve ficar em
repositories.

### Repositories

Concentram acesso ao PostgreSQL, incluindo consultas, gravações, agregações e
bloqueios transacionais necessários ao domínio.

### Middlewares, validators e errors

Middlewares tratam responsabilidades de requisição como autenticação e
autorização. Validators verificam formato e estrutura de entrada. Erros
conhecidos devem possuir status e, quando útil, código de domínio reutilizável.

---

## 4. Estrutura principal do repositório

```text
agenda-fashion/
├── AGENTS.md
├── .github/workflows/
├── database/migrations/
├── docs/
├── frontend/
│   ├── e2e/
│   └── src/
│       ├── analytics/
│       ├── api/
│       ├── auth/
│       ├── components/
│       ├── hooks/
│       ├── pages/
│       ├── styles/
│       └── utils/
├── scripts/
├── src/
│   ├── config/
│   ├── controllers/
│   ├── db/
│   ├── domain/
│   ├── errors/
│   ├── middlewares/
│   ├── providers/
│   ├── repositories/
│   ├── routes/
│   ├── services/
│   ├── utils/
│   ├── validators/
│   └── server.js
└── tests/
```

O build do frontend é artefato de produção e não deve ser tratado como
código-fonte canônico.

---

## 5. Frontend e contextos de uso

O AF é uma única aplicação React. Cliente, profissional, dona do negócio e
administração são contextos de uso, não aplicações independentes nem papéis
globais mutuamente exclusivos.

A rota ajuda a selecionar a experiência visual; sessão, vínculos e permissões
continuam definindo o que a conta pode acessar.

A organização atual é:

```text
público / cliente   → experiência pública e páginas de conta/agendamento
/painel/*           → WorkspaceLayout resolve OwnerShell para vínculo de dona
/profissional/*     → WorkspaceLayout resolve ProfessionalShell para vínculo profissional
/admin/*            → AdminLayout + AdminShell
```

`WorkspaceLayout` continua sendo a resolução de entrada das rotas privadas de
negócio. Quando o vínculo atual é `dono`, ele delega a composição para o
`OwnerShell`, que possui identidade, navegação, tokens `--owner-*` e CSS
contextual próprios. Para o vínculo `profissional`, ele delega para o
`ProfessionalShell`, que possui identidade, navegação curta, tokens
`--professional-*` e CSS contextual próprios. `AdminShell` continua independente
e possui navegação e design system `--admin-*` próprios.

A navegação compartilhada entre os contextos privados é uma primitive neutra:
ela concentra comportamento de rota ativa, menu mobile, clique fora e `Escape`,
sem transformar isso em ownership visual compartilhado.

Essa organização pode evoluir sem transformar nomes de componentes em regra de
segurança. Redirecionamentos e itens ocultos no React são UX; autorização real
continua no backend.

Princípios visuais e de evolução do frontend ficam em:

- [`ux-contextos-visuais.md`](./ux-contextos-visuais.md);
- [`frontend-estilos.md`](./frontend-estilos.md).

---

## 6. Identidade, autenticação e autorização

A tabela `usuarios` representa a identidade da pessoa. Papéis de negócio ficam
no vínculo `usuarios_negocios.papel`, atualmente com `dono` e `profissional`.
Administração global usa `usuarios_administradores` e não deve ser confundida
com o papel de dona de um negócio.

O navegador usa JWT em cookie `HttpOnly`; o backend continua sendo a autoridade
para validar sessão, vínculo e permissão. IDs, papel, preço, limite ou permissão
enviados pelo frontend não são fonte confiável.

Fluxos privados devem derivar o negócio a partir do usuário autenticado e do
vínculo persistido sempre que o caso de uso permitir, reduzindo risco de acesso
entre negócios.

Rotas administrativas usam autenticação e autorização administrativa no
backend. O `ProtectedRoute` melhora a navegação, mas não substitui esses
controles.

---

## 7. Agendamento público

O agendamento público aceita visitante e cliente autenticada conforme o fluxo
atual. Em ambos os casos, disponibilidade, profissional elegível, limites do
plano e concorrência de horário são validados no backend.

Fluxo conceitual:

```text
perfil público
  → serviço
  → profissional quando necessário
  → data e horário
  → validação real de disponibilidade
  → criação do agendamento
  → agenda e notificações
```

Quando houver apenas um profissional elegível, a interface pode seguir sem
exigir uma escolha redundante.

A confiabilidade do slot não pode depender apenas de estado calculado no
frontend.

---

## 8. Onboarding, publicação e disponibilidade

A ativação principal da profissional acompanha:

```text
cadastro
  → negócio criado
  → serviço ativo
  → negócio publicado
  → primeiro agendamento válido
```

Todo novo negócio precisa dos dados estruturais exigidos pelo backend e de pelo
menos um serviço ativo para publicação automática.

Descrição, complemento, fotos e personalização de horários não são gates de
publicação.

A criação do negócio inicializa uma disponibilidade padrão na mesma transação.
`agenda_configuracoes.configurado_em` representa inicialização técnica e não
confirmação manual da profissional. A origem dos horários permite diferenciar o
padrão do AF de configurações personalizadas e legadas quando necessário.

A disponibilidade continua crítica para gerar slots corretos e pode aparecer
como diagnóstico operacional, mas não entra no percentual canônico de ativação
nem deve voltar a bloquear publicação.

Detalhes desse fluxo ficam em:

- [`ativacao-profissional-ux.md`](./ativacao-profissional-ux.md);
- [`ativacao-proxima-acao.md`](./ativacao-proxima-acao.md).

---

## 9. Planos, pagamentos e webhooks

O AF possui plano gratuito ativo e planos pagos. Limites de plano são regras de
backend e devem ser validados dentro do caso de uso que consome capacidade.

Planos pagos usam checkout Asaas. Retorno do navegador não confirma pagamento;
ativação financeira depende da confirmação canônica do backend e do webhook.

Checkout e processamento financeiro preservam idempotência. Webhooks são
persistidos e processados com proteção contra duplicidade, concorrência e
retries.

Documentos especializados:

- [`planos.md`](./planos.md);
- [`checkout-idempotente.md`](./checkout-idempotente.md);
- [`webhook-asaas.md`](./webhook-asaas.md);
- [`webhook-processing.md`](./webhook-processing.md).

---

## 10. WhatsApp e comunicação

O AF usa a WhatsApp Cloud API oficial da Meta para notificações e automações.
Consentimentos operacionais, mensagens para clientes e orientações de marketing
possuem regras próprias e não devem ser tratados como uma única autorização.

A fila é persistente, idempotente e revalida elegibilidade/consentimento antes
do envio conforme o fluxo implementado.

Detalhes operacionais, templates e variáveis ficam em
[`whatsapp-automatico.md`](./whatsapp-automatico.md).

---

## 11. Marketing, atribuição e growth

O AF separa comportamento, atribuição e resultado de negócio:

- GA4 explica navegação e comportamento;
- eventos e banco do AF medem cadastro, publicação, agendamento, recorrência,
  checkout e pagamento;
- integrações de mídia fornecem identidade externa e custos quando a evidência
  é verificável.

Google Ads, Meta Ads, TikTok Ads e Pinterest Ads integram o motor de aquisição
e custos. Essas integrações são tratadas como leitura/diagnóstico no escopo
atual documentado; credenciais e decisões canônicas ficam no backend.

Atribuição incompleta não deve ser convertida artificialmente em orgânico ou
campanha oficial. CAC, ROAS e recomendações financeiras dependem dos guardrails
de evidência, maturidade e amostra definidos pelos serviços correspondentes.

A ativação de profissionais usada para avaliar qualidade da aquisição não inclui
agenda como gate. O marco de valor principal é o primeiro agendamento válido;
monetização permanece separada.

Documentos especializados incluem:

- [`marketing-attribution.md`](./marketing-attribution.md);
- [`marketing-sync-ga4.md`](./marketing-sync-ga4.md);
- [`custo-qualidade-aquisicao-profissional.md`](./custo-qualidade-aquisicao-profissional.md);
- [`prontidao-financeira-recorrencia.md`](./prontidao-financeira-recorrencia.md);
- [`google-ads-real-campaign-link.md`](./google-ads-real-campaign-link.md);
- [`meta-ads-real-campaign-link.md`](./meta-ads-real-campaign-link.md);
- [`marketing-tiktok-ads.md`](./marketing-tiktok-ads.md);
- [`marketing-pinterest-ads.md`](./marketing-pinterest-ads.md).

---

## 12. Administração

O Admin 2.0 usa `AdminLayout` e `AdminShell` próprios.

A navegação principal atual é:

```text
/admin             → Visão geral
/admin/aquisicao   → Aquisição
/admin/jornada     → Jornada
/admin/retencao    → Retenção
/admin/receita     → Receita
/admin/operacao    → Operação
```

Rotas especializadas de Marketing, diagnóstico de ativação e WhatsApp continuam
existindo e podem ser acessadas conforme a tarefa sem precisar ocupar o mesmo
nível da navegação principal.

Os seis módulos principais recebem sua composição e densidade diretamente das
camadas administrativas. Compatibilidades históricas podem permanecer em
features especializadas quando uma migração maior não trouxer benefício
proporcional.

O backend é a fonte de verdade para métricas canônicas e autorização. O design
system administrativo organiza apresentação e operação, não redefine regras de
produto.

Semântica e UX administrativa ficam em:

- [`admin-centro-comando.md`](./admin-centro-comando.md);
- [`admin-visao-geral.md`](./admin-visao-geral.md);
- [`admin-console.md`](./admin-console.md);
- [`admin-marketing-visao-geral.md`](./admin-marketing-visao-geral.md).

---

## 13. Banco e migrations

Toda mudança de schema usa uma migration nova. Migrations já aplicadas não são
reescritas para corrigir o passado; uma nova migration deve reconciliar o estado
quando necessário.

O processo de deploy aplica migrations antes de iniciar a nova versão da
aplicação. Falha de migration deve impedir a versão incompatível de subir.

Operações críticas que alteram múltiplas tabelas devem usar transação quando a
atomicidade fizer parte do contrato do domínio.

---

## 14. Testes e CI/CD

A cobertura de validação combina:

- ESLint;
- build Vite;
- Vitest/Testing Library;
- migrations em PostgreSQL de teste;
- Jest/Supertest/PostgreSQL;
- auditorias de dependências;
- Playwright em Chromium e WebKit, com cobertura mobile aplicável.

O fluxo normal é:

```text
branch
  → pull request
  → Quality Gate
  → revisão do diff
  → merge autorizado em main
  → deploy Railway
  → migrations
  → healthcheck
  → smoke test e logs
```

Detalhes ficam em [`deploy-seguro.md`](./deploy-seguro.md) e
[`dependency-security.md`](./dependency-security.md).

---

## 15. Regra de evolução arquitetural

A arquitetura não é um fim em si mesma. Antes de introduzir abstração,
tecnologia ou reorganização ampla, avaliar:

1. qual problema real está sendo resolvido;
2. se o fluxo existente pode ser preservado;
3. impacto em frontend, backend, banco, segurança e testes;
4. se uma mudança menor e reversível resolve o mesmo problema;
5. como a alteração será validada e operada depois do deploy.

Quando código e documentação divergirem, o código executável e as migrations
representam o estado implementado. A divergência deve ser corrigida na memória
do repositório para não orientar mudanças futuras a partir de uma regra antiga.