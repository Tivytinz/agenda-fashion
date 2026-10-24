# Quarta auditoria dos fluxos da dona — 21 de outubro de 2026

**Código auditado:** `099cef9`, branch local `fix/owner-agenda-recovery`.
**Escopo:** primeira jornada, perfil/publicação, serviços, horários, painel,
equipe, agenda consolidada, gestão de reservas, assinatura e encerramento.
Inspeção de código, regressão automatizada e reproduções locais isoladas.
Esta revisão não modifica implementação nem opera dados ou serviços de produção.

**Atualização em 22/10/2026:** os três pontos receberam correções locais após
autorização. As evidências abaixo continuam descrevendo `099cef9`; implementação
e validação posteriores estão registradas na seção final.

As cinco correções da terceira auditoria continuam presentes e suas regressões
passaram. A revisão encontrou um defeito financeiro reproduzido com o formato
real de datas, outro defeito financeiro reproduzido sob uma condição explicitada
abaixo e um risco de deadlock identificado por inspeção. Recomenda-se resolver
os pontos financeiros antes de integrar a branch.

## Resultado priorizado

| ID | Prioridade | Achado | Evidência e limite |
| --- | --- | --- | --- |
| QD-01 | P1 | Datas de assinatura devolvidas como `Date` quebram reativação e preservação do período pago | Reproduzido com SQL real em PGlite; o formato `Date` também foi confirmado diretamente no parser padrão do `pg` instalado. |
| QD-02 | P1 condicional | Reconciliação antiga pode alterar uma tentativa de reativação mais recente | Intercalação reproduzida com SQL real e Asaas simulado, normalizando apenas as datas lidas para isolar QD-01. Não demonstra cobrança real nem concorrência entre conexões nativas. |
| QD-03 | P2 | Ativação e inativação concorrentes adquirem recursos em ordens opostas | Ciclo de espera identificado no código e nas FKs. Não foi reproduzido com duas conexões PostgreSQL neste ambiente. |

P1 indica quebra de operação central ou de uma garantia financeira. P2 indica
falha de disponibilidade sob condição específica. O nível de evidência de cada
achado não deve ser confundido com sua prioridade de correção.

## QD-01 — Contrato de datas da assinatura incompatível com o driver

**Causa:** `assinaturaCalculos.js`, linhas 56–65 e 76–80, usa
`String(valor).slice(0, 10)` e exige `AAAA-MM-DD`. Um objeto `Date` vira texto
como `Tue Dec 01 ...`, que não atende ao formato.

O campo `assinaturas.data_proxima_cobranca` é `DATE`. Os repositories usam
`SELECT *` sem projeção textual, e `src/db/db.js` não configura parser próprio.
O parser padrão do `pg` 8.23.1 instalado devolve um objeto `Date` para OID 1082.
Não se trata de atribuir ao PostgreSQL nativo uma particularidade do PGlite.

Uma chamada direta ao parser instalado confirmou:

```js
const date = require("pg").types.getTypeParser(1082, "text")("2099-12-01");
Object.prototype.toString.call(date); // "[object Date]"
dataValida(date); // null
acessoPagoAindaValido({ ativo: true, data_proxima_cobranca: date }); // false
```

Os controles com o texto `"2099-12-01"` retornaram a data e `true`,
respectivamente. Os dois formatos representam a mesma data de calendário;
o problema é a normalização, não um período realmente vencido.

**Reproduções com services, repositories e SQL reais:**

1. Assinatura `CANCELED`, `ativo = TRUE`, PIX, cliente Asaas e próxima cobrança
   em `2099-12-01`. `reativarMinhaAssinatura` retorna `409` com
   `Não foi possível identificar a próxima data de renovação.`, antes de chamar
   o provedor. O botão recuperável da interface não resolve essa rejeição.
2. Assinatura `ACTIVE`, com acesso até a mesma data futura, recebe
   `SUBSCRIPTION_DELETED`. `acessoPagoAindaValido` retorna falso. O service
   persiste `DELETED`, `ativo = FALSE`, muda o negócio para `inicial` e inativa
   a integrante excedente com `excedente_limite_plano`. O acesso pago não foi
   preservado até a data prevista.
3. Assinatura em `REACTIVATING` há mais de dois minutos é reconciliada. A data
   é rejeitada e o vínculo financeiro volta a `CANCELED` sem executar sequer
   a consulta de recorrência por referência. A recuperação deixa de verificar
   se a operação externa já terminou.

No segundo cenário, o processamento do webhook foi chamado diretamente com
payload simulado. Não houve chamada ao Asaas ou retirada de acesso de uma
cliente real. A reprodução verifica a regra local que processa esse evento.

**Pontos afetados:**

- `assinaturaReativacaoService.js`, linhas 80–100 e 259–268;
- `assinaturaWebhookService.js`, linhas 102–113 e 199–225;
- também existe dependência do mesmo normalizador no fallback de
  `calcularFimDoPeriodoPago`, em `assinaturaContaService.js`.

**Origem:** preexistente na base `366731c`; a terceira correção tratou a
recuperação da interface, sem corrigir esse contrato de dados do backend.
Os testes unitários financeiros selecionados usam datas textuais e não
exercitam o formato devolvido pelo driver nesses caminhos.

**Correção recomendada:** definir um contrato único para datas de calendário
da cobrança e normalizá-las antes das regras financeiras. Preservar o dia civil,
sem aplicar inadvertidamente conversão de fuso de um instante. Avaliar o alcance
de qualquer parser global; uma correção localizada deve cobrir leitura,
recuperação e webhook, não somente o botão de reativar.

**Aceitação:** período válido reativa com a data correta; cancelamento da
renovação mantém acesso até o fim pago; expiração real continua retornando ao
grátis; reconciliação consulta o provedor antes de decidir; testes incluem
datas do parser padrão e contratos textuais, com mais de um fuso de processo.

Rastreabilidade: RF36/RF37; RN21, RN32, RN36 e RN49; contrato de cancelamento
da renovação em `docs/planos.md`.

## QD-02 — Reconciliação não identifica a tentativa que pode modificar

**Condição da reprodução:** as datas devolvidas por duas leituras do repository
foram normalizadas para `AAAA-MM-DD` no harness, sem alterar o produto ou o SQL
de escrita. Isso isola QD-02 do bloqueio de QD-01. O resultado é um defeito
latente do protocolo de reativação, que precisa ser corrigido junto das datas;
não se afirma que o caminho completo com datas `Date` hoje alcance essa sequência.

`buscarReativacaoAbandonada` lê a tentativa antiga sem reivindicar uma geração.
Depois de consultar o provedor, `restaurarCancelamentoReativacao` e
`registrarReativacao` verificam apenas identidade, negócio, `ativo` e status
`REACTIVATING`. Nenhum dos dois UPDATEs verifica `reativacao_tentativa`.
Uma resposta antiga pode, portanto, modificar a nova geração.

**Intercalação reproduzida:**

1. A tentativa 1 está em `REACTIVATING` há mais de dois minutos.
2. A reconciliação A lê essa tentativa e fica aguardando a consulta simulada.
3. A reconciliação B lê a mesma tentativa; sua consulta não encontra recorrência
   e restaura `CANCELED`.
4. Uma nova reativação reserva a tentativa 2 e aguarda a criação externa.
5. A consulta antiga de A termina sem resultado. Seu UPDATE muda a tentativa 2
   para `CANCELED`, embora A tenha consultado a referência da tentativa 1.
6. O provedor simulado retorna `sub_attempt_2`; a finalização local não encontra
   mais `REACTIVATING` e retorna `409`.
7. A retentativa reserva a tentativa 3, recebe `sub_attempt_3` e a grava como
   assinatura ativa.

O ensaio produziu duas referências distintas (`tentativa:2` e `tentativa:3`)
e dois identificadores de recorrência simulados, ficando apenas o último ligado
à assinatura local. Deduplicar pela referência de uma tentativa não deduplica
a seguinte. Isso demonstra o caminho para recorrência externa órfã e possível
duplicação de renovação; nenhuma cobrança real foi executada ou observada.

**Evidência:** `assinaturaRepository.js`, linhas 294–313, 351–378 e 381–410;
`assinaturaReativacaoService.js`, linhas 67–162. Os trechos também são
preexistentes em `366731c`.

**Correção recomendada:** vincular todas as transições à tentativa/geração
observada e conferir essa identidade atomicamente no UPDATE. Uma reconciliação
obsoleta deve produzir no-op, tanto quando a consulta não encontra recorrência
quanto quando encontra uma antiga. Definir a reivindicação da reconciliação sem
manter uma transação de banco aberta durante a chamada de rede.

**Aceitação:** repetir a intercalação acima; atrasar respostas vazias e com
recorrência; confirmar que nenhuma resposta antiga cancela ou finaliza a nova
tentativa; validar também a concorrência em PostgreSQL com conexões distintas.

Rastreabilidade: RN21/RN32; reativação idempotente em `AGENTS.md` e
`docs/planos.md`.

## QD-03 — Ordem de locks da equipe passa a conter um ciclo

**Achado por inspeção, sem reprodução nativa de deadlock.** O registro atômico
dos eventos é correto como requisito; sua interação com os locks precisa ser
ajustada.

- `ativarProfissional` adquire primeiro o advisory lock de capacidade do negócio
  (`profissionaisService.js`, linhas 768–773). No fim insere o evento com
  `actor_user_id` da dona, na mesma transação (linhas 835–838).
- `analytics_eventos.actor_user_id` possui FK imediata para `usuarios.id`
  (migration 064, linha 277). O INSERT precisa validar e proteger a referência
  da conta.
- `inativarProfissional` bloqueia primeiro a linha da conta da dona com
  `FOR UPDATE` e depois tenta o mesmo advisory lock (linhas 895–900;
  `profissionaisRepository.js`, linhas 299–305).

Em duas abas, ativando uma integrante e inativando outra, a ordem permite:

| Transação | Recurso já mantido | Recurso aguardado |
| --- | --- | --- |
| Ativação A | Advisory lock de capacidade | Referência da conta da dona para a FK do evento |
| Inativação B | Linha da conta da dona em `FOR UPDATE` | Advisory lock de capacidade |

O `FOR UPDATE` conflita com a proteção `KEY SHARE` usada pela FK. O ciclo pode
terminar em aborto de uma transação por deadlock. O rollback preserva a
atomicidade, mas uma operação válida da equipe falha. A serialização de cliques
em uma página não serializa abas ou sessões distintas.

**Origem:** o caminho adicional pela FK foi introduzido pelo evento na ativação
em `099cef9`, combinado com a ordem de inativação já existente em `19947a8`.
O teste sequencial de rollback de evento não verifica esse ciclo.

**Correção recomendada:** alinhar a ordem de aquisição de conta, capacidade e
vínculos entre os caminhos envolvidos, incluindo a revalidação da conta da
dona dentro da transação. Manter o evento atômico; retirá-lo da transação ou
ignorar sua falha não resolve corretamente a rastreabilidade.

**Aceitação:** teste com duas conexões PostgreSQL e barreiras entre as etapas
de lock, ativando uma integrante e inativando outra da mesma dona. Ambas devem
concluir ou receber conflito de negócio deliberado, sem deadlock, evento parcial
ou violação de capacidade. Conferir também a ordem com encerramento de conta.

Rastreabilidade: RF44; RN33, RN50 e RN57; política de transações em `AGENTS.md`.

## Regressão dos fluxos e limites

| Fluxo | Evidência nesta revisão | Resultado delimitado |
| --- | --- | --- |
| Cadastro, criação, primeiro serviço, horários e divulgação | Leitura da jornada e suíte frontend completa | Casos existentes passaram; não foi executada uma jornada visual completa no navegador. |
| Perfil, publicação, serviços, fotos, painel e Copilot | Inspeção de pontos de entrada/recuperação e regressão frontend | Nenhum novo defeito reproduzido nesses casos; uploads e envios reais não foram acionados. |
| Convites, aceite, inativação, reativação e remoção | Regressão de services e rotas com SQL | Casos sequenciais passaram; QD-03 requer duas conexões para validação. |
| Agenda por período, reservas de inativas e continuação na meia-noite | Testes de materialização e integrações existentes | Correções anteriores passaram, preservando horários originais e restrições. |
| Cancelamento, reagendamento e estados de atendimento | Testes de autorização, snapshot, fuso e persistência | Casos selecionados passaram; não certifica todos os cruzamentos concorrentes. |
| RN50, isolamento e contexto profissional | Regressões unitárias e SQL existentes | Nenhum acesso indevido novo reproduzido nos casos exercitados. |
| Checkout, assinatura, cancelamento e reativação da renovação | Regressão existente e novas reproduções isoladas | QD-01 e QD-02; a regressão verde não cobre os novos cenários. |
| Encerramento e preservação de histórico | Suíte de integração de privacidade existente | Casos selecionados passaram. |

Resultados executados sobre `099cef9`, sem mudança de implementação:

- **791 testes frontend em 117 arquivos passaram.**
- **215 testes backend em 25 suítes passaram.**
- **78 testes de integração em 13 suítes passaram**, usando os 114 arquivos
  de migrations em bancos PGlite isolados.
- **Quatro reproduções adicionais confirmaram os comportamentos descritos:**
  três de QD-01 e uma de QD-02. Seus asserts reconhecem o defeito observado;
  não são testes de correção nem fazem parte da suíte regular.

O ambiente usa Node 24.19.0, `pg` 8.23.1 e PGlite 0.5.11; o CI usa Node 22.
O adaptador PGlite tem conexão única. A intercalação QD-02 usa esperas no
provedor simulado, mantendo as transações SQL sequenciais; ela não depende de
locks entre conexões. QD-03 não pode ser aprovado ou descartado por esse adapter.

Não foram executados CI remoto, PostgreSQL servidor, ensaio com o Asaas,
Playwright/WebKit/Safari ou testes em produção. Lint, build e código morto
haviam passado na preparação anterior e não foram repetidos para esta mudança
documental. Não houve push, merge ou deploy.

## Evidências locais e referências

Harness de apoio: `audit-harness/owner-flow-fourth-20261021`, ao lado do repo.
Contém a reprodução temporária `OwnerFourth.repro.test.js`, o probe do parser
`pg-date-probe.cjs` e logs de reprodução e regressão. Para repetir a reprodução,
copiar o teste para `tests/owner-fourth-audit.repro.test.js` e usar a configuração
PGlite do harness anterior `owner-flow-recheck-20261021`; retirar o arquivo da
suíte regular depois do ensaio. A sequência e as condições necessárias também
estão descritas neste relatório para permitir sua reconstrução.

Referências formais lidas nos anexos: *Agenda Fashion Requisitos v1.17* e
*Critérios de Aceitação v1.2*. Referências do repo: `AGENTS.md`, `docs/planos.md`,
`docs/convites-profissionais.md`, `docs/ciclo-atendimento.md`,
`docs/confiabilidade-compromissos-agenda.md` e
`docs/encerramento-privacidade.md`. Esta auditoria é evidência por cenários,
não certificação integral do cumprimento dos requisitos.

## Correções preparadas em 22/10/2026

Após autorização, os três pontos receberam implementação local. A tabela
descreve a correção posterior; não reclassifica as evidências originais acima.

| ID | Implementação | Validação e limite |
| --- | --- | --- |
| QD-01 | Normalização financeira aceita texto e `Date` do `pg`, valida o calendário e preserva os campos civis locais. Webhook e reativação usam esse contrato; vencimento usado como fallback do período é normalizado antes de calcular o ciclo. | Parser real em quatro fusos; SQL de reativação, webhook com acesso ainda pago/vencido, fallback de cancelamento e recuperação de recorrência existente. |
| QD-02 | Restaurar e finalizar exigem a `reativacao_tentativa` observada, conferida atomicamente com status e identidade no UPDATE. Contexto inválido preserva `REACTIVATING` e gera aviso seguro. | Respostas antigas vazias e com recorrência não alteram a tentativa seguinte. Esta conclui na versão 2 e repetir a ação não cria outra recorrência. Escrita sem versão válida é recusada. |
| QD-03 | Ativação e inativação seguem `conta → capacidade → vínculos`, com revalidação da conta/dona/negócio. A conta usa `FOR NO KEY UPDATE`, que serializa mudanças de estado sem impedir `KEY SHARE` das FKs de ator/convite. | Regressões de autorização e atomicidade passaram. Dois cenários com conexões nativas foram acrescentados para o CI: ativação/inativação e convite/inativação. Execução nativa continua pendente. |

Não foi necessário alterar o schema: a versão monotônica já existe na migration
107. Nenhuma migration aplicada foi reescrita e o parser global do `pg` foi
preservado. As consultas ao Asaas continuam fora de transações PostgreSQL.
O evento da equipe permanece na mesma transação da transição e falha do evento
continua desfazendo a alteração.

A proteção de versão existe tanto na resposta da criação quanto na recuperação.
Responder sobre uma tentativa antiga produz no-op, em vez de modificar a nova.
Uma data/cliente inválidos não são tratados como prova de ausência de recorrência
externa. A recuperação conserva o estado pendente até uma decisão verificável.

O lock `NO KEY UPDATE` também evita que uma inativação bloqueie a FK do ator
ou do convite enquanto espera por recursos mantidos por outra operação da equipe.
A ordem da ativação foi alinhada, e a consulta do vínculo revalida a dona e o
negócio dentro da mesma transação, inclusive antes de responder idempotentemente.

### Validação local das correções

- **248 testes backend passaram em 30 suítes.** Incluem calendário financeiro,
  reativação, cancelamento, saga Asaas, webhooks, reconciliação, equipe,
  autorização, RN50, agenda e snapshots.
- **93 testes de integração passaram em 17 suítes.** Os dois cenários nativos
  adicionais foram explicitamente ignorados pelo harness embarcado; não entram
  nessa contagem de aprovações. O Jest padrão do CI não usa esse harness e
  executa os dois casos.
- **791 testes frontend passaram em 117 arquivos.**
- Os **114 arquivos de migrations** foram aplicados em bancos PGlite isolados.
  O adaptador desta rodada desserializa `DATE`/OID 1082 pelo parser padrão do
  `pg` instalado: PGlite entrega o dia à meia-noite UTC, enquanto o transporte
  `pg` o reconstrói à meia-noite do fuso do processo. Essa emulação está no
  harness de teste, não no produto. Instantes e as regras de negócio permanecem
  sujeitos aos services/repositories reais.
- O teste de calendário cria processos separados em UTC, São Paulo, Los Angeles
  e Kiritimati. Assim cobre também fuso positivo, em que extrair o dia de um
  `Date` via UTC perderia a data de calendário original.
- `git diff --check` passou. Não houve alteração de frontend ou dependências.

Evidências desta preparação: `audit-harness/owner-fourth-fixes-20261022`, ao lado
do repo, e os testes persistidos em `tests/assinatura-calendario.test.js` e
`tests/owner-fourth-fixes.integration.test.js`, além das regressões existentes
atualizadas. Os testes concorrentes usam barreiras, conexões distintas e
`pg_blocking_pids` para exercer as FKs e a ordem de locks no PostgreSQL servidor.

Continuam pendentes CI completo em Node 22/PostgreSQL nativo, cobertura integral
e ensaio com o provedor. O ambiente local permanece Node 24/PGlite; não foi
declarada aprovação dos dois cenários nativos. A preparação permanece local,
sem push, merge ou deploy.
