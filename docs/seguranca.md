# Segurança do Agenda Fashion

> Superfícies verificadas contra a `main` em 26 de agosto de 2026.

Este documento registra proteções e regras duráveis. Ele **não é uma certificação de segurança** nem substitui revisão de código, testes, auditoria de dependências ou análise de configuração de produção.

## Autenticação atual

O backend usa JWT e bcrypt. O token de sessão é colocado em cookie pelo backend.

Em produção, o cookie atual usa o nome `__Host-af_session` e opções:

- `HttpOnly`;
- `Secure` em produção;
- `SameSite=Lax`;
- `Path=/`.

Durante a migração compatível, o código ainda aceita Bearer token quando presente. Não remover essa compatibilidade sem verificar consumidores e testes.

O login com Google usa Google Identity por meio do backend.

## Senhas

O cadastro valida senha entre 8 e 72 bytes. O custo do bcrypt é configurável dentro do intervalo aceito pelo código, com fallback atual em 10 rounds.

O fluxo de recuperação de senha possui endpoints próprios e service dedicado. O comportamento exato de token, expiração e persistência deve ser verificado em `passwordResetService` e migrations antes de qualquer alteração.

## Proteções HTTP verificadas

`src/server.js` atualmente:

- desativa `x-powered-by`;
- usa `helmet`;
- configura Content Security Policy por `securityHeaders`;
- limita JSON de requisição a 1 MB;
- gera/propaga `X-Request-ID`;
- usa CORS configurado centralmente;
- possui healthchecks separados de liveness e readiness.

Rotas de cadastro, login e recuperação de senha possuem rate limiting dedicado.

## Autorização e isolamento entre negócios

Regras obrigatórias:

- não confiar em `negocio_id`, papel ou permissão enviados pelo frontend;
- resolver vínculos e papéis no backend;
- filtrar recursos pelo negócio autorizado;
- validar dono/profissional conforme a operação;
- não expor dados de outro negócio por erro de IDOR;
- operações críticas que alteram múltiplas tabelas devem usar transação quando necessário.

O fato de uma rota usar autenticação não prova isolamento correto. Mudanças em repositories/services que recebem IDs devem ser revisadas em conjunto com autorização e testes.

## Pagamentos e webhooks

- chave de API do Asaas e token de webhook são segredos diferentes;
- o webhook deve validar o token configurado;
- eventos financeiros são deduplicados/idempotentes;
- checkout usa chave de idempotência;
- preço, plano, limite e estado financeiro são validados no backend;
- retorno do navegador não confirma pagamento.

Consulte `docs/pagamentos.md`, `docs/checkout-idempotente.md` e `docs/webhook-asaas.md`.

## WhatsApp

A integração usa WhatsApp Cloud API oficial. A fila e o webhook possuem regras específicas de consentimento, deduplicação e entrega. Tokens de acesso não devem ser persistidos no banco ou aparecer em logs.

Consulte `docs/whatsapp-automatico.md`.

## Analytics e consentimento

O sistema possui mecanismos separados para consentimento de marketing/Meta e Google. Identificadores opcionais e eventos server-side devem respeitar a decisão vigente do usuário.

Não enviar PII ou identificadores adicionais a provedores simplesmente porque a API permite. O contrato atual de eventos usa allowlists e sanitização.

Consulte `docs/analytics.md`.

## Segredos

Segredos nunca devem aparecer:

- no Git;
- no bundle frontend;
- em screenshots de documentação;
- em logs;
- em mensagens de erro devolvidas ao cliente.

Arquivos `.env.example` devem conter apenas nomes e valores exemplificativos não sensíveis.

## Checklist mínimo para mudança sensível

Antes de considerar uma alteração de autenticação, pagamentos, permissões, webhook ou privacidade concluída:

1. mapear ameaça e abuso provável;
2. validar autenticação e autorização no backend;
3. confirmar isolamento entre negócios;
4. revisar logs e mensagens de erro;
5. testar repetição/concorrência quando houver idempotência;
6. atualizar migrations sem reescrever as já aplicadas;
7. adicionar teste de regressão proporcional ao risco;
8. rodar lint, build, testes e `npm audit` aplicáveis;
9. revisar diff antes de deploy.

## Referências técnicas

- cookie de sessão: `src/config/sessionCookie.js`;
- autenticação: `src/services/authService.js` e `src/controllers/authController.js`;
- rate limits: `src/middlewares/rateLimits.js`;
- headers/CSP: `src/config/securityHeaders.js` e `src/server.js`;
- isolamento por negócio: repositories/services de cada domínio;
- CI de segurança/dependências: `.github/workflows/backend-ci.yml`.