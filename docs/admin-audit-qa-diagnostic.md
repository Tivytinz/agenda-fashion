# Diagnóstico isolado da auditoria administrativa

O workflow `Admin audit QA diagnostic` roda em pull requests que alteram os
medidores e também pode ser iniciado manualmente. Executa a aplicação e o PostgreSQL
18 dentro do mesmo runner temporário do GitHub Actions. Aplica as migrations,
cria somente registros sintéticos, mede as quatro leituras e as duas escritas,
confere build e pares do ledger, publica JSON e descarta o runner.

O perfil de referência do workflow é gerado **a partir do próprio banco QA**.
Ele permite detectar regressões na instrumentação e no caminho HTTP, mas não
representa o volume, a idade, a distribuição nem os recursos de produção.
`NODE_ENV=test`, workers desativados e o runner compartilhado também diferem
da operação normal. Portanto o resultado é **diagnóstico** e não promove
ADM-043: a matriz continua em **41/43**.

Para encerrar ADM-043, usar a medição operacional de
`admin-wave-6-rf41-qa-operacional.md` com perfil agregado independente,
banco e aplicação QA isolados e recursos/carga comparáveis à operação normal.
Só depois de verificar seis p95 ≤ 2 s e integridade do ledger no mesmo build
revisar a cobertura para 42/43. Não reutilizar o banco persistente do ambiente
Railway `test` nem dados pessoais de produção no runner.
