# Admin Wave 4 — Qualificação operacional de RF41 e RNF02

## Objetivo

Comprovar o desempenho das leituras e escritas críticas de auditoria sob a
carga normal definida no QA, preservando a trilha exigida por RF41 e a permissão
de RN25. A especificação v1.17 define em RNF02 p95 ≤ 2 s para APIs críticas; o
critério formal CA-NFR-05 também trata LCP de **páginas públicas**, que não é
um número medido pelas páginas do Admin.

A Wave 3 já passou no CI, incluindo PostgreSQL e mobile. Isso valida o código,
mas não mede o p95 de um serviço implantado com volume operacional. `ADM-043`
permanece **Não coberto (41/43)** até a qualificação abaixo.

## Instrumentação

- `scripts/performance-admin-audit.mjs` mede quatro consultas superadmin:
  recentes, pendentes, revisadas e por ator (três aquecimentos, 30 amostras,
  concorrência 3). É somente leitura. Exige `PERF_ADMIN_BUILD_SHA` e confere
  a identidade declarada pelo serviço QA em `/health/ready`.
- `scripts/performance-admin-audit-qa.mjs` mede criação de campanha auditada e
  revisão de pendência, com três aquecimentos e 30 amostras por cenário,
  concorrência 3, timeout de 15 s e limite de p95 de 2.000 ms. Exige um
  aplicativo HTTP em loopback e PostgreSQL QA acessível em loopback, com banco
  descartável cujo nome termine em `_test` ou `_qa`, `NODE_ENV=test`, token de
  superadmin desse banco e SHA do build sob teste. `NODE_ENV=test` é exigido
  no processo do medidor; registrar separadamente o modo do aplicativo QA.
  Não aceita URL de produção.
- A ferramenta cria tentativas pendentes há 15 minutos, verifica uma delas por
  `GET /admin/auditoria` **antes** da primeira escrita HTTP e usa identidade UTM
  única para campanhas de QA. Confere depois cada revisão e o par
  `INICIADA`/`RESULTADO` de todas as escritas por hash do request ID. Ela não
  elimina o histórico append-only. Descartar o banco QA após a execução.
- O p95 é tempo de resposta HTTP até leitura do JSON: inclui autenticação,
  preflight de auditoria e a operação. `RESULTADO` é escrito depois da resposta;
  sua presença é verificada à parte, sem ser confundida com tempo de resposta.

## Dados e execução

Preparar um clone **descartável** ou uma base QA com aplicação e PostgreSQL
dedicados. Comparar tamanho de `admin_auditoria_eventos`, quantidade de
`admin_auditoria_revisoes`, distribuição de resultados/pendências e recursos da
aplicação e banco com o volume normal esperado. Definir os mínimos explícitos
`PERF_ADMIN_MIN_ATTEMPTS` e `PERF_ADMIN_MIN_REVIEWS` com base nessa comparação.
Os mínimos impedem rodar acidentalmente em base vazia; sozinhos não provam
representatividade. Executar com o serviço local apontando para o **mesmo banco
QA**; a consulta de preflight comprova o vínculo antes de qualquer POST.
Iniciar o aplicativo QA com `PERF_ADMIN_QA_BUILD_SHA` obtido do commit
efetivamente usado no checkout/deployment. O healthcheck só publica esse SHA
opcional quando configurado; os dois medidores param se ele não corresponder
ao `PERF_ADMIN_BUILD_SHA` esperado. Essa comparação evita medir por engano uma
instância antiga, mas a origem do SHA e o artefato executado ainda devem ser
registrados para a evidência operacional; uma variável isolada não prova o
conteúdo implantado.

Exemplo de variáveis de ambiente (fornecer segredos fora do histórico do shell):

```sh
NODE_ENV=test \
PERF_ADMIN_TARGET_URL=http://127.0.0.1:3000 \
PERF_ADMIN_QA_DATABASE_URL='postgresql://.../agenda_fashion_qa' \
PERF_ADMIN_QA_DATABASE_NAME=agenda_fashion_qa \
PERF_ADMIN_BUILD_SHA='...sha-de-40-caracteres...' \
PERF_ADMIN_MIN_ATTEMPTS='...minimo-representativo...' \
PERF_ADMIN_MIN_REVIEWS='...minimo-representativo...' \
PERF_ADMIN_TOKEN='...token-superadmin-do-qa...' \
node scripts/performance-admin-audit-qa.mjs
```

Para as leituras, fornecer novamente `PERF_ADMIN_TARGET_URL`,
`PERF_ADMIN_TOKEN`, `PERF_ADMIN_BUILD_SHA` e `PERF_ADMIN_ACTOR_ID` com o ID do
ator de QA (atribuições inline no comando anterior não persistem no shell).
Usar o limite padrão de 2.000 ms:

```sh
node scripts/performance-admin-audit.mjs
```

Guardar a saída JSON dos **seis** cenários com horário, SHA do build,
configuração da aplicação/banco, origem da carga, volumes antes da execução e
comparação com o perfil normal. Não guardar token nem string de conexão. No
script de escritas, os registros de QA persistem no banco descartável. Medir
separadamente a consulta de pendências após a criação de revisões para observar
o caso com cardinalidade alta; a ordenação e o `COUNT(*)` podem exigir análise
de `EXPLAIN (ANALYZE, BUFFERS)` quando houver lentidão. Só alterar consulta ou
índice diante de evidência do plano e repetir a medição no mesmo perfil.

## Critérios de saída

- **CA-ADM-13:** p95 ≤ 2 s para as quatro leituras, criação auditada e revisão,
  sob carga normal representativa, ligado ao commit/deployment medido.
- **CA-ADM-14:** cada escrita de QA produz um `INICIADA` e um `RESULTADO`, a
  revisão referencia uma tentativa preparada e o run é bloqueado se o alvo
  HTTP consultar outro banco. Resultado HTTP não implica conclusão de jobs
  externos.
- Se qualquer p95 ultrapassar a meta, houver falha/timeout ou a trilha ficar
  incompleta, investigar, corrigir e repetir. Uma execução apenas sintética
  não fecha ADM-043.
- Depois de evidência operacional, atualizar a matriz para **42/43**. A última
  lacuna, `ADM-030`, depende de adaptador factual real de custo atribuível ao
  `negocio_id`, idempotência, reversões e evidência de cobertura; a Wave 4 não
  habilita custos estimados nem presume uma fonte.
