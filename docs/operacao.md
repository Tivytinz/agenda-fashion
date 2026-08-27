# Operação do Agenda Fashion

> Estado revisado contra a `main` em 26 de agosto de 2026.

Este documento registra o fluxo operacional que pode ser comprovado no repositório atual. Configurações externas de produção, como variáveis e estado real dos serviços no Railway, devem ser consultadas no provedor quando a resposta depender delas.

## Execução e deploy

O `package.json` atual define:

- `npm start`: executa `npm run migrate:deploy` e depois inicia `node src/server.js`;
- `npm run migrate:deploy`: usa `scripts/migrate-deploy.js`;
- `npm run migrate`: aplica migrations pelo runner versionado;
- `npm test`: executa Jest;
- `npm run frontend:build`: gera o frontend React;
- `npm run frontend:test`: executa os testes do frontend.

Migrations são parte do processo de inicialização de produção. Migration já aplicada não deve ser reescrita; uma mudança de schema exige nova migration.

## Railway

O repositório possui `railway.json` com:

- healthcheck em `/health/ready`;
- timeout de healthcheck de 120 segundos;
- reinício em falha;
- máximo atual de três tentativas de reinício configuradas nesse arquivo.

Isso comprova a configuração versionada. Não afirmar que um deploy específico está saudável sem consultar a execução ou o ambiente correspondente.

## Healthchecks

O servidor expõe:

- `/health`: resposta básica da aplicação;
- `/health/live`: liveness;
- `/health/ready`: readiness com verificação do PostgreSQL e do estado esperado de migrations.

O readiness retorna indisponibilidade quando o banco falha ou quando o estado de migrations impede considerar a aplicação pronta.

## Workers iniciados pelo backend

O servidor atual importa e gerencia workers para:

- processamento de webhooks do Asaas;
- fila de mensagens do WhatsApp;
- sincronização de custos de marketing.

Antes de alterar concorrência, frequência, retries ou desligamento de qualquer worker, verifique o service específico e seus testes. A existência do import no servidor não substitui a leitura da lógica do worker.

## CI

O workflow versionado `.github/workflows/backend-ci.yml` roda em pull requests e pushes para `main`.

A pipeline atual inclui:

1. PostgreSQL 17 de teste;
2. Node.js 22;
3. `npm ci` no backend;
4. instalação das dependências do frontend;
5. lint do frontend;
6. build React;
7. Vitest;
8. migrations no banco de teste;
9. Jest com cobertura;
10. `npm audit --omit=dev --audit-level=high`;
11. instalação de Chromium e WebKit;
12. Playwright.

Uma mudança não deve ser considerada pronta para integração quando uma etapa obrigatória relacionada ao seu escopo estiver falhando.

## Antes de deploy

Para mudança relevante:

1. revisar o diff;
2. confirmar migrations novas e sua ordem;
3. executar lint/build/testes aplicáveis;
4. verificar que segredos não entraram no Git ou no bundle;
5. validar contratos entre frontend e backend;
6. revisar impacto em workers, webhooks e integrações;
7. não fazer merge ou deploy sem solicitação explícita do usuário.

## Depois de deploy

Quando houver autorização para publicação, validar conforme o risco:

- readiness e liveness;
- jornada crítica alterada;
- logs e `X-Request-ID` para falhas;
- processamento de webhooks quando afetado;
- fila de WhatsApp quando afetada;
- sincronização de custos quando afetada;
- métricas de erro e comportamento observável disponíveis no ambiente.

Não declarar sucesso apenas porque o processo de deploy terminou. Deploy concluído e funcionalidade validada são fatos diferentes.

## Incidentes e regressões

Ao surgir falha:

1. reproduzir e identificar a causa raiz;
2. proteger o comportamento com teste quando possível;
3. preferir correção pequena e reversível;
4. evitar apagar evidência útil dos logs;
5. não contornar migration ou integridade apenas para restaurar a tela rapidamente;
6. atualizar documentação quando o incidente revelar uma regra operacional durável.

## Referências

- scripts e dependências: `package.json`;
- CI: `.github/workflows/backend-ci.yml`;
- Railway: `railway.json`;
- servidor e healthchecks: `src/server.js`;
- readiness: `src/services/readinessService.js`;
- migrations: `database/migrations/` e `scripts/migrate*.js`;
- worker Asaas: `src/services/webhookService.js`;
- worker WhatsApp: `src/services/whatsappMensagemService.js`;
- custos de marketing: `src/services/marketingCostSyncWorker.js`.