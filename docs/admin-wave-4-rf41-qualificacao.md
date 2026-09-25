# Admin Wave 4 — Qualificação operacional de RF41 e RNF02

## Critério

RNF02 exige p95 ≤ 2 s para APIs críticas sob carga operacional normal. A trilha
RF41 e a revisão de pendências já possuem testes de código e PostgreSQL; isso
não mede a latência vivida em produção. ADM-043 permanece **Não coberto
(41/43)** até haver evidência operacional representativa.

## Fonte de evidência

Usar requisições reais do ambiente de produção, identificando o deployment e o
intervalo UTC. O proxy HTTP do Railway fornece método, caminho, status e duração
por requisição; o `requestLogger` da aplicação registra `tipo=requisicao_http`,
`metodo`, `rota`, `status` e `duracao_ms` após a resposta. O p95 do proxy e o
da aplicação são medidas distintas; não misturá-los na mesma série. Agregar
por operação e por sucesso/erro, sem guardar token, IP, query string, ID de
usuário, payload ou caminhos que identifiquem uma pessoa.

Operações de interesse: `GET /admin/auditoria` (recente, pendente, revisada e
filtro por ator, quando for possível classificar o filtro com segurança),
`POST /admin/auditoria/:id/revisao` e as escritas administrativas auditadas
realmente utilizadas. Com apenas o caminho do proxy sem query string,
`GET /admin/auditoria` é um grupo único: não atribuir tempos aos quatro
filtros sem outro sinal confiável. Para cada grupo, registrar número de
requisições, janela, distribuição temporal, status e p95 pelo método nearest
rank (`ceil(0,95 × n)` sobre durações em ordem crescente). Uma amostra ausente
ou escassa não comprova carga normal.

Conferir o SHA no histórico do deployment Railway, não em variável atribuída
manualmente ao aplicativo. Comparar o volume da trilha real por meio de
`scripts/profile-admin-audit-volume.js` com conexão de leitura autorizada e
transação `READ ONLY`. Identificar volume, concorrência e recursos normais da
aplicação e do PostgreSQL no mesmo recorte. Se necessário investigar consultas,
obter plano em ambiente apropriado antes de alterar índices ou queries.

A integridade RF41 deve ser verificada separadamente na trilha real: tentativas
`INICIADA`, resultados HTTP `RESULTADO` quando existentes, e revisões
referenciando tentativa sem fabricar resultado. Nenhuma carga, campanha,
revisão ou ator será criado para produzir a medição.

Apenas após p95 ≤ 2.000 ms com amostras e volume representativos, build
identificado e integridade verificada, atualizar ADM-043 para **42/43**.
ADM-030 continua dependente de custos variáveis reais atribuídos ao negócio.
