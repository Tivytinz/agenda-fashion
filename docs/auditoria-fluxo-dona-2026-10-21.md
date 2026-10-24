# Auditoria do fluxo da dona — 21/10/2026

**Base:** `366731cfcfc5cc7ab727099a8303c622441086e7`, `main`, após PR #390.
**Escopo:** revisão funcional de cadastro/ativação, painel e Copilot, publicação,
agenda operacional, equipe, assinatura e encerramento. Inspeção de código,
regressão automatizada e reproduções locais isoladas, sem dados de produção.

## Resultado

Na base auditada, três falhas foram confirmadas na rotina operacional. A primeira
jornada e as proteções recentes não foram reabertas como defeitos sem evidência.
A auditoria original não alterou código de produto ou produção. As correções
locais solicitadas posteriormente estão registradas ao final deste documento.
As evidências abaixo descrevem a base acima, não uma nova regra de produto ou
certificação completa da aplicação.

| ID | Prioridade | Problema confirmado | Efeito para a dona |
| --- | --- | --- | --- |
| FD-01 | P1 | Agenda operacional limitada a hoje e aos seis dias seguintes, sem navegação para outra janela | Reserva passada ainda aberta não aparece para concluir, registrar falta, cancelar ou reagendar; reservas posteriores à janela também ficam fora da agenda |
| FD-02 | P2 | Repetição insegura de bloqueio após falha de atualização; controle de operação pendente cobre só uma chave | Um horário já bloqueado pode ser liberado por um novo clique induzido pela tela desatualizada; operar outro horário reabilita o primeiro ainda pendente |
| FD-03 | P2 | Remoção de profissional considera somente reservas futuras, embora a regra vigente bloqueie qualquer CONFIRMADO | Permite remover vínculo ainda responsável por atendimento passado sem desfecho, mantendo a reserva aberta e retirando o vínculo operacional |

P1 indica prioridade de correção pela interrupção de uma tarefa central da
rotina. P2 indica falha relevante que exige condição específica. Não representam
percentuais de cobertura, vazamento confirmado ou escalada de privilégio.

## FD-01 — Reservas fora da semana não têm caminho de gestão na agenda

**Evidência de código:**

- `src/services/agendaService.js`, `gerarDatasAgenda` e `buscarAgendaGeral`:
  a grade é gerada com sete dias começando na data local atual do negócio.
- `src/services/agendaOperacionalService.js`, `buscarAgendaGeral`:
  a consulta dos compromissos usa exclusivamente o início/fim dessa grade; a
  materialização também percorre apenas seus dias.
- `src/controllers/agendaController.js`, `buscarAgendaGeral`: não recebe data ou
  período para selecionar outra janela.
- `frontend/src/pages/AgendaWorkspacePage.jsx`: as setas percorrem somente os
  dias já recebidos; não carregam semana anterior/posterior. Não há seletor de
  uma data arbitrária ou lista de pendências fora da janela.

**Reprodução com serviços e SQL reais:** com reservas confirmadas de ontem,
daqui a dois dias e daqui a doze dias no mesmo negócio, a resposta trouxe os dias
21–27/10/2026. A reserva do dia 23 apareceu; a de 20/10 e a do dia 02/11 não.
As reservas continuaram persistidas. Essa execução usou fixtures locais; não
foram criadas reservas de clientes reais nem chamadas APIs de produção.

**Impacto:** passar o relógio não encerra automaticamente um atendimento. Uma
dona que deixou para concluir ontem hoje não encontra a reserva nessa tela.
O backend aceita ações operacionais pelo identificador quando autorizado, mas a
jornada da dona não oferece um caminho para localizar esse compromisso. O
encerramento do negócio continua exigindo resolução de reservas abertas; a
limitação da agenda não deve ser contornada encerrando-as automaticamente.

**Correção recomendada:** manter hoje como entrada padrão e permitir navegar
por data/período validado no backend, ou oferecer uma fila explícita de reservas
pendentes fora da janela. A solução precisa manter fuso do negócio, isolamento,
paginação/limites e estados reais. Um horizonte maior fixo não resolve sozinho
reservas de ontem.

**Aceitação mínima:** reserva confirmada de ontem pode ser localizada e receber
um desfecho permitido; reserva futura fora da semana pode ser localizada; mudar
período não altera o estado persistido nem traz dados de outro negócio.

## FD-02 — Atualização falha mantém uma ação de toggle perigosa

**Evidência de código:**

- `frontend/src/pages/AgendaWorkspacePage.jsx`, `toggleSlot`: confirma o POST,
  depois aguarda `load()` no mesmo `try`. Se esse GET falha, mantém a grade antiga
  e limpa `updating` no `finally`.
- O botão é desabilitado apenas quando sua chave coincide com a única string
  `updating`. Clicar em outro slot substitui essa chave e reabilita o anterior.
- `src/services/agendaService.js`, `alternarBloqueioHorario`: o mesmo payload é
  uma alternância. Se houver bloqueio, remove; se não houver, cria. A transação
  protege a integridade, mas não torna dois pedidos iguais a mesma intenção.

**Reproduções de interface:**

1. POST de bloqueio retorna sucesso; GET de atualização falha; a tela volta a
   oferecer `09:00 Livre`. Um segundo clique enviou um segundo POST. O teste que
   exige somente uma mutação até reconciliar a grade falhou: esperado 1, obtido 2.
2. Mantendo o POST de A pendente, iniciar o bloqueio de B tornou A clicável de
   novo. O teste de proteção de A falhou: esperado desabilitado, obtido habilitado.

**Confirmação do comportamento do backend:** dois chamados reais e sequenciais
com a mesma pessoa, negócio, data e hora retornaram `bloqueado` e depois `livre`.
Combinado com a repetição observada na UI, isso confirma o risco de desfazer o
bloqueio. Não foi alegado que uma falha de atualização desfaça o banco sozinha.

**Correção recomendada:** distinguir falha de gravação de falha de atualização;
reconciliar o status confirmado pelo POST, oferecer recuperação por leitura e
impedir repetição contra dado desatualizado. Controlar cada operação pendente
por chave, ou bloquear mutações concorrentes de maneira consistente. Considerar
um contrato de estado desejado/idempotência para proteger também retry de rede,
preservando compatibilidade dos clientes existentes.

**Aceitação mínima:** após POST confirmado/GET falho, repetir atualização só
faz GET e não libera horário; começar B não reabilita A pendente; respostas
fora de ordem não restauram a grade anterior ao último estado confirmado.

## FD-03 — Remoção com CONFIRMADO passado contraria RN45

**Contrato fornecido:** RN45 da Especificação v1.17 e CA-EQP-05 dos Critérios de
Aceitação v1.2 bloqueiam remoção enquanto existir qualquer reserva CONFIRMADA
atribuída à profissional, até resolução por transição válida. A passagem do
horário não substitui conclusão, falta ou cancelamento.

**Evidência de código:**

- `src/repositories/profissionaisRepository.js`, `removerVinculo`: conta estados
  `agendado`/`confirmado`, mas exige que `a.data + a.horario` seja maior que o
  horário atual no fuso do negócio. Reservas de ontem deixam de bloquear.
- `src/services/profissionaisService.js`, `removerProfissional`: usa esse total
  futuro para decidir o conflito e permite a remoção quando ele é zero.
- `docs/confiabilidade-compromissos-agenda.md` também descreve a regra antiga de
  permitir remover com compromisso passado. É uma divergência documental e de
  implementação em relação aos documentos formais anexados, não evidência de
  que o requisito atual foi atendido.

**Reprodução com serviços e SQL reais:** foi criada uma profissional ativa com
reserva de ontem ainda `confirmado`. O service devolveu `Profissional removido
do negócio.`; o vínculo deixou de existir e a reserva permaneceu `confirmado`.
A fixture respeitava a elegibilidade profissional–serviço e as constraints das
migrations. Não foi observado apagamento da reserva ou do histórico de booking.

**Impacto:** retira o vínculo antes de resolver a responsabilidade operacional.
A exceção RN50 para profissional inativa preservada não se aplica a um vínculo
removido. Somada à FD-01, a reserva passada ainda fica fora da agenda da dona.

**Correção recomendada:** bloquear remoção por estado pendente, incluindo
reservas passadas ainda abertas, preservando o lock/transação da checagem.
Orientar a dona a localizar e concluir/cancelar/registrar falta conforme o fato.
Manter inativação como operação distinta de remoção e reconciliar a documentação
legada com RN45; não marcar atendimento como concluído automaticamente.

**Aceitação mínima:** reserva de ontem CONFIRMADA impede remoção; reserva
terminal não impede remoção por esse motivo; corrida com novo booking mantém a
proteção transacional e a dona não pode remover o próprio vínculo.

## Regressão e limites da validação

| Validação nesta auditoria | Resultado |
| --- | --- |
| Suíte frontend normal | 761 testes em 114 arquivos aprovados |
| Backend selecionado: agenda, ativação, painel, growth, Copilot, autorização e RN50 | 141 testes em 13 suítes aprovados |
| Reprodução específica da UI de bloqueios | 2 testes de comportamento seguro falharam, confirmando as duas formas de repetição; executados fora da regressão normal |
| Serviços/repositories reais com PostgreSQL embarcado | Aplicados os 113 arquivos SQL existentes, até a migration 115; confirmadas janela da agenda, remoção com reserva passada e alternância bloqueado → livre |

As reproduções de UI usam APIs simuladas. A confirmação SQL usa PGlite 0.5.10 /
PostgreSQL 18.6 com
adapter de transporte externo ao produto e fixtures isoladas. Não substitui
PostgreSQL servidor nem comprova concorrência entre conexões independentes.
Uma tentativa adicional de exercitar o reagendamento completo nesse adapter
não produziu resultado conclusivo e não foi contada como aprovação ou defeito.

Não houve nova execução de CI, Playwright/Safari ou validação visual de produção.
Não foram auditadas todas as combinações financeiras e de privacidade. Os
resultados positivos não eliminam os achados: as suítes existentes não exercitam
as condições negativas reproduzidas aqui.

As reproduções temporárias foram retiradas da árvore de testes do produto para
não deixar falhas deliberadas na suíte normal. Evidências locais:

- `audit-harness/owner-flow-20261021/sql-repro.cjs` e `sql-results.json`;
- `audit-harness/owner-flow-20261021/OwnerFlowAudit.repro.test.jsx` e `ui-repro.log`;
- `audit-harness/owner-flow-20261021/frontend-regression.log` e `backend-regression.log`.

Para executar a reprodução de UI, copie o arquivo temporariamente para
`frontend/src/pages/`, rode o Vitest apenas nesse arquivo e retire-o depois.
O script SQL aponta para a cópia auditada do repositório. Suas dependências foram
instaladas somente no harness, sem alterar manifests ou lockfiles do AF.

## Ordem recomendada de correção

1. Disponibilizar gestão das reservas passadas/fora da semana (FD-01).
2. Impedir repetição insegura e perda de operação pendente nos bloqueios (FD-02).
3. Alinhar remoção da equipe ao estado CONFIRMADO, com documentação e testes
   proporcionais à regra (FD-03).

As correções precisam ser revisadas e validadas na branch antes de qualquer
publicação. Esta auditoria não autorizou mudança em produção.

## Correções preparadas em 21/10/2026

Branch local: `fix/owner-agenda-recovery`, baseada no mesmo commit auditado.

| Achado | Correção implementada | Cobertura permanente |
| --- | --- | --- |
| FD-01 | Data inicial opcional validada, janela fixa de sete dias, navegação semanal e escolha de data pela dona; consultas antigas canceladas/descartadas | `tests/agenda-owner-recovery.test.js`, `tests/owner-agenda-recovery.integration.test.js`, `frontend/src/pages/AgendaWorkspaceRecovery.test.jsx` |
| FD-02 | Estado desejado booleano nos bloqueios, serialização das escritas da tela e recuperação exclusiva por GET; falha de atualização distingue alteração confirmada de resultado incerto | Mesmos três arquivos, mais regressões existentes de lifecycle/agenda |
| FD-03 | Remoção bloqueada por qualquer `agendado`/`confirmado` do negócio, independentemente da data e de o vínculo estar ativo; orientação e documento especializado alinhados à RN45 | Integração nova cobre reserva passada, vínculo ativo/inativo, três desfechos e isolamento; regressões existentes mantêm reserva futura e proteção da dona |

Durante a preparação, a verificação da RN45 encontrou uma lacuna adicional
(FD-04): `agendaRepository.buscarProfissionaisDoNegocio` excluía integrantes
inativas, de modo que a dona também não encontrava as reservas delas. O teste
de integração com vínculo inativo falhou porque a pessoa não existia na
resposta. Essa evidência foi obtida após a auditoria inicial.

A consulta agora inclui integrantes inativas com reservas não canceladas no
período, usando o instante canônico no fuso atual do negócio. Essas grades
materializam somente reservas próprias existentes; não geram disponibilidade,
ações de bloqueio ou novas opções de responsável inativa. O formulário escolhe
uma profissional ativa habilitada ao reagendar uma reserva da inativa. O teste
de integração verifica também ausência de horários livres, bloqueios e ocupação
externa nessa grade, e a UI cobre a escolha da responsável elegível. As
permissões restritas da própria profissional continuam regidas pela RN50.

O campo `bloqueado` é opcional: clientes antigos sem o campo mantêm toggle.
Essa compatibilidade não transforma os pedidos antigos em idempotentes.
Não há migration nova: as tabelas, constraints e locks existentes são mantidos.

Validação local:

- suíte completa do frontend, lint e build;
- seleção de regressões de backend para agenda, equipe, painel, ativação,
  Copilot, admin e RN50, além do teste de fronteiras arquiteturais;
- testes de integração das rotas e dos repositories com as 113 migrations
  aplicadas em banco PostgreSQL 18.6 via PGlite 0.5.11 e protocolo `pg`.
  Esse ambiente é WASM e usa pool de uma conexão; não comprova concorrência
  nativa, lock entre conexões ou comportamento em produção;
- a instalação dos navegadores do Playwright falhou por download inválido;
  validação visual e E2E em navegador não foram executadas nesta preparação;
- runtime local Node 24.19.0; o CI do projeto permanece em Node 22.

Resultados finais: 771 testes de frontend em 115 arquivos, 188 testes de backend
em 18 suítes e 30 testes de integração em quatro suítes passaram. Lint, build e
`git diff --check` também passaram. CI remoto e PostgreSQL nativo permanecem
pendentes de publicação da branch e execução dos gates habituais.
Não houve push, abertura de PR, merge, deploy ou alteração de dados de produção.
