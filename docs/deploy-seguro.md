# Deploy seguro do Agenda Fashion

## Objetivo

O deploy do Agenda Fashion deve impedir que uma alteração conhecida como inválida chegue à produção e deve tornar explícita a ordem entre revisão, CI, merge, deploy, migrations e healthcheck.

O GitHub Actions é a fonte do quality gate do código. O Railway é responsável pelo build e execução da aplicação, mas não deve antecipar a publicação de um commit cuja validação obrigatória ainda não terminou.

## Quality gate oficial

O workflow `.github/workflows/backend-ci.yml` expõe o job estável `Quality gate` dentro do workflow `Backend CI`.

Ele valida, na mesma revisão:

1. instalação reprodutível de dependências com `npm ci`;
2. lint do frontend;
3. build de produção do frontend;
4. testes Vitest;
5. migrations em PostgreSQL de teste;
6. Jest com coverage;
7. auditoria de dependências de produção no nível configurado;
8. Playwright em Chromium e WebKit, incluindo jornadas mobile aplicáveis.

Execuções obsoletas da mesma PR ou ref podem ser canceladas para que apenas a revisão mais recente seja considerada.

## Ordem obrigatória

O fluxo operacional esperado é:

```text
branch
  -> pull request
  -> Backend CI / Quality gate = success
  -> revisão do diff
  -> merge autorizado em main
  -> Railway aguarda os checks do commit de main
  -> build/deploy
  -> migrations de deploy
  -> /health/ready
  -> smoke tests e inspeção de logs
```

Um deploy iniciado antes de o quality gate obrigatório do commit terminar é uma lacuna de proteção, mesmo quando o mesmo código já passou em uma execução anterior de PR.

## Configuração externa necessária

Parte da proteção não vive no Git e precisa ser configurada nos provedores.

### GitHub

A branch `main` deve possuir proteção/ruleset que:

- exija pull request para mudanças normais;
- exija o status check `Backend CI / Quality gate` antes do merge;
- exija que a branch esteja atualizada quando essa política for adotada pelo time;
- impeça bypass acidental das validações obrigatórias, preservando apenas exceções administrativas deliberadas.

A configuração deve ser confirmada pela leitura do ruleset/branch protection depois de aplicada.

### Railway

O serviço de produção conectado à `main` deve aguardar os GitHub check suites do commit antes de publicar. Na integração Railway, a opção equivalente a `checkSuites` deve permanecer habilitada para produção.

Depois da alteração, deve ser feita uma validação real com um commit/PR controlado para confirmar a ordem:

```text
CI iniciado -> CI concluído com sucesso -> deploy iniciado
```

Não basta confiar apenas no valor salvo da configuração.

## Migrations e startup

O comando de produção continua responsável por aplicar migrations antes de iniciar o servidor. Migrations aplicadas nunca devem ser reescritas.

Falha de migration deve impedir a nova versão de subir. O healthcheck `/health/ready` deve validar a prontidão da aplicação antes de o deployment ser considerado saudável.

## Pós-deploy

Depois de cada deploy relevante, verificar no mínimo:

- status do deployment;
- `/health/ready`;
- logs de inicialização;
- erros novos de banco;
- workers e integrações afetados pela mudança;
- smoke test do fluxo modificado;
- métricas ou eventos necessários para detectar regressão.

Um deployment com status `SUCCESS` prova que a plataforma concluiu a publicação, mas não substitui smoke tests do comportamento alterado.

## Mudanças operacionais

Alterar branch protection, rulesets, configuração de integração do Railway, deploy automático ou estratégia de produção é uma mudança operacional externa ao código. Deve ser feita somente com autorização explícita e validada por leitura posterior da configuração e por evidência de execução.
