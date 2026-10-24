# Segunda auditoria dos fluxos da dona em 21 de outubro de 2026

**Código auditado:** `a5c1d20`, branch local `fix/owner-agenda-recovery`.
**Main conferida por fetch:** `366731c`; as correções locais ainda não estão nessa base.

**Atualização:** os quatro achados receberam correções locais após autorização.
As evidências abaixo descrevem o código auditado; a implementação e a validação
posteriores estão registradas na seção final. Ainda não houve push, CI remoto,
merge ou deploy dessas correções.

Esta revisão encontrou três falhas reproduzidas e uma lacuna funcional diante
do RF44. A primeira falha é uma regressão introduzida nas correções preparadas:
a dona deixa de conseguir reagendar uma reserva quando seu serviço foi
desativado, mesmo mantendo a responsável ativa e um destino válido. Recomenda-se
corrigi-la antes de publicar a branch.

Os problemas de apresentação da ocupação e atualização da equipe já existem
na base anterior. A lacuna de inativação manual também é anterior. Esta revisão
não altera código do produto, permissões, banco de produção ou infraestrutura.

## Resultado por prioridade

| ID | Prioridade | Problema | Impacto |
| --- | --- | --- | --- |
| RD-01 | P1 | Reagendamento bloqueado na tela após desativar o serviço da reserva | Uma tarefa válida fica impossível pela interface; regressão na branch preparada |
| RD-02 | P2 | Grade exibe como livre um horário coberto pela duração de um atendimento | A dona recebe uma leitura incorreta da ocupação e encontra erro ao tentar bloquear o horário |
| RD-03 | P2 | Equipe volta a mostrar profissional aguardando vaga após ativação confirmada | Resposta antiga ou falha de leitura faz a tela contradizer o estado persistido |
| RD-04 | P2 | Falta caminho manual de inativação preservando vínculo e reservas | A dona dispõe de remoção e ativação, mas não da ação de pausa prevista no RF44 |

P1 indica interrupção de uma tarefa central em condição válida. P2 indica falha
de consistência ou capacidade administrativa relevante. A prioridade não é uma
classificação de vazamento de dados ou de escalada de privilégio.

## RD-01 Reagendamento de reserva com serviço desativado

**Cenário reproduzido:** uma reserva confirmada mantém responsável ativa,
serviço, preço e duração originais. A dona desativa o serviço no catálogo para
impedir novas reservas e tenta mover esse compromisso para outro horário válido.

**Evidência:**

- `agendaRepository.buscarProfissionaisDoNegocio` monta `servico_ids` apenas
  para serviços ativos no catálogo.
- `AgendaWorkspacePage.getRescheduleProfessionals`, linhas 35–37, filtra a
  responsável atual pela mesma lista usada para serviços ativos.
- `openReschedule`, linhas 435–438, deixa o identificador de responsável vazio
  quando o serviço desativado não aparece nessa lista.
- A confirmação depende desse identificador e fica desabilitada. O formulário
  ainda afirma que não há profissional habilitada, embora a reserva continue
  atribuída a uma profissional ativa e sua relação com o serviço tenha sido mantida.

O serviço de reagendamento já distingue manter a responsável de transferir a
reserva: no primeiro caso consulta o vínculo ativo; no segundo valida a
elegibilidade da nova responsável (`agendamentoReagendamentoService`, linhas
340–365).

**Reprodução com SQL e serviço reais:** após desativar o serviço, a Agenda Geral
retornou `servico_ids: []` e `pode_reagendar: true` para a reserva. A chamada de
reagendamento para a mesma responsável e um novo slot retornou sucesso. A
persistência manteve `confirmado`, nome original, preço de R$ 75,00 e duração
de 90 minutos, alterando somente data/horário e registrando o histórico.

**Controle de regressão:** o mesmo DTO e os mesmos novos campos de data/hora
mantiveram a confirmação habilitada no componente da base `366731c`; o teste
falhou em `a5c1d20` porque a confirmação ficou desabilitada.

**Correção recomendada:** preservar a responsável atual ativa como opção de
gestão da reserva existente, diferenciando essa operação de uma transferência.
Alinhar as opções ao contrato do backend e manter elegibilidade para novas
responsáveis. Desativar um serviço não deve exigir sua republicação para gerir
uma reserva válida já assumida.

**Aceitação:** desativar o serviço não impede reagendar o compromisso com a
mesma responsável ativa; snapshots são preservados; responsável inativa não
volta a ser opção; transferência continua exigindo destino ativo e elegível.

Rastreabilidade: RN04, RN11, RN46; CA-AG-17 e CA-AG-20.

## RD-02 Duração do atendimento não ocupa a grade inteira

**Cenário reproduzido:** reserva confirmada das 09:30 às 11:00, com snapshot
de 90 minutos, sobre uma grade operacional de 60 minutos.

A resposta real da Agenda Geral materializou a reserva às 09:30, mas manteve
10:00 com `status: livre`. O frontend apresentou um botão habilitado “10:00
Livre”. Ao tentar bloqueá-lo, o backend rejeitou a operação com `400` e a
mensagem “Horário já está agendado.”

**Causa:** `agendaOperacionalService.materializarAgendaGeral`, linhas 173–190,
insere a reserva apenas pela chave de início. Não ocupa os demais pontos
cobertos por sua duração, nem preserva duração nessa projeção. A grade base
permanece com pontos livres dentro do compromisso. A rotina profissional tem
materialização semelhante por início.

**Limite do achado:** o bloqueio indevido foi recusado pelo backend. A reprodução
comprova a divergência visual, não uma dupla reserva criada com sucesso.

**Correção recomendada:** representar a cobertura real do intervalo na resposta
operacional e na interface, usando duração preservada e instante canônico.
Manter redigida a ocupação de outro negócio. O fim exclusivo às 11:00 pode ficar
livre se não existir outra restrição; 10:00 não pode ser oferecido como livre.

**Aceitação:** reservas com início fora da grade e durações maiores que o passo
visual ocupam os pontos intermediários; o instante final exclusivo não bloqueia
um horário adjacente válido; cancelamento libera a cobertura pertinente.

Rastreabilidade: RN06, RN07 e RN38; CA-AG-01 e CA-AG-22.

## RD-03 Equipe desatualizada após ativação

Foram reproduzidas duas condições em `ProfessionalsPage`:

1. Ativar Ana inicia uma leitura da lista. Ativar Bia inicia outra, que retorna
   primeiro com ambas ativas. Quando a leitura antiga termina, a tela volta a
   mostrar Bia aguardando vaga e oferece novamente “Ativar profissional”.
2. O POST confirma `{ profissional_id: 2, ativo: true }`, mas o GET seguinte
   falha. A tela conserva a linha inativa e a ação de ativação, simultaneamente
   à mensagem de sucesso.

**Causa:** `load`, linhas 32–60, aceita respostas sem validar a geração da
leitura. `activateProfessional`, linhas 109–127, usa a mensagem do POST, mas
descarta seu estado canônico e chama uma leitura sem acompanhá-la.

**Limite do achado:** a regressão observada é na interface. O serviço de ativação
permanece idempotente para uma profissional já ativa e mantém as validações de
capacidade e contexto. Não se demonstrou consumo duplicado de vagas.

**Correção recomendada:** descartar leituras antigas, cancelar leituras ao sair,
adotar o estado confirmado de ativação e oferecer recuperação por consulta
quando a atualização falhar. A atualização de contexto de plano deve pertencer
à mesma geração da lista de equipe.

**Aceitação:** respostas fora de ordem não revertem ativações na tela; uma falha
de consulta não comunica que uma ativação confirmada foi desfeita; recuperação
da lista não exige repetir uma mutação.

Rastreabilidade: RF44, RF49; RNF19 e RNF26.

## RD-04 Inativação manual sem caminho operacional

Esta é uma lacuna funcional identificada por inspeção da jornada e das rotas,
distinta dos três defeitos reproduzidos em execução.

O RF44 prevê gestão pela dona com convite, ativação, inativação, configuração e
remoção. A RN50 diferencia vínculo inativo preservado de vínculo removido.

Na implementação atual:

- a tela da equipe oferece configurar serviços/horários, remover e ativar os
  vínculos inativos por motivo de plano;
- `profissionaisRoutes` não oferece ação de inativação à dona;
- a edição existente recebe nome e WhatsApp, sem alterar o estado do vínculo;
- a inativação de integrantes existentes ocorre pela reconciliação automática
  de excedentes do plano em `equipePlanoService`.

Assim, a dona não dispõe de uma ação de estado para interromper novas reservas
de uma integrante, preservar seu vínculo e aplicar o acesso restrito da RN50.
Fechar horários altera disponibilidade, mas mantém o vínculo ativo e suas
permissões; não completa a semântica de inativação exigida pelo requisito.

**Correção recomendada:** disponibilizar operação explícita autorizada à dona,
com motivo persistido, proteção contra inativar a titular, preservação de
reservas e alinhamento da reativação e da RN50 ao novo motivo. A inclusão de
motivos/permissões deve ser deliberada; não ampliar silenciosamente a exceção
restrita para motivos desconhecidos.

**Aceitação:** somente a dona do negócio pode inativar uma integrante; a titular
continua ativa; a profissional deixa de receber novas reservas e de consumir
vaga, preservando reservas e somente o acesso restrito permitido. Reativação
revalida capacidade e conflito de vínculo ativo em outro negócio.

## Cobertura e limites

| Fluxo | Verificação nesta revisão | Resultado delimitado |
| --- | --- | --- |
| Cadastro, criação, primeiro serviço, horários e divulgação | Leitura da jornada e regressão frontend de ativação/recuperação | Nenhuma falha nova nos casos exercitados |
| Perfil, publicação, serviços, fotos e matriz da equipe | Regressão frontend e leitura dos contratos | RD-01 aparece no efeito posterior sobre uma reserva existente |
| Agenda, períodos e gestão de reservas de inativas | Regressões da branch e reprodução SQL da agenda | RD-01 e RD-02 |
| Cancelamento e reagendamento operacional | 12 testes existentes de rotas/persistência com SQL real em PGlite | Casos exercitados passaram; bloqueio RD-01 ocorre no frontend |
| Convite, ativação e remoção da equipe | Testes existentes, duas reproduções de UI e inspeção de rotas | RD-03 e lacuna RD-04 |
| Checkout, assinatura, cancelamento e reativação da renovação | 45 testes de backend selecionados e testes frontend da suíte completa | Nenhuma falha nova nos casos exercitados; provedor externo não foi acionado |
| Encerramento e preservação de histórico | Cinco testes existentes de integração em PGlite | Casos exercitados passaram |

Resultados:

- **771 testes frontend existentes passaram**, em 115 arquivos.
- **256 testes backend selecionados passaram**, em 25 suítes: 211 da primeira
  seleção e 45 de cobrança/assinatura.
- **17 testes de integração passaram**, em três suítes, usando PostgreSQL
  18.6 via PGlite 0.5.11 e as 113 migrations. Os 12 casos de cancelamento e
  reagendamento inicialmente encontraram `ECONNREFUSED` na ausência de PostgreSQL
  nativo; somente essas duas suítes foram reexecutadas no ambiente PGlite.
- A reprodução de UI teve **quatro falhas de asserção esperadas**, referentes
  aos três defeitos, e **um controle aprovado** com o componente anterior.
  Esses testes temporários foram retirados do diretório da suíte regular.
- A reprodução SQL adicional confirmou o horário livre incorreto, a rejeição
  correta do bloqueio e o reagendamento válido do serviço desativado com
  preservação dos snapshots.

PGlite foi usado com adaptador de conexão única e transações sequenciais.
Isso não verifica concorrência nativa, locks entre conexões ou o driver `pg`
nessas suítes. A UI foi exercitada por Vitest/jsdom; não houve execução visual
em Safari/Playwright, CI remoto ou testes em produção. Runtime local Node 24;
o projeto mantém Node 22 como runtime de CI. Esta é uma auditoria por cenários,
não certificação integral dos requisitos.

## Evidências reproduzíveis

Harness local: `audit-harness/owner-flow-recheck-20261021`, ao lado do repositório.

- `sql-recheck.cjs`, `sql-results.json` e `sql-recheck.log`;
- `hidden-service-dto.json` e `long-booking-dto.json`, retornos reais usados na UI;
- `OwnerRecheck.repro.test.jsx` e `ui-repro.log`;
- `pglite-jest-environment.cjs`, `pglite-jest-setup.cjs` e `pglite-jest.config.cjs`;
- logs `frontend-regression`, `backend-regression`, `backend-db-retry`,
  `billing-regression` e `closure-regression`.

Documentos de referência: *Agenda Fashion Requisitos v1.17* e *Critérios de
Aceitação v1.2*, anexados à conversa, além de `AGENTS.md` e dos contratos
especializados do repositório. As referências acima usam identificadores
verificados nos anexos, sem inferir números de página.


## Correções locais preparadas após esta auditoria

| Achado | Comportamento corrigido | Evidência de regressão |
| --- | --- | --- |
| RD-01 | A profissional atual ativa permanece na seleção de reagendamento mesmo sem o serviço no catálogo ativo. Transferências continuam limitadas a profissionais ativas habilitadas. | Interface confirma PATCH com a mesma responsável; teste SQL reagenda serviço desativado preservando nome, valor e duração originais. |
| RD-02 | Toda a duração ativa ocupa a grade, com fim exclusivo e pontos intermediários sem ações. Consultas consideram intervalos que começaram antes da janela, no fuso consultado. | Testes de ambas as agendas, snapshots, virada de dia, ocupação externa, privacidade, encerramento/cancelamento e proteção do POST de bloqueio. |
| RD-03 | Leituras da equipe e da oferta auxiliar são canceláveis e vinculadas à geração atual. Escritas são serializadas até a reconciliação. Resposta confirmada atualiza o cartão mesmo se o GET falhar. | Respostas fora de ordem, leitura falha após sucesso, recuperação apenas por GET, escrita incerta, saída durante escrita e isolamento do editor de serviços. |
| RD-04 | A dona pode confirmar a inativação manual preservando vínculo, serviços, configuração e reservas. O vínculo inativo mantém somente a RN50, com conta e negócio ativos. | API valida proprietária, auto-inativação, outro negócio, identidade inválida, idempotência, preservação, ausência de novas reservas, capacidade, reativação e convite antigo. |

A migration nova `116_profissional_inativacao_manual.sql` acrescenta
`inativado_pela_dona` à constraint. A API `POST /profissionais/:id/inativar`
revalida a conta da dona antes dos locks de capacidade e vínculos; não muda
status nem responsável de reservas. `POST /profissionais/:id/ativar` admite
reativação manual sob os mesmos limites existentes. O aceite de convite
pendente não permite contornar a pausa da dona. A documentação canônica foi
atualizada em `AGENTS.md`, `convites-profissionais.md`, `ciclo-atendimento.md` e
`confiabilidade-compromissos-agenda.md`.

### Validação local das correções

- Frontend completo: **781 testes em 116 arquivos passaram**. Após um ajuste
  final no envio de convite, os **22 testes de equipe** foram repetidos e passaram.
- Backend selecionado sem banco: **198 testes em 26 suítes passaram**, incluindo
  permissões, revalidação na transação, ocupação, lifecycle, sessão e migrations.
- Integrações com SQL e rotas: **67 testes em 12 suítes passaram**, incluindo
  os quatro achados, RN50, convite/ativação, serviços, horários, cancelamento,
  reagendamento e encerramento/privacidade.
- Os **114 arquivos de migrations**, incluindo a 116, foram executados em bancos
  isolados PGlite. O adaptador converte datas do contexto do Jest para ISO antes
  de entregá-las ao engine; isso corrigiu uma incompatibilidade do harness no
  teste de criação de convite, sem alterar o produto.
- Lint, build e verificação de código morto do frontend passaram.

As duas suítes de cancelamento/reagendamento que precisam de banco foram
inicialmente chamadas sem PostgreSQL e retornaram `ECONNREFUSED`; foram
reexecutadas no harness SQL e os 12 casos passaram. As contagens acima usam
somente as execuções finais bem-sucedidas, sem somar repetições.

Este ambiente usa Node 24, enquanto o CI usa Node 22. PGlite executa SQL
PostgreSQL em WASM com conexão única; estes resultados não comprovam
concorrência entre sessões nativas. CI completo com PostgreSQL, coverage,
audits e Playwright Chromium/WebKit continuam necessários antes da integração.
A instalação local dos navegadores já estava indisponível por falha no download;
nenhum smoke visual ou Safari foi declarado aprovado.
