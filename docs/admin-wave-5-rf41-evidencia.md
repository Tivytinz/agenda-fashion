# Admin Wave 5 — Evidência operacional de RF41 e RNF02

## Estado e objetivo

A Wave 4 entregou medidores e testes, não uma medição operacional. Esta Wave
prepara a verificação de que a aplicação QA executa o commit declarado e inclui
o filtro `REVISADA` nas leituras. **ADM-043 permanece Não coberto (41/43)** até
que os seis cenários abaixo passem sob carga e volumes representativos. RF41
trata rastreabilidade, RN25 trata autorização e RNF02 exige p95 ≤ 2 s para APIs
críticas. O LCP de páginas públicas do CA-NFR-05 é uma medição separada.

## Execução com dados e instância isolados

1. Registrar o commit de origem, a configuração de aplicação/banco QA, volume
   normal esperado e cardinalidades da trilha (tentativas, resultados,
   pendências e revisões). Definir mínimos de tentativas e revisões antes do
   ensaio. Mínimos isolados não demonstram representatividade.
2. Preparar um banco descartável `*_qa` ou `*_test`, sem dados pessoais reais,
   e uma aplicação acessível apenas em loopback. Configurar nela
   `PERF_ADMIN_QA_BUILD_SHA` com o SHA de 40 caracteres do build implantado.
   Conferir o artefato/checkout que deu origem a esse valor. O healthcheck
   `/health/ready` devolve `buildSha` apenas quando configurado.
3. Usar o mesmo SHA como `PERF_ADMIN_BUILD_SHA` nos dois medidores. O processo
   do medidor de escritas exige `NODE_ENV=test` e PostgreSQL local descartável.
   O serviço QA pode usar outro `NODE_ENV`; registrar esse modo e verificar se
   seus recursos e configuração reproduzem a carga normal. Um serviço em modo
   `test` pode omitir comportamento de produção e não deve ser presumido
   representativo.
4. Executar primeiro `scripts/performance-admin-audit-qa.mjs` seguindo
   `admin-wave-4-rf41-qualificacao.md`. Antes das escritas, ele verifica o
   healthcheck, os volumes mínimos e uma tentativa inserida no mesmo banco
   através da API. Confirmar cada revisão e os pares `INICIADA`/`RESULTADO`.
5. Executar depois `scripts/performance-admin-audit.mjs` com token de
   superadmin de QA e `PERF_ADMIN_ACTOR_ID`. Medir `recentes`, `pendentes`,
   `revisadas` e `ator` no banco já povoado pelas escritas. Guardar p95, total
   de amostras, concorrência, data, commit e contagens antes/depois, sem token,
   contato, payload nem URL com credenciais.

## Condições de encerramento

- **CA-ADM-13:** p95 ≤ 2.000 ms nas quatro leituras e nas duas escritas,
  medido sob carga operacional normal e vinculado ao build que respondeu.
- **CA-ADM-14:** cada escrita gera uma tentativa e um resultado HTTP; revisão
  referencia a tentativa preparada. O status HTTP não prova que job externo
  concluiu, e a classificação humana não fabrica um resultado HTTP ausente.
- **RN25/RF41:** manter cobertura de autorização superadmin, auditabilidade,
  imutabilidade e semântica de pendência nos testes PostgreSQL e no QA.
- Se qualquer cenário falhar, investigar a consulta com
  `EXPLAIN (ANALYZE, BUFFERS)` em QA, corrigir a causa específica e repetir
  sob o mesmo perfil. Não ajustar índices apenas por hipótese.
- Só após evidência verificável atualizar ADM-043 para Coberto e a matriz para
  **42/43 (97,7%)**. ADM-030 continua independente e exige fonte factual real
  de custos variáveis atribuíveis a negócio; não estimar custo nem antecipar
  43/43.

Os testes automatizados dos medidores provam validação de entrada e rejeição
de build divergente. Eles não substituem a execução representativa. O Quality
Gate da branch valida regressões de código, mas não fornece essa evidência.
