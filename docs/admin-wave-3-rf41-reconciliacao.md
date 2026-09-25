# Admin Wave 3 — Reconciliação de tentativas de auditoria RF41

## Objetivo

Fechar a lacuna operacional deixada pela Admin Wave 2: uma ação pode ter
`INICIADA` sem `RESULTADO` quando a conexão termina ou a gravação final falha.
Esse fato **não informa** se a ação de negócio aconteceu nem qual foi o status
HTTP. RF41 requer rastreabilidade; RN25 exige autorização proporcional.

## Contrato

A migration 105 adiciona `admin_auditoria_revisoes` como histórico append-only e
um UUID de alvo para auditar a própria revisão. O resultado HTTP original nunca
é fabricado, alterado ou apagado. Após **10 minutos**, uma tentativa sem
`RESULTADO` pode receber uma revisão humana única:

- superadmin autenticado e revalidado pelo `authAdmin` na requisição;
- avaliação controlada: `EFEITO_OBSERVADO`, `SEM_EFEITO_OBSERVADO` ou
  `INDETERMINADO` — descreve apenas o que foi observado na fonte consultada;
- tipo de evidência: log da aplicação, trilha do domínio ou provedor;
- identificador de referência de 8 a 100 caracteres, salvo somente como hash
  SHA-256; sem texto livre, URL, payload, contato, token ou código OAuth;
- ID da tentativa, ator da revisão e instante UTC persistidos separadamente.

`POST /admin/auditoria/:id/revisao` tem preflight na própria trilha
transversal (`auditoria_revisar`). A revisão é bloqueada se a tentativa for
recente, inexistente, já possuir `RESULTADO` ou já houver revisão. A transação
trava a tentativa para impedir duas revisões concorrentes; a constraint UNIQUE
é a segunda proteção. Falha ao registrar o início da própria ação responde 503
e não cria revisão.

Na consulta, `PENDENTE` significa ausência de resultado e revisão; `REVISADA`
significa revisão humana sem resultado HTTP. Tentativas recentes não oferecem
botão de revisão; tentativas vencidas oferecem. Se um `RESULTADO` chegar depois
de uma revisão, a consulta prioriza o resultado HTTP e preserva os dados da
revisão. Uma avaliação de efeito **não** prova resultado HTTP nem conclusão de
sincronização externa.

Revisar uma pendência exige inspecionar a fonte informada: relacionar o hash do
request ID aos logs, verificar o registro de domínio ou consultar o provedor.
O sistema armazena a classificação do revisor e a referência com hash, sem
afirmar que verificou automaticamente a evidência externa.

## Desempenho e cobertura

RNF02 exige p95 ≤ 2 s para APIs críticas sob carga operacional normal. A
medição operacional passou a utilizar requisições reais e volume da produção,
seguindo `admin-wave-6-rf41-qa-operacional.md`. O benchmark original de GET
com carga gerada em QA foi retirado: resultados desse ensaio não comprovam
o p95 em uso real. O Performance QA público mede outras rotas.

`ADM-043` continua **Não coberto**, com baseline **41/43**, até validação da
migration, autorização e concorrência em PostgreSQL/CI e medição operacional de
p95 com volume representativo. `ADM-030` continua separado: depende de uma
fonte factual real de custo variável atribuível ao negócio; esta Wave não
habilita adaptador, fonte ou cobertura econômica por estimativa.

## Aceitação suplementar proposta

- **CA-ADM-10:** tentativa recente, concluída ou já revisada não admite revisão;
  duas revisões concorrentes produzem no máximo um registro.
- **CA-ADM-11:** só superadmin registra revisão; tentativa e revisão mantêm
  ator, avaliação, tipo/hash de evidência e instante sem guardar referência em
  claro; a própria revisão gera evento transversal com UUID do alvo.
- **CA-ADM-12:** revisão não altera `RESULTADO` nem inventa HTTP; resultado
  tardio aparece como resultado e a revisão permanece consultável.
- **CA-ADM-13:** consulta e escritas críticas auditadas atendem RNF02 sob carga
  normal representativa, com evidência separada das métricas públicas.
