# Deploy seguro do Agenda Fashion

> **Papel documental:** runbook canônico do fluxo branch → PR → Quality Gate → merge → Railway → migrations → readiness → smoke test. Detalhes de build, cache, chunks e recuperação do frontend ficam em [`frontend-entrega-runtime.md`](./frontend-entrega-runtime.md).

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
7. auditorias dos grafos backend/tooling, runtime e frontend no nível configurado;
8. Playwright de UX em Chromium e WebKit, incluindo jornadas mobile aplicáveis;
9. acceptance full-stack em Chromium com frontend buildado, Express e PostgreSQL reais, sem mocks de API no fluxo coberto.

Execuções obsoletas da mesma PR ou ref podem ser canceladas para que apenas a revisão mais recente seja considerada.

Os testes Playwright de UX podem interceptar APIs quando o objetivo é validar navegação, responsividade e estados de interface. Isso não os torna testes full-stack. A suíte separada em `frontend/e2e-fullstack` existe para validar contratos P0 contra a aplicação servida pelo Express e o PostgreSQL de teste reais. O workflow `Security CI` complementa o Quality Gate com análise CodeQL. Revisão automática do diff de dependências depende do Dependency Graph do GitHub e permanece fora do gate até essa configuração externa ser habilitada e validada.

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

<a id="dominios-publicos"></a>

### Domínios públicos e migração

| Host | Contrato |
| --- | --- |
| `agendafashion.com.br` | Origem pública canônica; HTML, APIs e assets no mesmo serviço. |
| `app.agendafashion.com.br` | Compatibilidade com links antigos; GET/HEAD HTML redirecionam para a mesma rota e query na origem canônica. |
| `www.agendafashion.com.br` | Alias de entrada; mesmo contrato de redirecionamento HTML. |

A configuração abaixo é externa ao Git e deve ser aplicada somente na etapa
operacional autorizada. Preparar o patch não cadastra domínios nem altera DNS.

1. No serviço `agenda-fashion`, ambiente `production`, manter o domínio raiz e
   cadastrar/restaurar cada alias em **Networking / Custom Domain**, apontando
   para a porta do serviço (8080 na configuração atual).
2. No DNS da zona `agendafashion.com.br`, criar ou ajustar os registros de `app`
   e `www` com os destinos e registros de verificação fornecidos pelo Railway
   para cada host. Conferir conflitos A/AAAA/CNAME antes de substituir um
   registro. Não deduzir o destino DNS apenas pelo nome do serviço.
3. Confirmar provisionamento de HTTPS e vínculo de ambos os aliases com esse
   serviço. DNS resolvendo, sozinho, não prova que o Railway reconhece o host;
   `x-railway-fallback: true` com 404 indica que o Express não foi alcançado.
4. Publicar o patch aprovado pelo fluxo normal de CI/merge/deploy. Manter
   `PUBLIC_APP_URL` e `VITE_PUBLIC_APP_URL` em `https://agendafashion.com.br`.
   Não ampliar cookies ou CORS apenas para compartilhar sessão entre aliases.
5. Verificar os redirects com `Accept: text/html`, sem seguir redirecionamentos
   no primeiro request, para conferir status e `Location`:

   ```bash
   curl -sS -o /dev/null -D - -H 'Accept: text/html' 'https://app.agendafashion.com.br/para-profissionais?utm_source=seo-check'
   curl -sS -o /dev/null -D - -H 'Accept: text/html' 'https://www.agendafashion.com.br/para-profissionais?utm_source=seo-check'
   ```

   Ambos devem responder 308 para
   `https://agendafashion.com.br/para-profissionais?utm_source=seo-check`.
   Verificar também HEAD, a home e um perfil público existente. A resposta final
   deve ser 200 com canonical no domínio raiz, sem UTM. APIs JSON e webhooks
   devem preservar o contrato, sem redirects HTML indiscriminados no CDN.
6. Conferir `/sitemap.xml` e `/robots.txt` nas URLs exatas após expirar ou invalidar
   seus caches (TTL atual: 1 hora e 24 horas, respectivamente). O sitemap deve
   apontar para o domínio raiz e omitir `lastmod` quando não há data factual.
7. No Search Console, conferir o sitemap, a inspeção da home e de páginas públicas
   importantes, o último rastreamento e a canonical escolhida pelo Google.
   Solicitar novo rastreamento das páginas alteradas quando necessário. Se houver
   propriedade de prefixo de URL do subdomínio antigo, avaliar a ferramenta de
   mudança de endereço depois de validar os redirects. Manter os redirects
   legados por pelo menos um ano, preferencialmente enquanto houver links antigos.

“URL está no Google” comprova indexação, não posição para uma consulta específica.
Para investigar a marca, usar **Desempenho** com filtro de consulta e comparar
impressões, posição, país e dispositivo em períodos equivalentes. Não atribuir
variações de ranking ao sitemap ou prometer prazo/posição sem essa evidência.

Referências: [migração de URLs](https://developers.google.com/search/docs/crawling-indexing/site-move-with-url-changes?hl=pt-BR)
e [datas no sitemap](https://developers.google.com/search/docs/crawling-indexing/sitemaps/build-sitemap?hl=pt-BR).

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
