# Quinta auditoria dos fluxos da dona — 22 de outubro de 2026

**Código auditado:** `14955aa`, branch local `fix/owner-agenda-recovery`.
**Escopo:** revalidação das correções anteriores e revisão dos contratos entre
interface, API, persistência e provedor nos fluxos da dona. Inspeção de código,
regressão selecionada e reproduções locais isoladas.

A revisão confirmou quatro problemas adicionais, dois P1 e dois P2. Os testes
dos três pontos corrigidos na rodada anterior passaram; os cenários abaixo não
estavam cobertos por eles. Esta auditoria registra evidência e recomendações,
sem alterar implementação ou operar produção.

## Resultado priorizado

| ID | Prioridade | Problema | Condição e impacto |
| --- | --- | --- | --- |
| QN-01 | P1 | Tela de assinatura quebra com as datas reais do JSON da API | `DATE` chega como data-hora ISO, mas o formatador só aceita dia textual. A renderização lança `RangeError`, retirando acesso às ações da assinatura. |
| QN-02 | P1 | Cancelamento antigo sobrescreve uma renovação recém-reativada | Depois do webhook e da reativação, a escrita atrasada do cancelamento marca a nova recorrência como cancelada localmente, sem removê-la no provedor. |
| QN-03 | P2 | Pagamento recebido sem datas transforma o fim do acesso em 1970 | Registro permitido pelo schema é escolhido sem verificar a data. O cancelamento encurta um período futuro conhecido e a consulta seguinte retorna ao grátis. |
| QN-04 | P2 | Cancelamento e confirmação do webhook registram dois fatos de renovação cancelada | A chave de idempotência usa texto civil em um caminho e `Date.toString()` no outro. O mesmo cancelamento vira duas linhas no ledger. |

P1 indica interrupção de uma tarefa central ou divergência financeira importante.
P2 indica condição específica de dados ou quebra de rastreabilidade. Os quatro
casos foram reproduzidos; não houve chamada ao Asaas ou cobrança real.

## QN-01 — Contrato entre a API de assinatura e a apresentação de datas

`buscarMinhaAssinatura` retorna `assinatura` e `pagamentos` sem normalizar seus
campos civis. `assinaturaRepository` usa o parser padrão do `pg`, e o controller
envia o objeto por `res.json`. Portanto, `DATE` é serializado como data-hora ISO.
O cliente HTTP usa `response.json()` e conserva essas strings.

O formatador `frontend/src/utils/format.js`, linhas 58–64, acrescenta
`T12:00:00` ao valor inteiro. Receber `2099-12-01T06:00:00.000Z` produz uma
entrada inválida para `Date` e `Intl.DateTimeFormat` lança
`RangeError: Invalid time value`.

**Reprodução:**

1. SQL real cria assinatura ativa e pagamento com campos `DATE` válidos.
2. Um GET local executa o controller/service reais e a serialização do Express.
3. A resposta HTTP contém, por exemplo:

   ```json
   {
     "assinatura": {
       "data_proxima_cobranca": "2099-12-01T06:00:00.000Z"
     },
     "pagamentos": [
       { "data_pagamento": "2099-11-01T06:00:00.000Z" }
     ]
   }
   ```

4. Esse JSON é usado diretamente no componente `SubscriptionPage` com jsdom.
   A renderização cai no ErrorBoundary com `RangeError:Invalid time value` e
   não apresenta `Cancelar renovação`.
5. Como controle, apenas as datas do mesmo payload são convertidas para dias
   textuais; o componente abre e apresenta a ação de cancelamento.

A captura HTTP real usa uma identidade de teste conhecida no request, não uma
sessão ou dado de produção. A reprodução de UI comprova a falha do componente,
sem afirmar uma validação visual de navegador.

**Pontos de código:**

- `assinaturaContaService.js`, linhas 373–425, conserva os objetos retornados;
- `assinaturaRepository.js`, `buscarAssinaturaAtivaPorNegocio` e linhas 578–599;
- `assinaturaController.js`, `buscarMinhaAssinatura`, usa `res.json(resultado)`;
- `SubscriptionPage.jsx`, linhas 453–454 e 589, formata assinatura e pagamentos;
- `frontend/src/api/client.js`, leitura de JSON sem normalização de datas.

**Correção recomendada:** definir o contrato de dias civis no DTO financeiro,
incluindo assinaturas, pagamentos, upgrade pendente e respostas canônicas de
cancelamento/reativação. A UI deve tratar ausência ou formato inválido sem
derrubar a página. Preservar o dia civil original do banco, inclusive em fusos
positivos; o controle do teste não prescreve simplesmente cortar qualquer ISO
em produção. Uma extração do ISO de um `DATE` já convertido pode perder o dia.

**Aceitação:** resposta real de GET renderiza; respostas de DELETE/POST também
podem ser adotadas antes do GET seguinte sem falha; histórico de pagamentos e
datas ausentes têm tratamento explícito; teste cobre o JSON produzido pelo
backend, além dos mocks usuais com `AAAA-MM-DD`.

Rastreabilidade: RF36; RNF19/RNF20.

## QN-02 — Cancelamento atrasado não protege a identidade da recorrência

O cancelamento lê a assinatura e remove a recorrência externa fora da transação.
Depois atualiza a linha local. `registrarCancelamento` exige apenas ID, negócio
e `ativo = TRUE`; não confere a recorrência removida ou a geração observada.

**Intercalação reproduzida com SQL real e provedor simulado:**

1. Assinatura local `ACTIVE` aponta para `sub_original`.
2. A dona inicia cancelamento A. A chamada simulada para remover
   `sub_original` fica aguardando resposta.
3. O webhook `SUBSCRIPTION_DELETED` chega antes da continuação de A e persiste
   `CANCELED`, mantendo o período pago.
4. Outra requisição reativa a renovação: a tentativa 1 cria `sub_new_active`
   e a linha local volta a `ACTIVE` com esse novo identificador.
5. A resposta antiga de A termina. Seu UPDATE muda a mesma linha para
   `CANCELED`, embora agora represente `sub_new_active`.

**Resultado observado:**

```json
{
  "status": "CANCELED",
  "ativo": true,
  "asaas_subscription_id": "sub_new_active",
  "reativacao_tentativa": 1
}
```

A lista de identificadores removidos pelo provedor simulado contém somente
`sub_original`. A nova recorrência não foi cancelada. A dona recebe sucesso de
cancelamento e o AF anuncia renovação cancelada, embora o estado externo
simulado da nova recorrência permaneça ativo. Permitir nova reativação a partir
desse estado pode ainda abrir outra criação; cobrança duplicada real não foi
executada nem demonstrada neste ensaio.

Essa é uma intercalação de serviços de API, independente da falha de apresentação
QN-01. Não houve normalização artificial dos objetos de assinatura para fazê-la
executar. O harness manteve as transações SQL sequenciais, intercalando apenas
as esperas do provedor; não se trata de prova de locks entre conexões nativas.

**Evidência:** `assinaturaContaService.js`, linhas 516–549;
`assinaturaRepository.js`, linhas 254–288. A proteção de geração adicionada na
reativação não foi aplicada à escrita posterior do cancelamento.

**Correção recomendada:** associar o resultado do cancelamento à recorrência e
geração que foram efetivamente removidas. Uma resposta antiga não pode cancelar
localmente o ciclo novo. Preservar a chamada externa fora da transação e manter
uma recuperação verificável de conflitos, sem induzir repetição contra a nova
recorrência por causa de uma resposta obsoleta.

**Aceitação:** repetir a sequência com webhook antes/depois da resposta, duas
requisições e tentativas de atualização tardia; a recorrência nova conserva
estado e identidade. Cancelamento idempotente do mesmo ciclo continua válido
e uma resposta obsoleta não produz fato financeiro do ciclo seguinte.

Rastreabilidade: RF36; RN21/RN32/RN36; reativação idempotente de `docs/planos.md`.

## QN-03 — Pagamento sem data substitui um período conhecido por 1970

`calcularFimDoPeriodoPago`, linhas 431–451 de `assinaturaContaService.js`,
seleciona o primeiro pagamento `CONFIRMED`, `RECEIVED` ou `RECEIVED_IN_CASH`
antes de exigir uma data válida. Se os dois campos de data estiverem nulos,
chama `calcularProximaCobranca(null)`.

`new Date(null)` representa janeiro de 1970. O cálculo mensal devolve
`1970-02-01`, e o fluxo não chega ao fallback da própria assinatura.

**Reprodução:** assinatura ativa com fim conhecido em `2099-12-01` e um
pagamento `RECEIVED` com `data_pagamento = NULL` e `data_vencimento = NULL`.
O schema aceita essa linha; não houve violação de constraint ou remoção delas.

Após cancelar, o banco passou a guardar `data_proxima_cobranca = 1970-02-01`.
Na consulta seguinte de assinatura/uso, a expiração tornou a assinatura inativa
e aplicou `plano_slug = inicial`. O problema exige dado financeiro incompleto;
não foi atribuído a todo pagamento normal do fluxo atual.

A escolha do pagamento sem validar data e o efeito de `null` já existem antes
de `14955aa`. Esta revisão não os apresenta como regressão introduzida por esse
commit. A correção anterior cobriu ausência de pagamentos e ausência apenas de
data de pagamento com vencimento válido, mas não a ausência das duas datas.

**Correção recomendada:** escolher uma origem temporal válida antes de calcular
o ciclo. Se não existir pagamento com data confiável, considerar o período
persistido na assinatura conforme o contrato; se não houver prova suficiente,
retornar conflito antes de operar o provedor. Não derivar uma data de acesso de
`null` ou inventar o período.

Ao implementar, observar que `pagamentos.data_pagamento` também é `DATE` no
schema, assim como `data_vencimento`; sua semântica civil deve ser coerente com
a normalização financeira, inclusive na documentação.

**Aceitação:** pagamento sem datas não encurta nem amplia o período conhecido;
outro pagamento válido pode ser escolhido; ausência de qualquer evidência gera
erro acionável antes do DELETE externo; casos com pagamento e vencimento válidos
continuam calculando a data correta.

Rastreabilidade: RF36/RF37; RN32; contrato de cancelamento de `docs/planos.md`.

## QN-04 — Chave de idempotência muda conforme o tipo da data

`assinaturaLifecycleService.registrarCancelamentoRenovacao`, linhas 315–351,
concatena diretamente `acessoAte` na chave `RENOVACAO_CANCELADA`.

No cancelamento pela conta, `acessoAte` é uma string civil. No reconhecimento
posterior por webhook, `assinaturaAtualizada.data_proxima_cobranca` é um `Date`
do driver. O service usa esse objeto sem normalizá-lo na chave.

**Reprodução:** cancelar uma assinatura com período futuro e, depois, processar
o webhook de confirmação da remoção da mesma recorrência. O banco registrou
duas linhas `RENOVACAO_CANCELADA`, com chaves distintas:

```text
assinatura:<id>:RENOVACAO_CANCELADA:2099-12-01
assinatura:<id>:RENOVACAO_CANCELADA:Tue Dec 01 2099 00:00:00 GMT-0600 (Central Standard Time)
```

O `ON CONFLICT (chave_idempotencia) DO NOTHING` de `assinaturaEventoRepository`
não deduplica strings diferentes. Além do tipo, a representação passa a depender
do fuso do processo. O ensaio demonstra duplicação do fato, não duas cobranças
ou duplicação quantificada de uma métrica administrativa específica.

**Correção recomendada:** construir a identidade do fato a partir de valores
canônicos e tipos estáveis. Conta e confirmação do provedor precisam reconhecer
o mesmo cancelamento, preservando origem e demais metadados conforme o contrato.

**Aceitação:** conta seguida de webhook, webhook seguido de consulta/repetição e
formatos `Date`/texto do mesmo dia resultam em um fato do mesmo cancelamento;
o fuso de processo não muda a identidade. Não apagar ou reescrever histórico
existente indiscriminadamente para corrigir a deduplicação futura.

Rastreabilidade: RF36; RN21; RNF05/RNF20; ledger de assinatura e `docs/planos.md`.

## Regressão, escopo e limites

| Fluxo | Evidência nesta revisão | Resultado delimitado |
| --- | --- | --- |
| Salvamento da dona, primeira jornada e horários/divulgação | Suítes selecionadas de recuperação e ativação do frontend | Casos existentes passaram; a jornada visual completa não foi executada. |
| Equipe, convite, ativação, inativação e RN50 | Services, APIs com SQL e recuperação da equipe na UI | Casos sequenciais passaram; os dois cenários nativos de locks continuam pendentes. |
| Agenda por período, continuidade na meia-noite e reservas de inativas | Materialização, integrações e recuperação/lifecycle do frontend | Nenhum novo defeito reproduzido nos casos selecionados. |
| Cancelamento/reagendamento de atendimento e snapshots | Regressões existentes de autorização, fuso e persistência | Casos selecionados passaram. |
| Assinatura, renovação, pagamento e histórico | Inspeção entre camadas e quatro ensaios SQL/HTTP adicionais | QN-01 a QN-04. |
| Encerramento e preservação de histórico | Integração de privacidade existente | Casos selecionados passaram. |

Execuções sobre `14955aa`, sem alteração de implementação:

- **248 testes backend em 30 suítes passaram.**
- **93 testes de integração em 17 suítes passaram.** Dois testes que exigem
  conexões PostgreSQL nativas foram explicitamente ignorados pelo harness e não
  entram na contagem de aprovados.
- **79 testes frontend selecionados em sete arquivos passaram.** A suíte
  frontend completa não foi repetida nesta revisão.
- **Quatro ensaios SQL/HTTP** confirmaram formato do DTO, cancelamento obsoleto,
  período em 1970 e fatos duplicados. **Dois ensaios de componente** confirmaram
  a falha com o DTO real e o controle com dias textuais. As asserções reconhecem
  os comportamentos observados; não são testes de correção da suíte regular.
- Os **114 arquivos de migrations** foram aplicados em bancos PGlite isolados.
  O harness da preparação anterior emula a desserialização de `DATE` do parser
  padrão do `pg`; não modifica o código do produto.

As esperas do provedor são simuladas. PGlite tem conexão única; nenhuma
intercalação acima comprova locks entre sessões nativas. Não houve teste com
o Asaas, cobrança real, CI remoto, Playwright/Safari, carga ou alteração em
produção. Não houve push, merge ou deploy. Nenhum novo acesso indevido foi
reproduzido nos casos exercitados; isso não certifica todos os caminhos de RBAC.

## Evidências reproduzíveis

Harness: `audit-harness/owner-flow-fifth-20261022`, ao lado do repo, contendo:

- `OwnerFifth.repro.test.js` e `repro.log`: quatro cenários SQL/HTTP;
- `subscription-api.json`: JSON real da resposta local usado no frontend;
- `OwnerFifthAudit.repro.test.jsx` e `ui-repro.log`: componente e controle;
- `backend.log`, `integration.log` e `frontend.log`: regressões selecionadas.

Para repetir os ensaios, copiar os testes temporários de volta às pastas de
testes indicadas nos imports e usar a configuração PGlite de
`owner-fourth-fixes-20261022`. Eles foram retirados da suíte regular depois da
auditoria. Os passos de reconstrução estão descritos nas seções acima.

Referências lidas: *Agenda Fashion Requisitos v1.17* e *Critérios de Aceitação
v1.2*, anexados à conversa; `AGENTS.md`, contratos de planos, convites, agenda e
encerramento, além do código e das migrations. Esta auditoria é uma revisão
por cenários e contratos, não certificação integral do produto.

## Correções preparadas — 22 de outubro de 2026

Implementação local posterior à auditoria de `14955aa`, sobre a branch
`fix/owner-agenda-recovery`:

| Achado | Correção | Evidência de regressão |
| --- | --- | --- |
| QN-01 | DTO comum aos três endpoints da conta normaliza os campos `DATE` antes do JSON, inclusive pagamentos, upgrade e respostas idempotentes de escrita. A UI trata datas ausentes/incompatíveis sem lançar erro. | Integração HTTP real de controller/service/SQL; contrato compartilhado com o componente; parser `pg` em quatro fusos, preservando `TIMESTAMPTZ`. |
| QN-02 | UPDATE do cancelamento exige a recorrência removida, a tentativa observada e status compatível. Uma continuação obsoleta retorna `409 ASSINATURA_ALTERADA`, sem mudar estado ou ledger. A tela fecha a confirmação e exige GET antes de outra ação. | Webhook antes da resposta e reativação intercalada em `REACTIVATING`/`ACTIVE`; conferência independente de ID e geração; confirmação do mesmo ciclo antes/depois da resposta; recuperação da UI sem repetir DELETE. |
| QN-03 | Escolha de pagamento recebido exige data civil válida. Registro sem datas é ignorado em favor de outro recebido válido ou do fim já persistido; cobrança pendente não comprova período pago. Sem evidência, conflito antes da chamada externa. O cálculo rejeita `null`/texto vazio. | SQL com as duas datas nulas mantém acesso e plano; outro recebimento válido funciona; falta de todas as datas não chama o Asaas. |
| QN-04 | Chave e detalhes usam o dia civil canônico, preservando o formato textual existente e a origem/motivo do primeiro fato. | Conta/webhook nas duas ordens, confirmações repetidas e `Date`/texto do mesmo dia resultam em um registro. |

Validação da implementação:

- **288 testes backend em 34 suítes passaram**, incluindo fronteiras de
  arquitetura, repositories financeiros e regressões anteriores da dona.
- **104 testes de integração em 18 suítes passaram**, aplicando os 114 arquivos
  de migrations em bancos PGlite isolados. **Dois testes de concorrência entre
  conexões nativas continuam ignorados pelo harness** e precisam do PostgreSQL
  do CI; não estão contados como aprovados.
- **797 testes frontend em 118 arquivos passaram**; lint, verificação de arquivos
  sem uso (Knip) e build passaram.
- Os **11 novos casos SQL/HTTP** também passaram em processo
  `TZ=Pacific/Kiritimati`, cobrindo a perda de dia que ocorreria com conversão
  prematura de `DATE` para UTC. Essa repetição não aumenta a contagem dos 104.
- O DTO foi exercitado com o parser instalado do `pg` em processos UTC,
  São Paulo, Los Angeles e Kiritimati. A fixture de contrato de datas é
  conferida pelo GET HTTP real e consumida pelo teste do componente.

Os testes persistentes ficam em `owner-fifth-fixes.integration.test.js`,
`assinatura-conta-dto.test.js`, `assinatura-cancelamento-repository.test.js`,
`SubscriptionDateContract.test.jsx` e nas suítes existentes de calendário,
cancelamento, lifecycle, repositories e recuperação da assinatura.

O runtime local é Node 24; o CI declarado usa Node 22/PostgreSQL 18. As esperas
do Asaas são simuladas, sem cobrança real. O harness não demonstra locks entre
conexões nativas. Não foram executados CI remoto, Playwright/Safari, teste de
carga nem operações em produção. Não houve push, merge ou deploy, alteração
de dependências, migration nova ou reescrita do ledger histórico.
