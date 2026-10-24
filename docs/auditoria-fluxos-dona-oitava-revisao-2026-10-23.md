# Oitava auditoria dos fluxos da dona — 23 de outubro de 2026

**Código auditado:** `dfd92b08fdd0b77df4d06d3a7cda125fd9e40c84`, branch local
`fix/owner-agenda-recovery`.
**Escopo:** revalidação de ST-01 a ST-04, transições entre cancelamento,
inativação da recorrência, estorno, recebimento tardio e recuperação automática.
Também foram executadas regressões selecionadas de agenda, equipe, contexto,
permissões, sessão e encerramento.

As correções da revisão anterior passaram nos cenários cobertos. Foram
reproduzidos **quatro problemas adicionais: três P1 e um P2**. Esta revisão
registra sequências que a cobertura anterior não exercitava; não afirma que
todos os defeitos foram introduzidos no último commit. A auditoria não altera
a implementação.

## Resultado priorizado

| ID | Prioridade | Problema | Consequência confirmada |
| --- | --- | --- | --- |
| OT-01 | P1 | Recebimento após perda do status de cancelamento anuncia renovação sem recorrência | Conta fica `ATIVA`, sem pendência, apontando para um ID removido no provedor simulado; reativar responde que a renovação já está ativa. |
| OT-02 | P1 | Inativar a recorrência revoga um período ainda quitado | Negócio volta ao Grátis e integrante da equipe é inativada, embora o recebimento e o fim pago futuro permaneçam registrados. |
| OT-03 | P1 | Recebimento de um ciclo vencido recupera um período estornado | Webhook antigo de outro pagamento restaura benefícios até o fim anteriormente calculado para a cobrança que continua `REFUNDED`. |
| OT-04 | P2 | Falha de reconciliação é registrada como sucesso operacional | Consulta externa falha e a operação continua pendente, mas o worker informa zero falhas e atualiza seu último sucesso. |

P1 indica divergência financeira ou de acesso com efeito na jornada da dona.
P2 indica falha no diagnóstico da recuperação automática. Nenhum ensaio realizou
cobranças ou consultou contas reais.

## OT-01 — Estado financeiro substitui a intenção de renovação cancelada

A preservação implementada funciona quando o status continua `CANCELED`,
`CANCELLED` ou `REACTIVATING`, ou quando existe uma operação pendente da geração
atual. Fora desses estados, a confirmação financeira segue a ativação normal.
Um `asaas_subscription_id` preenchido é reutilizado sem distinguir um ID
historicamente removido de uma recorrência vigente.

Foram reproduzidas duas variantes independentes:

1. **Reconhecimento da exclusão após expiração.** Preparar cancelamento já
   vencido, com fim pago em `2026-10-22`; o worker mantém `CANCELED/ativo = false`.
   Receber `SUBSCRIPTION_DELETED` transforma o status em `DELETED`. Depois,
   processar o recebimento tardio de um pagamento de `2026-10-21`: o acesso é
   corretamente ampliado até `2026-11-21`, mas o serviço também grava `ACTIVE`
   apontando para `sub_original`, removida no provedor simulado.
2. **Estorno entre cancelamento e outro recebimento.** Cancelar a renovação;
   estornar um pagamento recebido, produzindo `REFUNDED/ativo = false`; receber
   outro pagamento válido da mesma assinatura. O acesso volta, mas a intenção
   de renovação cancelada desaparece e o ID removido é anunciado como ativo.

Na primeira variante, GET e worker posteriores não corrigem o estado. O pedido
de reativação responde **“A renovação desta assinatura já está ativa.”**, sem
criar ou conferir recorrência. Nas duas variantes, a conta retorna `ATIVA`,
`renovacao_pendente = false` e nenhuma nova criação externa. O provedor simulado
continua com zero recorrências ativas.

O ensaio de controle `cancelar → receber`, sem estado financeiro intermediário,
preserva `CANCELED`, o acesso ampliado e `CANCELAMENTO_AGENDADO`, como esperado.
Logo, a falha está na sobrevivência da intenção entre transições, não na simples
chegada de um pagamento após cancelamento.

**Código:** `assinaturaWebhookService.sincronizarAssinaturaPorWebhook`, decisão
de `DELETED`; `assinaturaPagamentoService.suspenderAssinaturaPorPagamento`;
`assinaturaAtivacaoAsaasService.assinaturaCancelada`,
`criarOuReutilizarRecorrencia` e `finalizarAtivacao`;
`assinaturaReativacaoService.reativarMinhaAssinatura`.

**Correção recomendada:** persistir a intenção/condição da renovação de forma
independente do estado do pagamento. Um recebimento válido pode restaurar acesso
sem declarar a recorrência ativa. Preservar a evidência de remoção e exigir uma
reativação explícita e conciliada antes de anunciar renovação. Não criar
recorrência automaticamente apenas para corrigir a apresentação.

**Aceitação:** cancelamento seguido de expiração, exclusão, estorno ou atraso e
posterior recebimento mantém o acesso legitimamente quitado e a renovação
cancelada. Verificar banco, DTO, mensagem da reativação e estado do provedor.

Rastreabilidade: RF36, RN21, RN32, RN36; contrato de cancelamento em
`docs/planos.md`.

## OT-02 — Inativação da recorrência corta acesso já pago

`manterPeriodoPago` só é verdadeiro para `SUBSCRIPTION_DELETED`.
`SUBSCRIPTION_INACTIVATED` sempre segue o encerramento imediato: grava
`INACTIVE/ativo = false`, retorna o negócio ao Grátis e reconcilia a equipe.
Isso ocorre mesmo com `acesso_pago_ate` explícito e futuro.

**Sequência reproduzida:**

1. Assinatura ativa com pagamento `RECEIVED`, acesso até `2099-12-01` e uma
   integrante ativa além da dona, dentro da capacidade do plano Autônoma.
2. Processar `SUBSCRIPTION_INACTIVATED`, sem evento de estorno ou inadimplência.
3. Consultar a conta e tentar reativar.

| Informação | Resultado |
| --- | --- |
| Pagamento | Continua `RECEIVED`. |
| Fim pago | Continua `2099-12-01`. |
| Assinatura | `INACTIVE/ativo = false`. |
| Plano efetivo | `inicial` (Grátis). |
| Integrante da equipe | Inativa por `excedente_limite_plano`. |
| Reativação | 409: “O período pago já terminou. Escolha um plano para contratar novamente.” |

O contrato oficial do Asaas diferencia a inativação da geração de novas
cobranças do estado das cobranças já existentes: `INACTIVE` interrompe novas
emissões e preserva as anteriores. A conclusão de que esse evento, sozinho, não
deve revogar acesso quitado é uma interpretação desse contrato junto da regra
local de preservação do período pago. Referência consultada em 23/10/2026:
[Atualizar assinatura existente](https://docs.asaas.com/reference/atualizar-assinatura-existente).

**Código:** `assinaturaWebhookService.sincronizarAssinaturaPorWebhook`, linhas
116–146 e caminho de encerramento; `assinaturaWebhookRepository`;
`equipePlanoService`; `assinaturaReativacaoService`.

**Correção recomendada:** tratar a inativação da recorrência separadamente da
revogação financeira. Preservar acesso e equipe até o fim quitado quando não
houver causa financeira independente para suspensão. Oferecer recuperação que
represente o estado real da recorrência, sem afirmar que um período futuro
terminou. A adaptação ao provedor deve respeitar suas regras para reativar uma
assinatura inativa.

**Aceitação:** eventos de exclusão e inativação preservam o mesmo período
legítimo; expiração real e estorno continuam aplicando seus efeitos próprios.
Exercitar também a equipe, o GET e a mensagem de recuperação.

Rastreabilidade: RF36/RF37, RN21/RN32; preservação do período em
`docs/planos.md`.

## OT-03 — Recebimento antigo restaura período cuja cobrança foi estornada

A suspensão financeira altera status e `ativo`, mas conserva
`acesso_pago_ate`. O cálculo do fim pago sempre inclui esse campo como evidência,
mesmo quando sua extensão foi originada por um pagamento agora estornado.
A ativação normal grava `ativo = true` e usa `GREATEST` para conservar o fim.
Assim, um recebimento de outro ciclo pode restaurar a extensão invalidada.

O ensaio passou pelo serviço real de fila e processamento de webhooks,
`webhookService.processarWebhookAsaas`, com SQL real no harness. Somente o
enfileiramento de conversão de marketing foi neutralizado nesse cenário.

**Sequência reproduzida em relação ao `CURRENT_DATE` de 23/10/2026:**

1. O pagamento antigo de `2026-09-23` cobre até `2026-10-23`, fim exclusivo;
   portanto, sozinho não concede acesso no dia corrente.
2. Confirmar outro pagamento de `2026-10-23`; o fim pago vai a `2026-11-23`.
3. Estornar essa cobrança atual. Seu status fica `REFUNDED`; o negócio volta
   ao Grátis e a assinatura fica inativa, mas conserva o fim em `2026-11-23`.
4. Entregar um `PAYMENT_RECEIVED` atrasado do pagamento de setembro. Seu evento
   é posterior ao último evento desse próprio pagamento, mas pertence ao ciclo
   anterior ao estorno. A ordenação por pagamento aceita corretamente o fato.
5. O processamento retorna `PROCESSED` e também restaura `ACTIVE/ativo = true`,
   plano Autônoma e acesso até `2026-11-23`.
6. Cancelar a renovação preserva esse mesmo fim. A cobrança de outubro continua
   `REFUNDED`; o único recebimento válido restante é o de setembro.

O defeito não exige reverter o status do pagamento estornado nem repetir o mesmo
ID de webhook. Registrar um recebimento histórico válido não deveria conceder
novamente o período de outra cobrança invalidada.

**Código:** `assinaturaPeriodoPagoService.calcularFimDoPeriodoPago`, linhas 7–17;
`assinaturaWebhookRepository.suspenderAssinatura`;
`assinaturaAtivacaoAsaasService.finalizarAtivacao`;
`assinaturaAtivacaoRepository.ativarAssinatura`, linhas 197–207.

**Correção recomendada:** distinguir acesso comprovado de um máximo histórico
que perdeu sua sustentação financeira. Reconciliar reversões com os períodos
que financiaram, preservando outras evidências válidas e sem inventar backfill.
Uma recuperação precisa comprovar cobertura vigente, respeitar o fim exclusivo
e não usar um recebimento vencido para desfazer suspensão de outro ciclo.
Preservar a proteção contra redução por simples eventos de programação.

**Aceitação:** receber, estornar e entregar eventos atrasados de outros ciclos
mantém apenas os direitos ainda válidos. Cobrir recebimento realmente novo,
estorno de cobrança antiga, repetição, chargeback, cancelamento posterior e
limites do plano, sem alterar o ledger histórico de forma destrutiva.

Rastreabilidade: RN21, RN32, RNF05; RF36/RF37.

## OT-04 — Recuperação pendente não aparece como falha operacional

`reconciliarReativacaoAbandonada` captura erros de lookup/remoção, registra aviso
e retorna `null`. O worker interpreta `null` como ausência de efeito, sem somar
falha. Ao concluir o lote, atualiza `ultimoSucessoEm` e limpa `ultimoErro`.
As filas da saúde operacional não incluem `assinatura_renovacao_operacoes`.

**Sequência reproduzida:** cancelar, iniciar reativação com resposta perdida,
vencer a concessão de execução e tornar a consulta externa indisponível. A
recorrência permanece ativa no provedor simulado; a operação local continua
`PENDING`, recuperável pela mesma referência.

| Evidência | Valor observado |
| --- | --- |
| Candidatos do worker | 1 |
| Renovações reconciliadas | 0 |
| Falhas no resultado | 0 |
| Falhas nas métricas do worker | 0 |
| `ultimoSucessoEm` | Atualizado. |
| `ultimaFalhaEm` / `ultimoErro` | `null` / `null`. |
| Filas consultadas pela saúde | Webhooks, WhatsApp e conversões, todas sem pendência no ensaio. |
| Obrigação de renovação | Continua pendente. |

Há aviso em log e a obrigação não é apagada. O problema comprovado é a
inconsistência do diagnóstico estruturado: uma falha externa real é reportada
como sucesso e sua pendência não aparece nas filas do painel operacional.

**Código:** `assinaturaReativacaoService.reconciliarReativacaoAbandonada`,
linhas 102–127; `billingReconciliationWorker`, linhas 103–115 e 160–170;
`operationalMetricsService`; `operationalMetricsRepository.buscarFilas`.

**Correção recomendada:** distinguir execução sem efeito, disputa de concessão,
resolução concluída e falha externa. O worker deve contabilizar a falha sem
perder o retry nem interromper os demais negócios. Expor quantidade e idade das
operações pendentes em métricas seguras, sem payloads ou credenciais.

**Aceitação:** falhas de consulta e remoção deixam a obrigação durável e
produzem diagnóstico de falha/degradação; recuperação posterior registra sucesso.
Disputa normal entre executores não deve gerar falso incidente.

Rastreabilidade: recuperação do ciclo em RN32 e testabilidade em RNF20;
contrato de saúde operacional em `AGENTS.md` e `docs/arquitetura.md`.

## Revalidação das correções anteriores

| Correção | Resultado nesta revisão |
| --- | --- |
| ST-01 — Data externa incompatível com período ampliado | Passou: remoção antes de substituição, uma substituição automática e remoção incerta recuperável. |
| ST-02 — Programação sobrescrevendo fim pago | Passou: UPDATED/DELETED com data antiga preservam fim pago, GET/worker e cancelamento idempotente. OT-02 cobre outro tipo de evento. |
| ST-03 — Suspensão durante criação externa | Passou: operação sobrevive a estorno, atraso e chargeback; ID criado é removido ou permanece durável para retry. OT-01 cobre intenção sem operação pendente. |
| ST-04 — Tentativa vencida mantendo benefícios | Passou: expiração do acesso e recuperação da operação continuam independentes, inclusive com lookup indisponível. OT-04 cobre a métrica dessa falha. |

As regressões selecionadas de agenda, RN50, equipe, contexto e permissões não
apresentaram nova falha na execução local. Isso não equivale a uma auditoria
exaustiva de todas as rotas, do RBAC administrativo ou de todos os interleavings.

## Execução e limites da evidência

| Grupo | Resultado atual |
| --- | --- |
| Backend unitário selecionado | 35 suítes, 298 testes passaram. |
| Integração SQL selecionada | 25 suítes, 149 passaram; 4 testes nativos ignorados pelo harness. |
| Frontend selecionado | 8 arquivos, 88 testes passaram. |
| Novos ensaios observacionais | 6 passaram: OT-01a/01b, OT-02/03/04 e um controle; asserções confirmam os defeitos descritos. |

São **535 testes de regressão aprovados**, além dos seis ensaios de observação.
Uma expectativa inicial do ensaio de controle foi corrigida para o código real
`CANCELAMENTO_AGENDADO`; isso não exigiu alteração no produto. Os defeitos novos
não estavam cobertos pelas asserções de regressão executadas.

Ambiente: Node `24.19.0`, `pg 8.23.1`, PGlite `0.5.11`, `TZ=UTC` e todas as
116 migrations SQL, até a 118, aplicadas em bancos isolados do harness. A
configuração emula o parser `DATE` instalado do `pg`; não foi alterado parser
global do produto. O alvo de CI continua Node 22/PostgreSQL 18.

Os quatro testes ignorados exigem duas conexões PostgreSQL nativas: duas
variantes de equipe, cancelamento/pagamento e disputa de execução da renovação.
PGlite não comprova seus locks. Não foram executados CI remoto, sandbox real do
Asaas, navegador, teste de carga ou smoke em produção. Não houve push, merge,
deploy nem mudança em migrations/dependências. Lint, build e a suíte frontend
integral da preparação anterior não são contados como nova evidência aqui.

Evidência intermediária local:
`/workspace/scratch/7eae87c29875/audit-harness/owner-eighth-audit-20261023/`:
`verification.json`, `test-groups.json`, `backend.log`, `integration.log`,
`frontend.log`, `observations.log`, `observations.integration.test.js` e
`OT-01a.json` a `OT-04.json`. O ensaio foi copiado temporariamente para `tests/`
para reutilizar imports e removido ao concluir; não integra a suíte normal com
expectativas de comportamento defeituoso.

As referências RF/RN foram conferidas nos requisitos v1.17 e critérios de
aceitação v1.2 fornecidos anteriormente. Os contratos atuais de plano e
cancelamento foram lidos no repositório. Este relatório é evidência de revisão;
as regras canônicas continuam nos documentos de domínio e no código.

## Correções preparadas após a oitava revisão

Implementação local preparada a partir de `2711bef`, em 23/10/2026. A seção
anterior conserva a evidência do código auditado; esta seção registra o resultado
das correções e sua validação.

| Achado | Correção preparada | Evidência de regressão |
| --- | --- | --- |
| OT-01 | `renovacao_cancelada` conserva a intenção entre exclusão, expiração, atraso e reversão. Confirmação financeira não anuncia renovação de um ID removido; a reativação conferida limpa o marcador. | Exclusão após expiração e recebimento tardio; estorno, atraso e chargeback antes de outro recebimento; reconhecimento de exclusão sem apagar a suspensão financeira. |
| OT-02 | Inativação externa preserva acesso e equipe ainda quitados. Reativação confirma a remoção da recorrência anterior antes de criar outra, inclusive se ela estava apenas inativa. | INACTIVATED e UPDATED/INACTIVE, integrante ativa, confirmação de remoção antes do POST, DELETE incerto e retry, evento tardio do ID anterior. |
| OT-03 | Falha financeira recalcula cobertura pelos pagamentos atualmente válidos. Máximo histórico e programação não recuperam o período de uma cobrança invalidada. Recebimento vencido não ativa benefícios. | Sequência real de processamento de webhooks antigo/atual/estornado, recuperação por recebimento novo, estorno de cobrança antiga, coberturas coincidentes e checkout vigente/vencido. |
| OT-04 | Falhas da recuperação são persistidas por código e versão, propagadas ao worker e apresentadas na fila de renovações da saúde operacional. | Falha de consulta/remoção/contexto, erro de versão antiga, isolamento do próximo negócio no lote e recuperação posterior, além de exibição no Admin. |

A **migration 119** acrescenta os marcadores de intenção e reconciliação na
assinatura e o diagnóstico seguro na operação. O backfill usa status ou fato de
cancelamento identificável da geração atual. Não cancela uma geração posterior
por causa de um fato antigo nem cria pagamentos, períodos adicionais ou fatos
retroativos no ledger. Estados financeiros suspensos passam a exigir evidência
dos pagamentos na próxima tentativa de recuperação; a migration não restaura
acesso automaticamente.

Novos checkouts usam `acesso_pago_reconciliado` desde a criação. Antes da chamada
externa e na finalização, cobertura vigente é conferida usando `CURRENT_DATE`.
Confirmar um recebimento histórico mantém o registro financeiro; quando ele não
comprova cobertura atual, o webhook fica `IGNORED` para efeito de ativação. Uma
reversão de cobrança antiga não suspende outro período ainda legitimamente
recebido. Suspensão sem cobertura limpa o fim pago, sem reaproveitar uma data
futura de programação.

O DTO não expõe os novos marcadores internos. A recuperação mantém o contrato
de processamento visível e também cobre tentativa legada sem registro de
operação e pagamento da nova recorrência antes da resposta HTTP, inclusive
quando não havia ID de recorrência anterior. HTTP continua fora das transações;
GET/worker não criam recorrências. A confirmação adicional de remoção antes da
reativação repete somente o ID anterior e é idempotente.

### Validação das correções

| Grupo | Resultado final |
| --- | --- |
| Backend unitário | 36 suítes; **305 passaram**. |
| Integração SQL | 27 suítes; **171 passaram**, 4 testes nativos não executados pelo harness. |
| Frontend completo | 118 arquivos; **801 passaram**. |
| Novas variantes de integração | 21 casos incluídos no total SQL, mais replay específico da migration 119. |
| Fusos adicionais | Os mesmos 21 casos passaram em `America/Sao_Paulo` e `Pacific/Kiritimati`; UTC está na rodada principal. Repetições não aumentam o total de testes distintos. |
| Frontend lint, build e código sem uso | Passaram. |

As regressões anteriores detectaram uma transição legada `REACTIVATING` sem
operação materializada; ela foi preservada na correção. As expectativas de
remoção foram atualizadas para conferir a confirmação adicional do ID anterior,
mantendo a proibição de remover a recorrência da geração nova. A expectativa de
um checkout histórico vencido foi validada com os metadados do caminho real de
webhook, distinguindo o retorno legado da fachada de uma nova ativação.

Foram aplicadas **117 migrations**, até a 119, em PGlite `0.5.11`, com o parser
`DATE` de `pg 8.23.1`, Node `24.19.0` e `TZ=UTC`. A suíte específica também
reaplica a migration 119 em schema isolado para conferir cancelamentos de ciclos
diferentes, ausência de acesso novo e preservação de estados financeiros.
AGENTS, planos e arquitetura foram sincronizados com os contratos preparados.

Os quatro testes que exigem PostgreSQL nativo continuam pendentes nesta
validação local. O alvo de CI é Node 22/PostgreSQL 18; CI remoto, Asaas real,
navegador e produção não foram executados. As chamadas financeiras usaram
provedor simulado com estado. Merge e implantação não fazem parte desta
preparação.

Evidência intermediária:
`/workspace/scratch/7eae87c29875/audit-harness/owner-eighth-fixes-20261023/`,
incluindo `verification.json`, grupos/runner, logs finais de backend,
integração, frontend, lint/build/código sem uso e os dois fusos adicionais.
