# Arquitetura Oficial — Agenda Fashion

> Revisada contra a `main` em 26 de agosto de 2026.

Este documento descreve a arquitetura técnica atual. Produto, growth, analytics, pagamentos, segurança, UX e operação possuem documentos próprios em `docs/`. O mapa completo está em `docs/README.md`.

Quando houver divergência, código executável e migrations representam o estado implementado.

## Stack atual

| Área | Tecnologia |
| --- | --- |
| Runtime | Node.js 22 |
| Backend | Express 5 e JavaScript CommonJS |
| Banco | PostgreSQL via `pg` |
| Frontend | React 19, React Router 7, Vite 7 e CSS |
| Autenticação | JWT, cookie `HttpOnly`, bcrypt e Google Identity |
| Uploads | Busboy, validação de conteúdo e Cloudinary |
| Pagamentos | Asaas e PIX |
| WhatsApp | WhatsApp Cloud API oficial |
| Analytics/Ads | eventos internos, GA4/Google Ads e Meta |
| Testes backend | Jest, Supertest e PostgreSQL de teste |
| Testes frontend | Vitest e Testing Library |
| E2E | Playwright em Chromium e WebKit |
| CI/CD | GitHub Actions e Railway |
| Domínio | `app.agendafashion.com.br` |

A base oficial continua Node.js, Express, React e PostgreSQL. Não reescrever o sistema ou trocar tecnologia apenas por novidade. TypeScript pode ser adotado gradualmente quando houver benefício concreto e plano de migração seguro.

## Visão de camadas

O backend segue predominantemente:

```text
HTTP
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

Responsabilidades transversais usam `middlewares`, `validators`, `config`, `domain`, `providers`, `utils`, `constants` e `errors`.

### Routes

Definem caminhos e middlewares e encaminham para controllers. Não devem concentrar SQL ou regra de negócio.

### Controllers

Traduzem HTTP para casos de uso: extraem campos permitidos, chamam services, definem resposta e encaminham erros. Não devem ser autoridade de preço, limite, permissão ou integridade financeira.

### Services

Coordenam regras de negócio e integrações. Podem usar repositories, providers, validators e outros services.

SQL novo deve ficar em repositories. Services antigos que ainda possuam SQL direto são dívida técnica, não padrão para código novo.

### Repositories

Concentram acesso a PostgreSQL, consultas, agregações, bloqueios e operações transacionais de persistência.

### Domain

`src/domain/` concentra regras e vocabulário reutilizável de domínio que não pertencem a HTTP ou persistência, como especialidades e categorias de catálogo.

### Providers

`src/providers/` abriga adaptadores de infraestrutura/provedores externos quando a integração é estruturada dessa forma.

### Middlewares, validators e config

Tratam autenticação/autorização transversal, validação, rate limits, erro, logs e configurações compartilhadas.

## Estrutura atual relevante

```text
agenda-fashion/
├── AGENTS.md
├── .github/
│   └── workflows/
├── database/
│   └── migrations/
├── docs/
├── frontend/
│   ├── e2e/
│   └── src/
│       ├── analytics/
│       ├── api/
│       ├── assets/
│       ├── auth/
│       ├── components/
│       ├── config/
│       ├── hooks/
│       ├── pages/
│       ├── styles/
│       └── utils/
├── scripts/
├── src/
│   ├── config/
│   ├── constants/
│   ├── controllers/
│   ├── db/
│   ├── docs/
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
├── tests/
├── package.json
└── railway.json
```

A árvore acima destaca diretórios arquiteturalmente relevantes e não pretende listar cada arquivo do repositório.

## Rotas e contrato HTTP

O router principal registra os módulos sem um prefixo global `/api`. O módulo de serviços é montado em `/servicos`, enquanto os demais módulos atuais já carregam seus caminhos completos ou são registrados diretamente.

Não introduzir `/api` apenas em parte do contrato. Uma mudança de namespace deve ser planejada para frontend, backend, integrações, testes e compatibilidade.

Rotas atuais abrangem autenticação/sessão, negócios/conta, profissionais, serviços, planos, checkout/assinatura, webhooks, favoritos, dashboard, notificações, eventos de produto, Meta, Google Measurement, agendas, perfil público e administração.

## Banco e migrations

PostgreSQL é a fonte persistente do sistema. Alterações de schema devem ser feitas por nova migration em `database/migrations/`.

Regras:

- migration aplicada nunca deve ser reescrita;
- uma migration antiga pode representar apenas uma etapa histórica;
- ao entender o estado atual, leia migrations posteriores e o código que usa o schema;
- operações críticas que alteram mais de uma tabela devem usar transação quando necessário;
- limites, autorização e integridade não podem depender do frontend.

O deploy atual executa `migrate:deploy` antes de iniciar o servidor.

## Autenticação e sessão

O backend gera JWT e o frontend moderno recebe a sessão por cookie configurado pelo servidor.

Em produção o cookie atual é `__Host-af_session` com `HttpOnly`, `Secure`, `SameSite=Lax` e `Path=/`. O backend ainda aceita Bearer token como compatibilidade de migração.

Cadastro, login e recuperação de senha possuem rate limits dedicados. Login com Google é processado pelo backend.

Detalhes e requisitos de segurança ficam em `docs/seguranca.md`.

## Frontend

O frontend principal é React. O código-fonte vive em `frontend/src/`, com módulos dedicados para páginas, componentes, autenticação, API, analytics, configuração, assets, hooks, estilos e utilitários.

O build de produção é servido pelo Express a partir do diretório `agendamento-nails/react-app/` conforme a configuração atual do servidor. Rotas de aplicação são resolvidas em conjunto com React Router e compatibilidades de caminhos existentes.

Mudanças de contrato devem manter frontend e backend sincronizados.

## Agendamentos

A arquitetura possui services separados para configuração de agenda, disponibilidade, agenda autenticada e agendamento público.

Confiabilidade de horários é requisito central. Alterações em disponibilidade, capacidade ou criação de agendamento devem considerar concorrência, transações, limites de plano, timezone e testes de regressão.

Detalhes de produto ficam em `docs/produto.md`.

## Pagamentos

O domínio usa Asaas e PIX. Checkout, assinatura, integração com o provedor e processamento de webhook possuem services separados.

Checkout e webhooks usam mecanismos de idempotência/deduplicação persistidos. Criação de assinatura no provedor não deve ser tratada como confirmação de pagamento.

Consulte `docs/pagamentos.md`, `docs/checkout-idempotente.md` e `docs/webhook-asaas.md`.

## WhatsApp

Mensagens automáticas usam WhatsApp Cloud API e fila persistente no PostgreSQL. O servidor possui worker dedicado e webhook para estados/respostas.

Consentimento, opt-out, retries e regras de entrega ficam em `docs/whatsapp-automatico.md`.

## Analytics e marketing

O frontend possui módulos separados em `frontend/src/analytics/`. O backend possui eventos internos, Google Measurement, Meta, atribuição persistente, custos e serviços administrativos de marketing.

Atribuição e recomendação de campanha não devem ser reconstruídas arbitrariamente no navegador. O backend concentra a classificação e as regras auditáveis.

Consulte `docs/analytics.md` e `docs/growth.md`.

## Segurança HTTP e observabilidade básica

O servidor atual:

- usa Helmet e CSP configurada;
- desativa `x-powered-by`;
- usa CORS centralizado;
- limita JSON a 1 MB;
- gera ou preserva `X-Request-ID` válido;
- possui logger de requisição;
- expõe `/health`, `/health/live` e `/health/ready`.

O readiness verifica banco e estado de migrations antes de responder como pronto.

## Workers atuais

`src/server.js` gerencia workers para:

- webhooks do Asaas;
- mensagens do WhatsApp;
- sincronização de custos de marketing.

A lógica detalhada de intervalo, retry e concorrência deve ser lida no service correspondente antes de alteração.

## CI/CD

O workflow atual usa Node 22 e PostgreSQL 17 e executa:

1. instalação backend/frontend;
2. lint do frontend;
3. build React;
4. Vitest;
5. migrations no banco de teste;
6. Jest com cobertura;
7. `npm audit` de dependências de produção em nível alto;
8. Playwright em Chromium e WebKit.

Railway usa `/health/ready` como healthcheck versionado.

Detalhes operacionais ficam em `docs/operacao.md`.

## Regras arquiteturais obrigatórias

1. Preservar separação entre HTTP, negócio e persistência.
2. Não adicionar SQL novo em routes/controllers/services.
3. Não confiar em IDs, papéis, preços, limites ou estados críticos enviados pelo frontend.
4. Validar autorização e isolamento entre negócios no backend.
5. Usar migrations novas para mudanças de banco.
6. Manter integrações financeiras e webhooks idempotentes.
7. Não expor segredos no Git, frontend ou logs.
8. Manter contratos frontend/backend sincronizados.
9. Criar testes proporcionais ao risco.
10. Não considerar deploy concluído como prova de funcionalidade validada.

## Documentos relacionados

- mapa geral: `docs/README.md`;
- produto: `docs/produto.md`;
- planos: `docs/planos.md`;
- growth: `docs/growth.md`;
- analytics: `docs/analytics.md`;
- pagamentos: `docs/pagamentos.md`;
- segurança: `docs/seguranca.md`;
- UX: `docs/ux.md`;
- operação: `docs/operacao.md`;
- WhatsApp: `docs/whatsapp-automatico.md`;
- memória operacional: `AGENTS.md`.