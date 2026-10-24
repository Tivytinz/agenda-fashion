# Sexta auditoria dos fluxos da dona — 23 de outubro de 2026

**Código auditado:** `c4bec0b`, branch local `fix/owner-agenda-recovery`.
**Escopo:** revalidação das quatro correções anteriores e novas intercalações
entre confirmação financeira, cancelamento e reativação; regressões selecionadas
de agenda, equipe, contexto, permissões e encerramento. Inspeção de código e
reproduções locais com SQL real e provedor simulado.

As correções de `c4bec0b` passaram nos cenários que motivaram sua implementação.
A revisão encontrou **quatro problemas adicionais: dois P1 e dois P2**. Os novos
casos ampliam a cobertura; não há evidência de que tenham sido introduzidos pelo
último commit. Este relatório não altera a implementação.

## Resultado priorizado

| ID | Prioridade | Problema | Impacto confirmado |
| --- | --- | --- | --- |
| QS-01 | P1 | Pagamento confirmado durante o cancelamento perde parte do período pago | A resposta antiga do cancelamento sobrescreve o fim de acesso atualizado pelo pagamento, embora recorrência e geração ainda coincidam. |
| QS-02 | P1 | Pagamento durante a reativação marca localmente a recorrência antiga como ativa | O webhook financeiro transforma `REACTIVATING` em `ACTIVE`; a nova recorrência criada no provedor fica sem vínculo local e a recuperação normal não a adota. |
| QS-03 | P2 | Cancelar, reativar e cancelar no mesmo período suprime o segundo fato | Dois cancelamentos efetivos de recorrências diferentes usam a mesma chave no ledger, que mantém somente o primeiro. |
| QS-04 | P2 | Checkout inicial pode antecipar a próxima cobrança em processo com fuso positivo | A saga de ativação calcula o mês com campos UTC de um `DATE` do driver. Em Kiritimati, o exemplo de 1º de dezembro vira 30 de novembro. |

P1 indica divergência financeira ou de acesso relevante. P2 indica perda de
rastreabilidade ou falha condicionada ao ambiente. Não houve cobrança real nem
consulta ao estado de produção.

## QS-01 — Cancelamento antigo sobrescreve pagamento do mesmo ciclo técnico

O cancelamento calcula `acessoAte` antes de aguardar o DELETE externo. O UPDATE
posterior confere `asaas_subscription_id` e `reativacao_tentativa`, mas não relê
o período ou a evidência financeira que mudou durante essa espera.

**Reprodução com os serviços públicos reais:**

1. Assinatura ativa aponta para `sub_original`, geração zero e fim de acesso em
   `2099-12-01`, com recebimento anterior registrado.
2. O cancelamento calcula esse fim e fica aguardando a resposta simulada do
   provedor.
3. `assinaturaService.ativarAssinaturaPorPagamento` processa uma renovação
   recebida de `2099-12-01`. O pagamento fica `RECEIVED` e a assinatura passa a
   ter acesso até `2100-01-01`.
4. A resposta antiga do DELETE termina. O cancelamento grava novamente
   `2099-12-01` e retorna sucesso.

Estado observado:

```json
{
  "apos_pagamento": {
    "status": "ACTIVE",
    "asaas_subscription_id": "sub_original",
    "reativacao_tentativa": 0,
    "acesso_ate": "2100-01-01"
  },
  "apos_cancelamento": {
    "status": "CANCELED",
    "asaas_subscription_id": "sub_original",
    "reativacao_tentativa": 0,
    "acesso_ate": "2099-12-01"
  }
}
```

O pagamento continua recebido no banco. O ensaio comprova perda de um mês no fim
persistido do acesso, sem avançar o relógio para executar a expiração futura.
As datas futuras são fixtures isoladas, não transações reais de clientes.

**Código:** `assinaturaContaService.calcularFimDoPeriodoPago` e
`cancelarMinhaAssinatura`, especialmente linhas 511–539;
`assinaturaRepository.registrarCancelamento`, linhas 254–303.

**Correção recomendada:** reconciliar a evidência de período pago na transação
local, usando a mesma fronteira de serialização da confirmação financeira. A
continuação do cancelamento precisa preservar o período mais recente efetivamente
quitado, além de conferir recorrência e geração. Manter a chamada HTTP externa
fora da transação.

**Aceitação:** pagamentos antes, durante e depois do cancelamento preservam o
período legitimamente quitado; a renovação permanece cancelada sem retorno
indevido ao grátis. Exercitar as ordens de conclusão entre serviços e também
duas conexões PostgreSQL nativas.

Rastreabilidade: RF36/RF37; RN21/RN32; preservação do período pago em
`docs/planos.md`.

## QS-02 — Confirmação de pagamento destrói a reativação em andamento

A saga pública `assinaturaAtivacaoAsaasService` bloqueia assinaturas
`CANCELED`/`CANCELLED`, mas aceita `REACTIVATING`. Sua finalização usa a
recorrência já persistida na linha e o repository grava `ACTIVE` por ID. Essa
recorrência ainda é a anterior, removida quando a dona cancelou.

**Intercalação reproduzida:**

1. Cancelar `sub_original` e preservar o período pago.
2. Iniciar reativação: a tentativa 1 reserva `REACTIVATING`; a criação externa
   fica aguardando resposta.
3. Processar uma confirmação financeira da recorrência anterior. A saga muda a
   linha para `ACTIVE`, ainda apontando para `sub_original`.
4. A criação simulada retorna `sub_reactivated`. O CAS da reativação recusa
   finalizar porque o status já não é `REACTIVATING`; o serviço retorna conflito
   409.
5. A leitura da assinatura continua mostrando `ACTIVE/sub_original`. Outra
   tentativa de reativar responde que a renovação já está ativa. O webhook
   `SUBSCRIPTION_CREATED` da nova recorrência, com a referência produzida pelo
   próprio serviço, também retorna `null` e não recupera o vínculo.

Estado final local:

```json
{
  "status": "ACTIVE",
  "ativo": true,
  "asaas_subscription_id": "sub_original",
  "reativacao_tentativa": 1,
  "acesso_ate": "2100-01-01"
}
```

O provedor simulado criou `sub_reactivated`; a única remoção solicitada foi de
`sub_original`. Não existe linha vinculada à nova recorrência. Isso comprova
divergência entre o resultado externo simulado e a identidade local. Não foi
executada cobrança posterior, portanto não se afirma duplicidade de cobrança.

**Código:** `assinaturaAtivacaoAsaasService.assinaturaCancelada`, linhas 88–99,
e `finalizarAtivacao`, linhas 317–364;
`assinaturaAtivacaoRepository.ativarAssinatura`, linhas 158–189;
`assinaturaReativacaoService`, linhas 213–218 e 323–338. A reconciliação de
reativação abandonada seleciona somente linhas `REACTIVATING`.

**Correção recomendada:** processar o fato financeiro sem apagar a intenção de
reativação, sua geração ou o vínculo externo em resolução. As escritas do domínio
financeiro precisam compartilhar o contrato de estados da renovação. Se a criação
externa concluir sem vínculo local, a reconciliação deve conseguir verificar a
mesma referência e resolver o resultado, sem anunciar atividade da recorrência
já removida ou criar outra às cegas.

**Aceitação:** pagamento durante criação, timeout e retomada preserva intenção,
período pago e referência correta. Finalização e recuperação não deixam recorrência
externa sem tratamento nem retornam falso sucesso de renovação ativa. Validar
também o webhook da recorrência criada e as ordens inversas das respostas.

Rastreabilidade: RF36; RN21/RN32/RN36; contrato de reativação idempotente.

## QS-03 — A identidade do fato não distingue cancelamentos de gerações diferentes

A normalização de `Date` para dia civil corrigiu a duplicação entre conta e
webhook do mesmo cancelamento. A chave continua sendo apenas
`assinatura:<id>:RENOVACAO_CANCELADA:<dia>`, sem identificar geração ou recorrência.

**Reprodução sequencial, sem depender de concorrência:**

1. Cancelar `sub_original`, geração zero e acesso até `2099-12-01`.
2. Reativar a assinatura: ela volta a `ACTIVE`, agora com `sub_reactivated` e
   tentativa 1, mantendo o mesmo período pago.
3. Cancelar a nova recorrência. O serviço conclui, o estado fica `CANCELED` e as
   chamadas externas de remoção contêm `sub_original` e `sub_reactivated`.
4. O ledger conserva somente **uma** linha `RENOVACAO_CANCELADA`.

O segundo fato é suprimido por `ON CONFLICT (chave_idempotencia) DO NOTHING`.
Não é uma confirmação repetida do primeiro cancelamento: houve reativação e
remoção de outra recorrência entre as ações. Não foi quantificada alteração em
métricas administrativas; a perda de rastreabilidade é diretamente observável.

**Código:** `assinaturaLifecycleService.registrarCancelamentoRenovacao`, linhas
316–355; `assinaturaEventoRepository.registrar`, cláusula de idempotência.

**Correção recomendada:** usar identidade estável do cancelamento que distinga
recorrência/geração. Conta e webhook do mesmo cancelamento continuam reconhecendo
um único fato, enquanto uma nova decisão após reativar gera outro. Tratar a
compatibilidade com chaves antigas sem apagar ou inventar histórico.

**Aceitação:** dois cancelamentos separados por uma reativação produzem dois
fatos, mesmo com a mesma data de acesso; retries e confirmações do mesmo ciclo
continuam produzindo um só. Testar as duas ordens conta/webhook em cada geração.

Rastreabilidade: RF36; RNF05/RNF20; ledger de assinatura em `AGENTS.md` e
`docs/planos.md`.

## QS-04 — A saga do checkout ainda interpreta DATE como instante UTC

Na primeira ativação PIX, `criarOuReutilizarRecorrencia` recebe
`data_pagamento`/`data_vencimento` do SQL como `Date`. A saga tem uma função mensal
própria, que extrai `getUTCFullYear/getUTCMonth/getUTCDate`, sem a normalização
civil usada pelo cancelamento e pelo DTO.

**Mesmo cenário, dois processos:** pagamento de `2099-11-01`, assinatura pendente
sem recorrência e confirmação financeira pela fachada pública de assinatura.

| TZ do processo | Próxima cobrança enviada ao provedor simulado | Valor persistido |
| --- | --- | --- |
| `UTC` | `2099-12-01` | `2099-12-01` |
| `Pacific/Kiritimati` | `2099-11-30` | `2099-11-30` |

O parser instalado do `pg` representa 1º de novembro à meia-noite em Kiritimati
como 31 de outubro em UTC. Somar o mês a essa interpretação produz 30 de novembro.
A falha afeta a solicitação externa e a persistência, antes da apresentação da UI.

**Condição:** processo em fuso positivo. O ensaio não determina o TZ da produção
e não atribui a antecipação ao ambiente atualmente implantado.

**Código:** `assinaturaAtivacaoAsaasService`, função mensal nas linhas 23–58 e
uso de `DATE` nas linhas 215–219. A fachada `assinaturaService` exporta essa saga
como caminho público de ativação, portanto não é apenas um ramo legado sem uso.

**Correção recomendada:** aplicar o contrato de dia civil à origem SQL antes de
somar o ciclo e eliminar a divergência entre calculadores financeiros. Manter a
semântica distinta dos campos de observação `TIMESTAMPTZ`.

**Aceitação:** primeira ativação com datas reais do parser `pg` mantém a mesma
próxima cobrança em UTC, São Paulo, Los Angeles e Kiritimati, incluindo fim de
mês e ano bissexto. O teste precisa alcançar o argumento enviado ao provedor e
o valor persistido pela saga.

Rastreabilidade: RF35/RF36; RN21/RN32; contrato civil de `docs/planos.md`.

## Regressão, escopo e limites

| Fluxo | Evidência nesta revisão | Resultado |
| --- | --- | --- |
| Datas no JSON, NULL financeiro, cancelamento de geração obsoleta e deduplicação conta/webhook | Suítes das quatro correções de `c4bec0b`, incluindo controller/SQL/JSON e recuperação da UI | Os cenários anteriores passaram. |
| Agenda da dona, sobreposição/continuidade, cancelamento e reagendamento | Regressões de service, SQL e componentes da agenda | Casos selecionados passaram. |
| Equipe, convites, ativação/inativação, remoção e contexto restrito RN50 | Regressões de autorização e integração | Casos selecionados passaram; concorrência nativa continua pendente. |
| Sessão, contexto administrativo e encerramento | Suítes selecionadas de contexto e privacidade | Casos selecionados passaram. |
| Confirmação financeira intercalada, novos cancelamentos e primeira cobrança | Quatro reproduções adicionais | QS-01 a QS-04. |

Execuções sobre `c4bec0b`:

- **288 testes backend em 34 suítes passaram.**
- **104 testes de integração em 18 suítes passaram.** Dois testes que exigem
  conexões PostgreSQL nativas foram explicitamente ignorados pelo harness e não
  contam como aprovados.
- **85 testes frontend em oito arquivos passaram**, em duas seleções sem
  sobreposição. A suíte completa de 797 testes, lint e build da preparação
  anterior não foram repetidos nesta auditoria documental.
- **Quatro ensaios SQL adicionais** confirmaram os resultados observados em UTC;
  a primeira ativação foi repetida em Kiritimati e a recuperação de reativação foi
  ampliada com GET, nova tentativa e webhook da recorrência criada. Esses ensaios
  assertam falhas observadas, não comportamento desejado, e não entram na contagem
  das regressões regulares.
- Os **114 arquivos de migrations** foram aplicados em bancos PGlite isolados.
  O harness emula o parser de `DATE` do `pg` instalado, sem alterar o produto.

As transações SQL dos ensaios são sequenciais; somente as esperas externas são
intercaladas. Isso demonstra os caminhos de service e persistência, sem comprovar
locks entre conexões nativas. O runtime local é Node 24.19.0; o CI declarado usa
Node 22/PostgreSQL 18. Não houve Asaas real, CI remoto, Safari/Playwright, carga,
leitura de dados de produção, push, merge ou deploy. Nenhum acesso indevido novo
foi reproduzido pelos casos selecionados; isso não certifica todo o RBAC.

## Evidências e reprodução

Evidências intermediárias em `audit-harness/owner-flow-sixth-20261023`, ao lado
do repo:

- `owner-sixth-audit.repro.test.js`: quatro cenários; copiar temporariamente para
  `tests/owner-sixth-audit.repro.test.js` para resolver os imports relativos;
- `repro.log`: reprodução UTC;
- `positive-timezone.log`: QS-04 em Kiritimati;
- `reactivation-recovery.log`: QS-02 com as verificações ampliadas;
- `backend.log`, `integration.log`, `frontend.log` e `frontend-agenda.log`:
  regressões selecionadas.

Usar a configuração PGlite da preparação `owner-fourth-fixes-20261022`,
`--runInBand --runTestsByPath tests/owner-sixth-audit.repro.test.js`,
`NODE_ENV=test`, `DATABASE_URL` apontando para o banco local de teste e as
variáveis locais de teste exigidas pelo projeto. Para o controle, `TZ=UTC`; para
QS-04, `TZ=Pacific/Kiritimati` com `--testNamePattern QS-04`. O arquivo foi
retirado da suíte regular depois da auditoria, pois suas asserções descrevem
defeitos; convertê-las em invariantes corretos ao implementar as correções.

Referências lidas: *Agenda Fashion Requisitos v1.17* e *Critérios de Aceitação
v1.2*, anexados à conversa; `AGENTS.md`, contratos de planos e ciclo operacional,
relatório anterior, código executável, testes e migrations. A prioridade é
corrigir QS-01 e QS-02 antes do merge.

## Correções preparadas — 23 de outubro de 2026

Implementação local posterior à auditoria de `c4bec0b`:

| Achado | Correção | Regressão persistente |
| --- | --- | --- |
| QS-01 | Cancelamento relê assinatura e recebimentos na transação, bloqueando negócio antes da assinatura. O cálculo compartilhado mantém o maior fim válido, e o UPDATE protege esse fim. Pagamento posterior preserva `CANCELED`, ampliando apenas o acesso legitimamente pago. | Pagamento durante DELETE, depois do cancelamento e recebimento antigo com ID posterior. Cenário com duas conexões nativas incluído para o CI. |
| QS-02 | Confirmação financeira preserva `REACTIVATING`. A data da tentativa fica congelada em `reativacao_inicio_cobranca`, enquanto o fim pago pode crescer. Retomada consulta a mesma referência e finalização preserva o período ampliado. Reconhecimentos da recorrência anterior não desfazem a reserva. | Pagamento durante criação, quatro tipos de evento antigo, resposta externa incerta, retomada por GET, reserva legada, ausência confirmada e tentativa seguinte. |
| QS-03 | Novos ciclos identificam o cancelamento por assinatura, geração e recorrência. A migration 117 preserva o formato dos ciclos preexistentes até reativação; o ledger histórico não é reescrito. | Dois cancelamentos no mesmo período produzem dois fatos; retries e conta/webhook nas duas ordens mantêm um fato por geração; compatibilidade e extensão de período. |
| QS-04 | Saga e caminho financeiro legado usam o calculador mensal compartilhado com a origem SQL normalizada como dia civil. | Primeira ativação verifica parâmetro enviado ao provedor e valor persistido; datas normais, fim de mês, ano bissexto e virada de ano. |

Arquivos principais de regressão:
`tests/owner-sixth-fixes.integration.test.js`, `tests/assinatura-periodo-pago.test.js`
e suítes existentes de cancelamento, lifecycle e DTO da conta. O helper de período
não acessa o banco fora do repository e aceita o executor da transação.

Validação local:

- **295 testes backend em 35 suítes passaram.**
- **121 testes de integração em 19 suítes passaram**, incluindo os 17 novos
  cenários SQL desta preparação. **Três testes nativos foram ignorados pelo
  harness**: os dois anteriores da equipe e o novo de pagamento/cancelamento
  entre conexões. Precisam do PostgreSQL do CI e não contam como aprovados.
- **85 testes frontend selecionados em oito arquivos passaram.** A implementação
  não altera componentes ou estilos; lint, build e a suíte frontend completa não
  foram repetidos nesta preparação.
- Os **115 arquivos de migrations**, incluindo a nova 117, foram aplicados em
  bancos PGlite isolados. A migration adiciona dois metadados compatíveis com as
  linhas existentes e não altera períodos pagos ou fatos históricos.
- Os quatro casos da primeira ativação passaram em processos UTC, São Paulo,
  Los Angeles e Kiritimati. Essas repetições não aumentam os 121 casos distintos.

Runtime local Node 24.19.0; CI declarado Node 22/PostgreSQL 18. Asaas simulado,
sem validação de cobranças reais ou do processamento externo de faturas.
Não houve CI remoto, Safari/Playwright, carga, push, merge ou deploy. A aplicação
nova exige a migration 117 antes de iniciar; não há alteração de dependências.
