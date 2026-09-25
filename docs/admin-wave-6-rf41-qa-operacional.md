# Admin Wave 6 — Observação da auditoria em produção

## Estado em 25/09/2026, 19:28 UTC

A execução com registros sintéticos foi retirada. A produção no Railway estava
em deployment `7cab53ca-f4d5-4519-9cf7-facd0f564ae6`, status `SUCCESS`,
commit `f76bd407dabdcbd6c46e5d7aff71604e9e4513b0`. O histórico do proxy
HTTP de 24/09 00:00 até 25/09 19:28 UTC foi lido em janelas curtas para não
truncar períodos de maior tráfego (limite de 500 entradas por consulta). Nesse
recorte, **zero requisições a `/admin/auditoria`**: não existe amostra para
calcular o p95 dessa rota. Houve nove GETs reais bem-sucedidos em outras rotas
administrativas entre 00:32 e 00:34 UTC de 24/09, com durações do proxy entre
13 e 92 ms; ocorreram antes do deployment da Wave 6 e não são substitutos da
auditoria. As métricas reais de recurso nos 24 h finais
mostraram, na aplicação, CPU média de ~0,000127 e pico de ~0,0180 unidade
reportada, memória média de ~0,0820 GB e pico de ~0,1132 GB; no PostgreSQL,
CPU média de ~0,000284, memória média de ~0,0708 GB e disco ~0,2330 GB. Esses
indicadores não medem p95 nem garantem integridade da trilha.

Não houve acesso de leitura ao banco de produção por este ambiente: o conector
Railway oculta o valor de `DATABASE_URL`. Por isso, contagens reais de
`admin_auditoria_eventos`, resultados e revisões **não foram apuradas**.
O diagnóstico sintético anterior não constitui evidência de desempenho da
produção. **ADM-043 permanece Não coberto (41/43).**

## Como completar a análise sem alterar produção

1. Obter acesso autorizado às métricas e aos logs de produção. Fixar intervalo
   UTC, ambiente, IDs e SHAs dos deployments. Dividir consultas ao proxy em
   intervalos com menos de 500 entradas; subdividir qualquer intervalo que
   atinja o limite. Não salvar entradas brutas com IP ou query string.
2. Agregar por método, rota normalizada, build e status as durações de
   requisições **reais**; computar p95 nearest rank, `ceil(0,95 × n)`,
   registrando `n`, janela, intervalo entre chamadas e taxa de erro. Separar
   proxy (tempo externo) de logs da aplicação (`duracao_ms`). O proxy sem query
   string não separa `recentes`, `PENDENTE`, `REVISADA` e ator na mesma rota.
   Nos logs da aplicação após o deploy da classificação, o campo
   `auditoria_cenario` distingue `RECENTES`, `PENDENTE`, `REVISADA`, `ATOR`,
   `REVISAO` e `OUTRO`, sem gravar parâmetros de consulta ou o ID da revisão.
   Não atribuir esses grupos a logs gerados antes desse deploy.
3. Para comparar carga e volume, executar com credencial restrita de leitura,
   fornecida fora do shell/histórico e sem registrar URL, o perfil agregado:

   ```sh
   PERF_ADMIN_PROFILE_DATABASE_URL=... \
   PERF_ADMIN_PROFILE_CONFIRM_DATABASE=... \
   PERF_ADMIN_PROFILE_READ_ONLY=auditoria \
   node scripts/profile-admin-audit-volume.js
   ```

   O script usa `BEGIN READ ONLY`, timeout de 10 s e retorna somente contagens
   de tentativas, resultados, revisões, pendências, atores e ações. Se a
   consulta for custosa ou expirar, interromper e planejar alternativa de
   leitura sem aumentar o limite no banco principal.
4. Verificar integridade do ledger por consulta autorizada e minimizada,
   sem exportar IDs pessoais; confirmar `INICIADA`, `RESULTADO` quando há
   resposta HTTP, e revisão sem resultado fabricado. Correlacionar latências
   com CPU, memória e configuração do banco no intervalo observado.
5. Só aceitar p95 ≤ 2 s com amostras de uso normal, carga representativa,
   build confirmado e integridade da trilha. Se o uso de determinada operação
   for inexistente ou insuficiente, manter a evidência como inconclusiva.

O LCP das páginas públicas é uma avaliação separada. ADM-030 depende de uma
fonte factual de custo variável atribuível ao negócio e não é fechado por
esta análise.
