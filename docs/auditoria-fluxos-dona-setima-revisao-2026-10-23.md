# Sétima auditoria dos fluxos da dona — 23 de outubro de 2026

**Código auditado:** `0231f98`, branch local `fix/owner-agenda-recovery`.
**Escopo:** revalidação das correções QS-01 a QS-04, novas sequências de
cancelamento/reativação com pagamentos e eventos de assinatura, estorno durante
criação externa e tentativa pendente com período vencido. Também foram executadas
regressões selecionadas de agenda, equipe, permissões, sessão e encerramento.

As correções anteriores passaram nos cenários previstos. Foram reproduzidos
**quatro problemas adicionais: três P1 e um P2**, com seis ensaios SQL locais e
Asaas simulado. O relatório registra comportamento executado, sem afirmar que
todos os problemas foram introduzidos pelo último commit. Não altera o produto.

## Resultado priorizado

| ID | Prioridade | Problema | Consequência observada |
| --- | --- | --- | --- |
| ST-01 | P1 | Finalização preserva o acesso ampliado, mas não reconcilia a data da recorrência externa | Conta retorna renovação ativa com `2100-01-01`, enquanto o provedor simulado mantém `2099-12-01`. |
| ST-02 | P1 | Webhook de assinatura sobrescreve o fim pago com `nextDueDate` anterior | Pagamento continua recebido, mas o acesso encolhe; uma variante retornou ao grátis antes do fim quitado. |
| ST-03 | P1 | Estorno durante criação destrói o estado recuperável da tentativa | Nova recorrência fica ativa no provedor simulado, sem vínculo local, sem remoção e sem consulta pela recuperação normal. |
| ST-04 | P2 | Reativação incerta mantém benefícios após o período pago vencer | GET mantém plano pago; worker não seleciona a tentativa vencida, e nova reativação retorna 409. |

P1 indica divergência financeira ou corte indevido de acesso. P2 indica falha de
expiração e recuperação condicionada à indisponibilidade externa. Os exemplos
com 2099/2100 usam fixtures; não representam contas ou cobranças reais.

## ST-01 — Data local e recorrência externa divergem após pagamento intercalado

A tentativa congela `reativacao_inicio_cobranca` para manter sua referência
idempotente. Se um recebimento ampliar o período durante a criação externa,
`registrarReativacao` mantém o maior fim local com `GREATEST`. A agenda externa
continua usando a data congelada, sem uma etapa de reconciliação antes do sucesso.

**Sequência reproduzida:**

1. Cancelar a renovação de `sub_original`, com acesso até `2099-12-01`.
2. Reativar; o provedor simulado registra `sub_reactivated`, com
   `nextDueDate = 2099-12-01`, e segura a resposta.
3. Confirmar um pagamento da recorrência anterior. O acesso local cresce para
   `2100-01-01`; a tentativa e sua referência ficam preservadas.
4. Liberar a resposta externa. O serviço conclui com sucesso e a leitura retorna
   `ATIVA`, com `data_proxima_cobranca = 2100-01-01`.
5. O estado do provedor simulado continua em `2099-12-01`. Nenhuma chamada
   posterior altera ou remove essa recorrência.

| Informação | Valor observado |
| --- | --- |
| ID local e externo | `sub_reactivated` |
| Data retornada pela conta | `2100-01-01` |
| Data mantida no provedor simulado | `2099-12-01` |
| Mensagem de sucesso | Renovação reativada; nenhuma nova cobrança feita agora. |

A tela usa o campo local como **Próxima cobrança** para uma assinatura ativa.
Logo, a proteção do período pago não garante uma data de cobrança coerente.
O ensaio comprova divergência de programação, sem executar nem afirmar cobrança
duplicada real.

**Código:** `assinaturaReativacaoService.finalizarReativacaoLocal` e
`reativarMinhaAssinatura`; `assinaturaRepository.registrarReativacao`;
`asaasService.criarAssinaturaAsaas`; `SubscriptionPage`, apresentação de
`data_proxima_cobranca`.

**Correção recomendada:** representar separadamente fim do período quitado e
próxima cobrança externa. Se o período crescer durante a tentativa, reconciliar
a recorrência e suas cobranças antes de declarar sucesso; preservar a referência
original até resolver o resultado. Uma alteração apenas no banco ou no texto da
tela não resolve a divergência externa. O tratamento de faturas já emitidas deve
ser validado no contrato atual do provedor ao implementar a integração.

**Aceitação:** pagamento antes/durante/depois da criação e recuperação após
timeout mantêm acesso e agenda externa coerentes. A asserção deve conferir o
estado do provedor simulado, além da linha local. Sem conciliação confirmada,
exibir pendência com recuperação disponível.

Rastreabilidade: RF36, RN21, RN32, RNF05; `docs/planos.md`.

## ST-02 — Eventos de assinatura ainda podem apagar período recebido

O caminho de confirmação financeira e o cancelamento protegem o maior período
pago, mas `assinaturaWebhookRepository.atualizarPorWebhook` usa
`COALESCE($7, data_proxima_cobranca)`. Um `nextDueDate` presente substitui a
data local mesmo em uma assinatura `CANCELED` com recebimento mais recente.

Foram reproduzidas separadamente as duas sequências:

1. Cancelar `sub_original` e confirmar pagamento que amplia o acesso de
   `2099-12-01` para `2100-01-01`, mantendo a renovação cancelada.
2. Receber `SUBSCRIPTION_UPDATED` **ou** `SUBSCRIPTION_DELETED` para o mesmo ID,
   com `nextDueDate = 2099-12-01`.
3. A assinatura volta a `2099-12-01`, ainda `CANCELED/ativo = true`, enquanto
   o pagamento permanece `RECEIVED`. Repetir o cancelamento retorna esse fim
   reduzido, pois o caminho idempotente não recalcula a evidência.

Uma terceira variante exercitou a consequência até a leitura do plano, com
datas relativas ao `CURRENT_DATE` do banco:

| Etapa | Resultado em 23/10/2026 |
| --- | --- |
| Recebimento válido e cancelamento | Acesso até `2026-11-23`. |
| DELETE reconhecido com `nextDueDate = 2026-10-23` | Fim local substituído por `2026-10-23`. |
| GET da assinatura | Expiração executada; plano efetivo `inicial`; assinatura inativa. |
| Pagamento após a expiração indevida | Continua `RECEIVED`. |

O reconhecimento é avaliado como preservação de período pago antes do UPDATE,
mas a data usada pela expiração é a sobrescrita depois dele. A ordenação temporal
dos webhooks não resolve essa diferença entre vencimento externo e direito pago.

**Código:** `assinaturaWebhookService.sincronizarAssinaturaPorWebhook`;
`assinaturaWebhookRepository.atualizarPorWebhook`;
`assinaturaRepository.expirarCancelamentoSeNecessario`;
`assinaturaContaService.cancelarMinhaAssinatura`.

**Correção recomendada:** registrar a programação do provedor sem reduzir o
período comprovadamente quitado. Todas as escritas que alteram acesso precisam
usar o mesmo contrato e fronteira transacional. Uma redução legítima por estorno
ou disputa deve ser explícita e não derivada de `nextDueDate`. Proteger somente
`REACTIVATING` deixa os estados `ACTIVE` e `CANCELED` expostos.

**Aceitação:** webhooks com data anterior, igual e posterior, nas duas ordens em
relação ao recebimento/cancelamento, preservam o acesso legítimo e a identidade
do cancelamento. Incluir o GET/worker posterior, verificando que não ocorre
downgrade antecipado nem inativação indevida da equipe.

Rastreabilidade: RF36/RF37, RN21/RN32; preservação do período em `docs/planos.md`.

## ST-03 — Estorno durante criação deixa recorrência sem tratamento

A preservação de `REACTIVATING` implementada para pagamentos confirmados não
abrange suspensões financeiras. O estorno muda a assinatura para
`REFUNDED/ativo = false`. Essa suspensão pode ser legítima; o defeito é perder a
capacidade de resolver a criação externa que já estava em andamento.

**Sequência reproduzida:**

1. Cancelar e iniciar reativação; segurar a resposta de criação externa.
2. Processar `suspenderAssinaturaPorPagamento` com `REFUNDED` para um pagamento
   vinculado à mesma assinatura.
3. Liberar a criação, que retorna `sub_after_refund/ACTIVE` no provedor simulado.
4. A finalização local falha com 409 porque exige `REACTIVATING` e `ativo = true`.
5. Não há compensação removendo `sub_after_refund` nem registro local desse ID.
6. Seu `SUBSCRIPTION_CREATED`, com a referência gerada pela própria tentativa,
   retorna `null`. A busca por ID não encontra vínculo e o parser não reconhece
   o prefixo `assinatura-reativada` como referência inicial de assinatura.
7. Após envelhecer a tentativa por mais de dois minutos, GET mostra falha por
   reversão e plano gratuito, mas não consulta a referência externa: a busca de
   recuperação aceita somente `REACTIVATING/ativo = true`.

Resultado externo simulado: `sub_after_refund` permanece ativo. A única remoção
solicitada foi de `sub_original`, no cancelamento anterior. Não houve cobrança
posterior no ensaio; o risco decorre da recorrência criada sem tratamento local.

**Código:** `assinaturaPagamentoService.suspenderAssinaturaPorPagamento`;
`assinaturaWebhookRepository.suspenderAssinatura`;
`assinaturaReativacaoService`, finalização e reconciliação;
`assinaturaRepository.buscarReativacaoAbandonada`;
`assinaturaCalculos.extrairReferenciaAssinatura`.

**Correção recomendada:** persistir a operação externa e sua geração de forma
independente da elegibilidade de acesso. Uma suspensão precisa continuar
permitindo localizar a recorrência criada e decidir sua remoção ou adoção segundo
o fato financeiro atual. Falha de vínculo exige recuperação ou compensação
durável; retornar 409 sem guardar essa obrigação não basta. Preservar a suspensão
legítima e manter HTTP externo fora das transações.

**Aceitação:** estorno, atraso e chargeback antes/durante/depois da criação,
resposta incerta e webhook antes/depois da resposta. Todo ID externo criado deve
ter vínculo válido ou obrigação persistida de tratamento, recuperável por retry.

Rastreabilidade: RF36, RN32, RNF05/RNF19; `docs/planos.md`.

## ST-04 — Tentativa incerta vencida mantém plano pago

Foi preparada uma fixture coerente de tentativa `REACTIVATING`, geração 1, com
fim pago e início reservado no dia anterior ao `CURRENT_DATE`; o recebimento
anterior também foi ajustado ao ciclo vencido. Não foi simulado pagamento novo.
A consulta externa foi configurada para falhar.

O GET tentou reconciliar, preservou a incerteza e retornou plano efetivo
`autonoma`, `ativo = true` e estado agregado `ATIVA`, com status bruto
`REACTIVATING`. Outra reativação retornou 409. O worker real de reconciliação foi
executado e retornou zero candidatos e zero reconciliados.

Manter a intenção pendente durante erro ambíguo está correto. O problema é esse
estado também impedir a expiração do acesso: tanto a expiração quanto a seleção
do worker consideram somente `CANCELED/CANCELLED`, enquanto o plano efetivo aceita
qualquer assinatura `ativo = true`, independentemente da validade do período.

O ensaio prova manutenção do benefício no estado vencido, sem medir quantos dias
uma indisponibilidade real duraria. A UI reconhece o status bruto como
**Reativando renovação**; o problema principal está no acesso efetivo e na
recuperação, e não na ausência desse aviso na tela.

**Código:** `assinaturaReativacaoService.reconciliarReativacaoAbandonada`;
`assinaturaRepository.expirarCancelamentoSeNecessario` e
`listarNegociosComCancelamentoExpirado`; `planoRepository.buscarUsoPlano`;
`billingReconciliationWorker.executarReconciliacao`.

**Correção recomendada:** separar validade do acesso e estado da tentativa,
mantendo a operação incerta recuperável mesmo após vencer. Aplicar a política de
expiração do período, ou uma carência explícita e limitada caso seja adotada,
sem inferir inexistência da recorrência externa. O worker precisa cobrir operações
pendentes sem depender de nova navegação da dona. Apenas marcar `ativo = false`
sem mudar a busca de recuperação tornaria a operação invisível, como em ST-03.

**Aceitação:** tentativa pendente antes/no/depois do vencimento, consulta que
falha repetidamente e posterior recuperação encontrada/ausente. Benefícios,
capacidade da equipe e possibilidade de resolver a operação devem permanecer
coerentes com a política de acesso documentada.

Rastreabilidade: RF36/RF37, RN21/RN32; expiração do período em `docs/planos.md`.

## Direção conjunta para a correção

Os quatro achados mostram a necessidade de distinguir os conceitos abaixo.
Corrigir uma única atribuição deixa outro escritor capaz de recriar a divergência.

| Conceito | Autoridade necessária | Regra a proteger |
| --- | --- | --- |
| Período quitado | Evidência financeira válida e fim pago persistido | Evento de programação não encurta o acesso. Reversão tem tratamento financeiro explícito. |
| Próxima cobrança | Estado confirmado do provedor e cobranças emitidas | A conta não anuncia uma data diferente da programação reconciliada. |
| Operação de renovação | Tentativa/geração e referência externa duráveis | Pagamento, suspensão ou expiração não apagam uma criação em resolução. |
| Acesso e capacidade | Validade financeira e política de expiração | Operação incerta não concede acesso sem prazo nem impede sua própria recuperação. |

A prioridade é resolver ST-01, ST-02 e ST-03 antes do merge. A implementação deve
exercitar cada evento financeiro e de assinatura em cada fase da operação,
verificando banco, conta, plano efetivo e estado do provedor simulado.

## Cobertura e limites

Validação repetida sobre `0231f98`:

- **295 testes backend em 35 suítes passaram.**
- **121 testes de integração em 19 suítes passaram.** Três testes de concorrência
  com conexões PostgreSQL nativas foram ignorados pelo harness: dois da equipe
  e um de confirmação/cancelamento. Não contam como aprovados.
- **85 testes frontend em oito arquivos passaram.**
- **Seis ensaios SQL observacionais** reproduziram os quatro achados: ST-01,
  duas variantes de ST-02, expiração de ST-02, ST-03 e ST-04. Essas asserções
  registram defeitos; não fazem parte dos 501 testes regulares aprovados.
- Os **115 arquivos de migrations**, incluindo 117, foram aplicados em bancos
  PGlite isolados. O harness emula o parser instalado de `DATE` do `pg`.

As regressões selecionadas cobrem agenda, conflito, disponibilidade, cancelamento,
reagendamento, equipe, convites, contexto restrito RN50, sessão, privacidade e os
cenários anteriores de assinatura. Nenhum novo acesso indevido foi reproduzido
nessa seleção; ela não certifica todo o RBAC nem todos os percursos visuais.

As transações SQL dos ensaios foram sequenciais, com intercalação nas esperas do
provedor. Isso não comprova locks entre conexões nativas. Runtime local
Node 24.19.0; CI declarado Node 22/PostgreSQL 18. Não houve CI remoto, Asaas real,
Safari/Playwright, carga, leitura de produção, push, merge ou deploy. Lint, build,
suíte frontend completa e matriz de fusos da preparação anterior não foram
repetidos nesta auditoria documental.

## Evidências e reprodução

Diretório intermediário, ao lado do repo:
`audit-harness/owner-flow-seventh-20261023/`.

- `owner-seventh-audit.repro.test.js`: seis casos observacionais;
- `repro.log`: resultados locais e snapshots do banco/provedor simulado;
- `backend.log`, `integration.log` e `frontend.log`: regressões selecionadas.

Para repetir os ensaios, copiar temporariamente o arquivo para
`tests/owner-seventh-audit.repro.test.js`, usar a configuração
`audit-harness/owner-fourth-fixes-20261022/pglite-jest.config.cjs`, com
`--runInBand --runTestsByPath tests/owner-seventh-audit.repro.test.js`, `TZ=UTC`
e as variáveis locais de teste exigidas pelo projeto. Retirar o arquivo da suíte
regular depois da reprodução; ao corrigir, converter seus casos em invariantes
de comportamento desejado.

Referências: *Agenda Fashion Requisitos v1.17* e *Critérios de Aceitação v1.2*,
anexados à conversa; `AGENTS.md`, `docs/planos.md`, relatório anterior, código,
testes e migrations locais. Os comportamentos externos deste relatório são
simulados; a correção de integração exigirá validação do contrato do provedor.

## Correções preparadas — 23 de outubro de 2026

Implementação local posterior à auditoria de `0231f98`, com a migration **118**.

| Achado | Correção preparada | Verificação |
| --- | --- | --- |
| ST-01 | Fim pago separado da programação externa. Adoção exige data compatível com o acesso vigente. Recorrência incompatível é removida antes de uma substituição com nova geração; o pedido faz no máximo uma substituição automática. | Provedor simulado mantém estado por ID; só a recorrência com a data correta permanece ativa. Remoção incerta continua recuperável, sem criação às cegas. |
| ST-02 | `acesso_pago_ate` não é sobrescrito por `nextDueDate`. Conta, expiração, capacidade, ledger e projeções financeiras usam o fim quitado. | UPDATED e DELETED com data antiga, repetição do cancelamento, GET/worker posterior e variante com vencimento no dia atual preservam o acesso. |
| ST-03 | `assinatura_renovacao_operacoes` conserva referência, geração, ID conhecido e obrigação de resolução, independentemente de status/ativo. Suspensão legítima permanece, e a preparação externa é removida ou fica pendente para retry. | Estorno, atraso e chargeback durante criação; resposta perdida antes de estorno; DELETE falho antes/depois do efeito externo; resposta antiga durante consulta de ausência e após outra geração. |
| ST-04 | REACTIVATING vencida entra na expiração do acesso. O worker também seleciona operações pendentes de assinaturas inativas; a conta continua oferecendo atualização. | Provedor indisponível mantém obrigação, com benefícios expirados. Recuperação posterior encontrada/ausente não reabre acesso sem período pago. |

A migration preserva períodos conhecidos, sem transformar checkout pendente não
recebido em evidência de acesso. Também cria operações para tentativas legadas
identificáveis por `REACTIVATING`, geração e data válida, inclusive inativas.
Um teste aplica o SQL da migration sobre fixtures anteriores ao novo schema,
além da aplicação de todos os arquivos no harness de integração.

Recebimento da nova recorrência antes da resposta de criação é reconhecido pelo
ID registrado a partir de webhook com referência e cliente corretos, sem
antecipar adoção. A recorrência anterior fica identificada na operação para
recebimentos atrasados após a finalização. Se um deles ampliar o acesso além da
programação já confirmada, a conferência é reaberta e a remoção fica durável;
depois da resolução, a dona pode reativar na nova data. Eventos antigos de
assinatura não são tratados como alterações da recorrência atual.

Uma concessão de execução de dois minutos e versão por execução impedem
conclusões obsoletas. As transações bloqueiam negócio antes de assinatura e
operação; chamadas externas ocorrem após o commit local. A expiração é
compartilhada entre leitura e worker. Checkout e arquivamento aguardam operações
`PENDING`/`REMOVING`, mesmo quando o acesso já foi suspenso ou expirou.

No DTO, `acesso_pago_ate` é um dia civil explícito. O alias legado
`data_proxima_cobranca` continua apresentando fim pago para cancelado/reativando,
sem alterar a programação armazenada. A tela usa o fim pago como **Acesso até** e
mantém a consulta disponível quando `renovacao_pendente` persiste após retorno ao
grátis. UTC, São Paulo, Los Angeles e Kiritimati foram exercitados.

A escolha de remover a preparação segue o contrato oficial consultado do Asaas:
[alterar `nextDueDate`](https://docs.asaas.com/reference/atualizar-assinatura-existente)
não corrige vencimentos de faturas já geradas;
[remover a assinatura](https://docs.asaas.com/reference/remover-assinatura)
remove cobranças pendentes/vencidas e preserva as pagas. Os testes locais simulam
esse limite; não houve criação, remoção ou cobrança real no provedor.

Validação local final:

- **298 testes backend em 35 suítes passaram.**
- **149 testes de integração em 25 suítes passaram**, incluindo 18 cenários
  novos de fluxo, um teste de dados da migration e regressões de receita/churn.
- **Quatro testes nativos foram ignorados pelo harness**: os três anteriores
  de equipe e confirmação/cancelamento, mais a disputa entre duas conexões pela
  mesma execução de renovação. Precisam de PostgreSQL nativo e não contam como
  aprovados localmente.
- **800 testes frontend em 118 arquivos passaram**, além de lint, build e
  verificação de arquivos sem uso.
- Os **116 arquivos de migrations**, incluindo 118, foram aplicados no harness.
  As repetições por fuso não aumentam a contagem de casos distintos.

As evidências desta preparação ficam em
`audit-harness/owner-seventh-fixes-20261023/`, ao lado do repo. Suítes persistentes:
`tests/owner-seventh-fixes.integration.test.js`,
`tests/assinatura-renovacao-migration.integration.test.js` e testes existentes de
reativação, período pago, DTO, worker, contrato de datas e recuperação da tela.

Runtime local Node 24.19.0, SQL PGlite e Asaas simulado. CI declarado usa
Node 22/PostgreSQL 18. Sem CI remoto, validação de faturas reais, navegador,
carga, push, merge ou deploy. A aplicação nova exige a migration 118 antes de
iniciar; não há alteração de dependências. A operação legada cuja identidade já
tenha sido perdida antes da migration não pode ser reconstruída por suposição.
