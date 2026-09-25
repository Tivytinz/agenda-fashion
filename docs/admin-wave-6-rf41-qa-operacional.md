# Admin Wave 6 — Preparação do QA operacional de RF41/RNF02

## Objetivo e estado

A Wave 5 deixou seis cenários prontos: quatro leituras da auditoria e duas
escritas auditadas. A Wave 6 adiciona um perfil agregado de referência, carga
sintética e um executor que reúne os seis cenários e verifica volumes, build e
integridade. **Nenhuma medição representativa foi realizada nesta preparação.
ADM-043 continua Não coberto (41/43).**

O teste automático de CI valida o código, não o p95 de uma aplicação implantada
sob carga normal. O ambiente Railway `test` observado na análise possui apenas
PostgreSQL; não tratá-lo como banco descartável nem como aplicação QA pronta.

## 1. Obter referência sem copiar registros

`scripts/profile-admin-audit-volume.js` consulta apenas agregados: tentativas,
resultados, revisadas sem resultado, pendentes, ocorrências nos últimos 30 dias,
quantidade de atores e contagens por ação. A transação é `READ ONLY` e tem
`statement_timeout` de 10 s. Usar uma conexão de leitura apropriada, sem
imprimir credenciais ou salvar dados pessoais. Exemplo com variáveis injetadas
fora do histórico do shell:

```sh
PERF_ADMIN_PROFILE_DATABASE_URL=... \
PERF_ADMIN_PROFILE_CONFIRM_DATABASE=... \
PERF_ADMIN_PROFILE_READ_ONLY=auditoria \
node scripts/profile-admin-audit-volume.js > referencia-auditoria.json
```

O nome confirmado deve ser exatamente o nome real do banco. Se a consulta
atingir o timeout, definir uma fonte agregada menos custosa para os mesmos
contadores; não elevar o tempo sobre produção por suposição. Preservar apenas
o relatório agregado em local apropriado e registrar a data de referência.

## 2. Preparar banco isolado e perfil sintético

Criar **um banco novo, vazio e descartável**, com nome `*_qa` ou `*_test`,
PostgreSQL e migrations do commit a medir. Não apontar o script ao PostgreSQL
persistente do Railway `test` ou a um túnel para produção. Obter as contagens de
`results`, `reviews` e `pending` a partir do perfil agregado, ajustando apenas
o mínimo necessário para exercitar cada cenário e documentando o ajuste.

`scripts/seed-admin-audit-qa.js` exige `NODE_ENV=test`, host loopback,
confirmação dupla do nome, pelo menos 100 tentativas, cada grupo não vazio,
`results + reviews + pending = attempts` e ledger vazio. Ele cria somente fatos
sintéticos sem usuário, contato, payload ou identificador real; uma falha faz
`ROLLBACK`. Não apaga nem reescreve eventos append-only. Exemplo:

```sh
NODE_ENV=test \
PERF_ADMIN_QA_DATABASE_URL=... \
PERF_ADMIN_QA_DATABASE_NAME=agenda_fashion_qa \
PERF_ADMIN_SEED_CONFIRM=agenda_fashion_qa \
PERF_ADMIN_SEED_ATTEMPTS=1000 \
PERF_ADMIN_SEED_RESULTS=800 \
PERF_ADMIN_SEED_REVIEWS=100 \
PERF_ADMIN_SEED_PENDING=100 \
node scripts/seed-admin-audit-qa.js
```

Os números são **exemplo, não baseline do AF**. A carga distribui tentativas
entre três ações, cinquenta atores sintéticos e trinta dias; todas as
tentativas ficam dentro dessa janela. Comparar tamanho, cardinalidade,
distribuição de ações, idade dos registros, perfil de hardware e concorrência
com a referência. Uma distribuição incompatível torna o resultado diagnóstico,
mas não prova RNF02 sob carga normal. Não executar o seed novamente no mesmo
banco: ele recusa ledger já povoado.

## 3. Medir a aplicação QA

Iniciar a aplicação isolada contra **esse mesmo banco**, com usuário
superadmin de QA e `PERF_ADMIN_QA_BUILD_SHA` originado do commit executado.
Configurar recursos e modo da aplicação próximos dos normais e registrar as
diferenças. Não usar token ou credenciais de produção. A aplicação deve ser
acessível por loopback ao processo do medidor; o preflight verifica que ela lê
uma tentativa recém-criada no banco escolhido.

Configurar as variáveis de ambos os medidores segundo
`docs/admin-wave-4-rf41-qualificacao.md`. Para o exemplo de carga acima,
`PERF_ADMIN_ACTOR_ID=900000000001` seleciona um ator sintético presente.
O executor roda perfil QA inicial, duas escritas, quatro leituras e perfil QA
final, nessa ordem; confere SHA, volumes, os seis p95 e a integridade da
trilha. Ele aceita somente aplicação e banco em loopback, e não imprime
token ou connection string. Com os segredos já injetados no ambiente:

```sh
PERF_ADMIN_REFERENCE_FILE=referencia-auditoria.json \
node scripts/qualify-admin-audit-qa.js > evidencia-admin-043.json
```

Um p95 acima de 2 s consta no relatório como `p95Aprovado: false` e o comando
termina com código 1. Mesmo
com os seis cenários aprovados, o relatório mantém
`adm043: PENDENTE_VALIDACAO_REPRESENTATIVIDADE`: confrontar volume,
distribuição, idade dos registros, concorrência e recursos com a carga normal
real. Guardar o relatório JSON, a referência agregada, a configuração
não secreta da aplicação/banco, a data e a origem do SHA. Não guardar token
nem connection string. As etapas também podem ser executadas separadamente
para investigar um cenário específico.

## Saída da Wave

- **CA-ADM-13 / RNF02:** cada uma das seis operações deve ter p95 ≤ 2 s sob
  carga operacional normal representativa, ligada ao build realmente executado.
- **CA-ADM-14 / RF41:** escritas devem gerar `INICIADA` e `RESULTADO` para cada
  request ID; revisão referencia a tentativa sem fabricar resultado HTTP.
- **RN25:** autorização superadmin e proteção de dados continuam preservadas.
- Se houver lentidão, obter `EXPLAIN (ANALYZE, BUFFERS)` das consultas no QA,
  corrigir a causa e repetir no mesmo perfil antes de declarar cobertura.
- Só após evidência operacional verificável atualizar ADM-043 e a matriz para
  **42/43 (97,7%)**. ADM-030 continua dependente de uma fonte factual real de
  custo variável atribuível por negócio; não simular essa fonte nem declarar
  43/43.
