# Nona auditoria dos fluxos da dona — 24 de outubro de 2026

**Código auditado:** `5375d78960ff4546035a4cd728dabffca63da57f`, branch local
`fix/owner-agenda-recovery`.
**Escopo:** revalidação de OT-01 a OT-04, recuperação da criação inicial e da
substituição de recorrências, atualização de pagamentos recebidos e seleção do
lote de recuperação. Também foram executadas regressões de agenda, equipe,
RN50, contexto, permissões, sessão, assinatura, encerramento e frontend.

As quatro correções anteriores passaram nos cenários cobertos. A revisão
reproduziu **três pendências adicionais: uma P1 e duas P2**, com seis ensaios
observacionais, incluindo dois controles. Os novos casos ampliam a cobertura;
não há afirmação de que todos foram introduzidos no último commit. Esta
auditoria não modifica a implementação.

## Resultado priorizado

| ID | Prioridade | Problema | Efeito reproduzido |
| --- | --- | --- | --- |
| NV-01 | P1 | Recuperação do checkout perde obrigações externas após estorno | Criação inicial incerta deixa recorrência ativa sem vínculo; na troca de plano, remoção falha e o retry deixa duas recorrências ativas. Ambos os caminhos terminam sem pendência visível na conta. |
| NV-02 | P2 | Atualização sem datas troca a data financeira por hoje | Um pagamento de 27/09 passa a constar como pago em 24/10; seu acesso cresce de 27/10 para 24/11 sem outro pagamento. Condicionado à ausência de `paymentDate` e `confirmedDate`. |
| NV-03 | P2 | Lote ordenado por ID pode adiar continuamente outros negócios | Casos com falha que ocupam o lote voltam a ser selecionados antes de um negócio recuperável. O ensaio reduzido repetiu três ciclos sem consultá-lo. |

P1 indica divergência relevante entre assinatura local e obrigação de cobrança
externa. P2 indica falha condicionada a dados incompletos admitidos pela aplicação
ou à ocupação do lote. Não houve cobrança real nem inspeção de produção.

## NV-01 — Limpeza do checkout não sobrevive a transições financeiras

O registro durável de operações protege a reativação explícita. A ativação
inicial e a limpeza de recorrências substituídas ainda dependem de outros
caminhos: retorno da preparação, replay da confirmação e status da assinatura
anterior. Um estorno pode retirar a operação desses caminhos sem resolver o
estado externo.

Os dois ensaios abaixo usaram `webhookService.processarWebhookAsaas` e
`processarEventoWebhook`, com fila, ordenação por pagamento e transações reais
no harness. As etapas foram **sequenciais**; não foi necessário processar
simultaneamente dois eventos da mesma cobrança. A conversão de marketing foi
neutralizada para isolar billing.

### NV-01a — Criação inicial incerta seguida de estorno

1. Checkout pendente recebe confirmação válida de pagamento.
2. O provedor simulado cria `sub_new_1`, mas a resposta do POST se perde.
   A confirmação fica `FAILED`; a assinatura local permanece sem ID externo.
3. O próximo webhook estorna o mesmo pagamento. A assinatura fica
   `REFUNDED/ativo = false` e o plano efetivo volta ao Grátis.
4. Vencido o backoff do webhook, executar novamente a confirmação original.
   A ordenação rejeita corretamente a escrita financeira anterior ao estorno.
5. `prepararAtivacao` retorna `null`; a fachada retorna antes de executar
   `reconciliarRecorrenciaOrfaIgnorada`. O webhook termina `IGNORED`, com seu
   erro limpo.
6. GET e worker não encontram operação de renovação pendente. A recorrência
   criada no passo 2 continua ativa no provedor simulado.

| Informação final | Resultado |
| --- | --- |
| Assinatura local | `REFUNDED`, inativa, `asaas_subscription_id = null`. |
| Confirmação original | `IGNORED`. |
| Operações de renovação da assinatura | Nenhuma. |
| `renovacao_pendente` da conta | `false`. |
| Worker temporal | Zero candidatos. |
| Consulta de recuperação/DELETE após o estorno | Nenhum. |
| Provedor simulado | `sub_new_1/ACTIVE`, início em `2026-11-24`. |

O controle sem estorno reutilizou e vinculou a mesma recorrência no retry.
A falha está na perda do caminho de limpeza quando a confirmação financeira
passa a ser obsoleta, não em todo timeout de criação.

**Código:** `assinaturaAtivacaoAsaasService.prepararAtivacao`, linhas 104–115;
`ativarAssinaturaPorPagamento`, linhas 503–519;
`reconciliarRecorrenciaOrfaIgnorada`.

### NV-01b — Limpeza da recorrência substituída perde o status usado no retry

1. Negócio usa Autônoma com recebimento vigente. Confirmar o checkout de Studio.
2. A finalização local ativa Studio e marca a assinatura anterior como
   `CANCELED/ativo = false`, com observação de substituição.
3. O DELETE da recorrência anterior falha. O webhook da nova assinatura fica
   `FAILED`; o provedor simulado mantém a recorrência anterior e a nova ativas.
4. Processar estorno do pagamento da assinatura anterior. Seu status muda para
   `REFUNDED`; a assinatura Studio e seu recebimento permanecem válidos.
5. Reexecutar o webhook de Studio. `listarRecorrenciasSubstituidas` exige
   `status = 'CANCELED'`, portanto já não seleciona o ID anterior.
6. O retry termina `PROCESSED`. A conta mostra Studio ativo, sem pendência, e
   o worker não seleciona limpeza. As duas recorrências continuam ativas no
   provedor simulado, ambas com programação em `2026-11-24`.

Houve somente uma tentativa de DELETE do ID antigo, a que falhou. Não houve
nova tentativa no replay depois do estorno. A perda de acesso do plano atual
não foi reproduzida: o defeito confirmado é manter a recorrência anterior sem
resolução enquanto a nova já está vinculada e ativa.

**Código:** `assinaturaAtivacaoRepository.listarRecorrenciasSubstituidas`, linhas
253–271; `assinaturaAtivacaoAsaasService.cancelarRecorrenciasSubstituidas` e
finalização; `assinaturaPagamentoService.suspenderAssinaturaPorPagamento`.

O contrato do provedor separa geração de cobranças da recorrência e liquidação
de cada pagamento. Remover a assinatura encerra novas emissões. Isso sustenta
a relevância de conferir a limpeza externa; os ensaios comprovam o estado do
simulador, sem afirmar emissão ou pagamento duplicado real. Referências oficiais
consultadas em 24/10/2026:
[criar assinatura](https://docs.asaas.com/reference/create-new-subscription) e
[remover assinatura](https://docs.asaas.com/reference/remover-assinatura).

**Correção recomendada:** tornar a obrigação de conciliar/remover durável também
na criação inicial e na substituição de plano, independente do status financeiro
e do resultado do webhook positivo. Retornar `IGNORED` para efeito de ativação
não deve apagar a necessidade de localizar e remover uma criação incerta.
Status `REFUNDED` não pode retirar um ID conhecido da fila de remoção. Manter
identidade, versão e referência estáveis, com HTTP fora da transação e retry
até confirmação de ausência ou remoção.

**Aceitação:** resposta perdida e DELETE com resultado aplicado/não aplicado,
seguidos de estorno, atraso, evento obsoleto ou outra assinatura vigente,
preservam o fato financeiro e a obrigação externa. Verificar banco, fila,
conta, worker e estado do provedor, além da resposta HTTP. A reativação explícita
já protegida deve continuar funcionando.

Rastreabilidade: RF35/RF36, RN21/RN32/RN36 e RNF05; contratos em
`docs/asaas-ativacao-recorrencia.md` e `docs/planos.md`.

## NV-02 — Data de processamento substitui uma data financeira conhecida

Na sincronização inicial do evento, a ausência de datas preserva o valor de
`pagamentos.data_pagamento`. Na finalização, `dadosEvento` usa `new Date()`
quando faltam `paymentDate` e `confirmedDate`. O repository recebe esse valor
presente e o grava por cima do dado financeiro anterior. O recálculo do período
pago usa a data recém-inventada.

**Ensaio com `PAYMENT_UPDATED` e status `RECEIVED`:**

| Informação | Antes | Depois, com ambas as datas omitidas |
| --- | --- | --- |
| ID do pagamento | O mesmo. | O mesmo. |
| Data de pagamento | `2026-09-27` | `2026-10-24` |
| Fim pago | `2026-10-27` | `2026-11-24` |
| Próxima cobrança local/externa conhecida | `2026-10-27` | `2026-10-27` |
| Resultado do webhook | — | `PROCESSED` |

O payload mantinha `dueDate = 2026-09-27`, e a data financeira válida já estava
persistida. Não foi criado outro pagamento. No controle com as duas datas
explícitas, data financeira e fim pago foram preservados.

**Condição da evidência:** a falha foi reproduzida com um payload aceito pelo AF
sem `paymentDate` e `confirmedDate`. Não foi observado um webhook real do Asaas
com essa omissão, nem se afirma que todos os eventos normais omitam esses
campos. A prioridade P2 reflete essa condição. O contrato local admite fallback
temporal válido e já separa data financeira de `confirmacao_observada_em`.

**Código:** `assinaturaAtivacaoAsaasService.dadosEvento`, linhas 35–41, e
`finalizarAtivacao`; `pagamentoRepository.atualizarStatusPagamento`, linha 83;
`assinaturaPeriodoPagoService.calcularFimDoPeriodoPago`.

**Correção recomendada:** preservar a data financeira já conhecida quando não
houver outra data factual validada. Tempo de observação/processamento pertence
ao campo próprio e não deve substituir silenciosamente a data do pagamento.
Sem evidência temporal suficiente, reconciliar o dado ou manter um estado
recuperável antes de ampliar benefícios.

**Aceitação:** atualizações e retries com datas presentes, ausentes e nulas
conservam o pagamento conhecido, seu período e sua atribuição financeira; dado
incompleto não concede outro mês nem impede recuperação legítima.

Rastreabilidade: RN21/RNF05, RF36; contrato de datas em `AGENTS.md` e
`docs/planos.md`.

## NV-03 — Casos com falha podem ocupar todos os ciclos do lote

`listarNegociosPendentes` limita a seleção com `ORDER BY a.negocio_id`.
Registrar falha muda `atualizado_em`, mas não muda essa prioridade. A concessão
dura dois minutos e o intervalo padrão do worker é de cinco minutos; assim, o
mesmo caso defeituoso já pode voltar a ser elegível na execução seguinte.

**Reprodução reduzida, com tamanho de lote 1 aceito pela configuração:**

1. Negócio com menor ID tem uma tentativa sem cliente Asaas, impossível de
   consultar. Outro negócio com ID maior possui uma recorrência recuperável.
2. Executar três ciclos, vencendo a concessão entre eles para simular o intervalo
   padrão. Ambos aparecem como elegíveis antes de cada seleção.
3. Em todos os ciclos, somente o primeiro é selecionado: um candidato, uma falha
   de contexto e zero renovações reconciliadas. Nenhum lookup do segundo ocorre.
4. O segundo permanece `REACTIVATING`. Um GET da própria dona, que não depende
   da seleção do lote, encontra e adota sua recorrência na primeira tentativa.

O ensaio comprova a prioridade repetida sob essas condições. Na configuração
padrão de lote 100, a condição equivalente exige que casos anteriores com falha
ocupem as vagas do lote. Não foi medido o volume de produção, nem demonstrado
que exista atualmente essa quantidade de casos. Com vagas disponíveis, os
negócios posteriores também podem ser selecionados.

**Código:** `assinaturaRenovacaoRepository.listarNegociosPendentes`, linhas
169–178; `reconciliarReativacaoAbandonada`; configuração
`billingReconciliation.js`, linhas 1–7.

**Correção recomendada:** selecionar com prioridade que permita avanço entre
negócios, considerando idade, última tentativa ou cursor, e aplicar backoff
adequado a falhas persistentes de contexto. Preservar a segurança da concessão
e a distinção entre execução concorrente e erro externo.

**Aceitação:** com mais elegíveis do que o lote, falhas persistentes não impedem
tentativas nos demais negócios em ciclos seguintes. Validar retomada após
reinício, concorrência entre workers e recuperação por GET.

Rastreabilidade: recuperação automática em RN32, RNF20 e contrato do worker em
`docs/planos.md`.

## Revalidação das correções anteriores

| Correção | Resultado nesta execução |
| --- | --- |
| OT-01 — Intenção de cancelamento | Passou: exclusão/expiração, estorno, atraso e chargeback preservam a intenção; reativação conferida a limpa. |
| OT-02 — Inativação da recorrência | Passou: período quitado e equipe preservados, remoção anterior confirmada antes da criação e retry seguro após falha. |
| OT-03 — Cobertura de período estornado | Passou: recebimento vencido não recupera a extensão invalidada, recebimento novo recupera e outra cobertura válida é preservada. |
| OT-04 — Diagnóstico da recuperação | Passou: consulta, remoção e contexto contam como falha, pendências aparecem na saúde e execução obsoleta não marca a versão seguinte. |

Os novos casos tratam de limpeza do checkout, fidelidade da data financeira e
seleção entre negócios. As regressões de agenda, equipe, RN50, contexto e
permissões não apresentaram falha na execução selecionada. Não se trata de
certificação exaustiva de todas as rotas ou do RBAC administrativo.

## Validação e limites

| Grupo | Resultado atual |
| --- | --- |
| Backend selecionado | 36 suítes; 305 testes passaram. |
| Integração SQL selecionada | 27 suítes; 171 passaram; 4 testes de PostgreSQL nativo não executados pelo harness. |
| Frontend completo | 118 arquivos; 801 testes passaram. |
| Novos ensaios observacionais | 6 verificados: NV-01a/01b, NV-02, NV-03 e dois controles. Asserções confirmam os defeitos descritos, não aprovam o produto. |

São **1.277 testes de regressão aprovados**, além dos seis ensaios de observação.
Os cenários refinados usam criação inicial e upgrade Autônoma → Studio com
datas vigentes; os dois controles diferenciam o comportamento defeituoso da
recuperação normal. Concessões foram vencidas no banco isolado para representar
os ciclos do worker, sem esperar a passagem real desses intervalos.

Ambiente local: Node `24.22.1`, `pg 8.23.1`, PGlite `0.5.11`, `TZ=UTC` e
117 migrations SQL, até a 119. O harness emula o parser `DATE` instalado do
`pg`, sem alterar o parser global do produto. Os quatro testes ignorados exigem
duas conexões nativas: duas variantes da equipe, cancelamento/pagamento e
disputa da execução da renovação. PGlite não comprova seus locks.

O alvo de CI continua Node 22/PostgreSQL 18. CI remoto, Asaas real, navegador,
carga e produção não foram executados. Lint/build e fusos adicionais da preparação
anterior não são contados como execução nova nesta auditoria. Não houve push,
merge, deploy ou alteração de código/migrations do produto.

Os requisitos v1.17 e critérios de aceitação v1.2 fornecidos foram conferidos
nos arquivos anexados. Os documentos e contratos atuais do repositório foram
usados junto das referências primárias do provedor. Nenhuma conclusão presume
cobrança efetivamente emitida, prejuízo real ou volume de produção não medido.

Evidência intermediária local:
`/workspace/scratch/7eae87c29875/audit-harness/owner-ninth-audit-20261024/`, com
`verification.json`, grupos/runner, logs de backend/integração/frontend,
`observations.log`, `observations.integration.test.js` e os JSONs `NV-01a`,
`NV-01b`, `NV-02`, `NV-02-control` e `NV-03`. O ensaio foi copiado
temporariamente para `tests/` para reutilizar os imports e removido ao concluir;
não integra a suíte normal com expectativas de comportamento defeituoso.

## Correções preparadas em 24/10/2026

As três pendências foram corrigidas nesta branch:

- **NV-01:** a migration 120 cria `assinatura_checkout_operacoes`. Criação inicial
  é registrada antes do POST; substituição grava a remoção anterior na mesma
  transação da troca de plano. Status financeiro e replay positivo não controlam
  mais a existência da obrigação. GET e worker recuperam a identidade externa,
  adotam somente com pagamento ainda válido ou removem a órfã. Não iniciam POST.
  Respostas tardias reabrem remoção, e IDs adicionais ganham obrigação própria.
  Concessão e versão protegem continuações; pendências bloqueiam novas operações
  financeiras e arquivamento e aparecem na saúde administrativa.
- **NV-02:** dados sem `paymentDate`/`confirmedDate` preservam a data financeira
  conhecida. O processamento não inventa o dia do pagamento nem outro mês pago.
- **NV-03:** o lote de renovação usa a última tentativa persistida como prioridade,
  com backoff de 15 minutos para contexto ausente e dois para outras falhas.
  GET pode antecipar a conferência sem ultrapassar a concessão em curso.

Os novos testes verificam recuperação por replay/GET/worker, criação aplicada ou
não aplicada após timeout, DELETE aplicado ou não aplicado com resposta perdida,
estorno da assinatura substituída, evento de criação tardio, versão obsoleta,
datas presentes/omitidas/nulas e repetição do update, saúde operacional,
progressão de lote e reconstrução conservadora na migration 120.

Validação local desta preparação: 37 suítes de backend (313 testes), 29 de
integração SQL (188 testes aprovados; cinco testes nativos não executados),
frontend completo (801 testes) e saúde administrativa atualizada (11 testes,
incluindo o novo caso de checkout; contagem com sobreposição ao frontend).
Os 16 casos novos de fluxo também passaram em `America/Sao_Paulo` e
`Pacific/Kiritimati`. Lint, análise de arquivos sem uso e build passaram.

Ambiente: Node 24.22.1, pg 8.23.1, PGlite 0.5.11, 118 migrations, até a 120.
O ensaio ampliado de toda a suíte com PGlite foi interrompido após atingir casos
de concorrência que exigem conexões PostgreSQL independentes; não é certificado
como aprovado. Ele também identificou uma asserção textual antiga sobre a
chamada de convites, ajustada para a escrita coordenada já coberta pelos testes
comportamentais do frontend e revalidada no backend selecionado.

CI nativo Node 22/PostgreSQL 18 continua obrigatório para o merge. Não houve
chamada ao Asaas real nem certificação de produção nesta preparação. Os cinco
casos não executados localmente incluem a nova disputa de concessão do checkout,
além das quatro limitações nativas documentadas na auditoria.

Evidência local desta preparação:
`/workspace/scratch/7eae87c29875/audit-harness/owner-ninth-fixes-20261024/`.
