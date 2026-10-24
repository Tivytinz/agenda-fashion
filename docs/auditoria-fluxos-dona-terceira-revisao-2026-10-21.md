# Terceira auditoria dos fluxos da dona — 21 de outubro de 2026

**Código auditado:** `19947a8`, branch local `fix/owner-agenda-recovery`.
**Main conferida por fetch:** `366731cfcfc5cc7ab727099a8303c622441086e7`.
As correções preparadas permanecem locais. Esta auditoria registra evidências;
não altera implementação, permissões de produção ou infraestrutura do AF.

**Atualização após a auditoria:** os cinco achados receberam correções locais
após autorização. As evidências originais abaixo se referem a `19947a8`;
a implementação posterior e a validação estão registradas na seção final.

A revisão encontrou **três falhas funcionais P2** e **duas pendências P3**.
Os testes dos quatro achados anteriores passaram. Os novos cenários abaixo
não estavam cobertos por essas regressões. Não houve reprodução de cobrança
duplicada nem de acesso indevido nos casos executados; isso não equivale a
uma certificação de todos os caminhos de segurança e concorrência.

## Resultado priorizado

| ID | Prioridade | Achado | Condição e efeito |
| --- | --- | --- | --- |
| TD-01 | P2 | Assinatura perde consistência após uma alteração confirmada | Falha ou demora do GET deixa a tela com status e ação antigos, permitindo repetir a operação. |
| TD-02 | P2 | Novo convite para profissional inativada já nasce impossível de aceitar | A dona recebe confirmação do convite, mas a destinatária recebe conflito porque o vínculo continua pausado manualmente. |
| TD-03 | P2 | Reserva de inativa que atravessa a meia-noite desaparece do dia seguinte | O período contém parte da reserva, mas a integrante é excluída da consulta porque o início ficou no dia anterior. |
| TD-04 | P3 | Faltam eventos de inativação e reativação da equipe | As transições acontecem sem os fatos de negócio com ator previstos pelo contrato de analytics. |
| TD-05 | P3 | Reagendamento pode rejeitar um horário válido após correção de fuso | A validação de alteração compara data/hora locais antigas em vez dos instantes canônicos. Cenário condicional, sem editor de fuso identificado na tela atual. |

P2 indica tarefa operacional prejudicada ou apresentação contraditória com o
estado persistido. P3 indica rastreabilidade ausente ou condição específica de
manutenção de dados. Não foi identificado novo achado P0/P1 nesta revisão.

## TD-01 — Assinatura com estado antigo depois de escrita confirmada

**Reprodução em componente real com jsdom e API controlada:**

1. GET apresenta assinatura `ACTIVE`.
2. DELETE confirma cancelamento da renovação.
3. O GET posterior falha.
4. A tela exibe a mensagem de cancelamento confirmado e, simultaneamente,
   conserva o botão habilitado `Cancelar renovação`.
5. Não oferece recuperação da leitura quando já havia dados carregados.

Outro teste começa com `CANCELED`, confirma a reativação e mantém o GET pendente.
O botão `Reativar renovação` fica novamente habilitado antes de a reconciliação
terminar. Os dois testes que expressam o comportamento esperado falharam;
o controle de leitura inicial de `CANCELED` passou.

**Causa:** `SubscriptionPage.jsx`, funções `load`, `cancel` e `reactivate`.
A escrita atualiza a mensagem, mas ignora o estado canônico retornado, chama
uma leitura sem aguardá-la e libera a ação no `finally`. A leitura também não
possui geração/cancelamento. O arquivo é idêntico ao da main conferida;
o problema não foi introduzido pelo commit de correções da equipe.

**Impacto:** a dona pode interpretar que a assinatura não mudou e repetir uma
ação financeira. Os testes do backend de billing passaram e o contrato de
reativação mantém proteção idempotente; esta auditoria não demonstrou cobrança
extra. O achado é de consistência e recuperação da interface.

**Direção de correção:** adotar o resultado confirmado da escrita, serializar
as ações até reconciliar, invalidar leituras antigas e disponibilizar recuperação
por GET após leitura falha ou escrita incerta, no mesmo padrão de agenda/equipe.

**Referências:** RF36 e contrato canônico em `docs/planos.md`.

## TD-02 — Convite novo para vínculo pausado é confirmado, mas não aceitável

**Reprodução com services e SQL reais em banco isolado:**

1. Profissional registrada pertence ao negócio e é inativada pela dona.
2. A dona envia um novo convite para o mesmo e-mail.
3. `criarConviteProfissional` cria convite `pendente` e retorna sucesso.
   O controller desse caminho responde HTTP 201.
4. A profissional tenta aceitar esse novo convite, ainda válido.
5. O aceite retorna 409: a reativação deve ser feita pela dona na equipe.
6. O convite permanece `pendente`, sem produzir o vínculo ativo prometido.

**Causa:** a criação rejeita vínculo já ativo e vínculo aguardando vaga,
mas não trata `inativado_pela_dona`. O aceite protege corretamente a pausa
contra convites antigos; essa proteção também impede aceitar o convite novo
que o próprio fluxo acabou de permitir criar.

**Impacto:** as duas pessoas recebem orientações incompatíveis. Não houve
bypass da inativação: o guard de aceite funcionou. A falha fica na criação
de um convite que não pode cumprir sua finalidade.

**Direção de correção:** no envio, identificar o vínculo preservado e orientar
a dona a usar `Ativar profissional`, antes de persistir outro convite.
Manter o bloqueio de aceite de convites antigos durante a pausa e os guards
de capacidade/conta/negócio na ativação. Caso o produto queira que um convite
novo também autorize reativação, essa intenção precisa ser explícita e distinta
da autorização histórica de um convite antigo.

**Referências:** RF44, RF49, RN50, CA-EQP-02 e `docs/convites-profissionais.md`.

## TD-03 — Ocupação que atravessa a meia-noite some após inativação

**Reprodução com services e SQL reais:** reserva confirmada em 23/10, 23:30,
com duração congelada de 120 minutos no fuso de São Paulo.

| Consulta de 24/10 | Resultado observado |
| --- | --- |
| Profissional ativa | 00:00 e 01:00 ocupados; 02:00 livre. |
| Mesma profissional após inativação manual | A integrante deixa de aparecer no período. |
| Consulta iniciada em 23/10, após a inativação | O cartão de 23:30 aparece com a reserva preservada e ações da dona. |

**Causa:** `agendaRepository.buscarProfissionaisDoNegocio` seleciona inativas
somente quando o início local do booking está entre as datas consultadas.
A consulta de intervalos passou a considerar sobreposição, mas o seletor de
integrantes ainda usa apenas a data inicial. Além disso, a materialização da
inativa usa grade vazia e insere cartões apenas na data de início; corrigir
somente o seletor não resolve a representação da continuação no dia seguinte.

**Impacto:** o período consultado esconde um compromisso ainda válido de uma
integrante inativa. A reserva não foi apagada nem cancelada; a dona consegue
encontrá-la voltando ao dia de início. A reprodução usa uma reserva persistida
que atravessa o dia; não comprova que o fluxo público atual oferece a criação
de serviços atravessando a meia-noite.

**Direção de correção:** selecionar por sobreposição e representar a continuação
de reservas próprias da inativa no período, conservando data/hora originais,
identidade e ações da reserva. Não gerar disponibilidade nem ocupações externas
com dados redigidos para a inativa.

**Referências:** RF16, RF51, RN45, RN50 e `docs/confiabilidade-compromissos-agenda.md`.

## TD-04 — Transições da equipe sem os eventos de negócio previstos

A inativação manual foi executada e seguida por reativação válida, com vaga
no plano. O vínculo chegou aos estados esperados. A consulta dos eventos
`business_professional_deactivated` e `business_professional_reactivated`
para o negócio devolveu lista vazia.

Os services de ativação/inativação não emitem esses eventos e não há emissor
desses nomes no código examinado. O motivo e `updated_at` do vínculo existem;
o evento histórico com ator e instante da transição não é registrado.
Isso não equivale a falta de todo o histórico do sistema nem a falha no ledger
administrativo global, que tem outro escopo.

**Direção de correção:** emitir fatos de backend na mesma transação da mudança,
com negócio, profissional, ator e motivo aplicável. Repetições idempotentes
não devem gerar um novo fato de transição. Para downgrade automático, usar
`SYSTEM`, sem inventar um usuário.

**Referências:** RF38, RN33 e seção de eventos padronizados dos Requisitos v1.17.

## TD-05 — Alteração de fuso e comparação incorreta de reagendamento

**Cenário condicional reproduzido:** uma reserva é criada para 09:00 em São
Paulo, com início canônico 12:00Z. O fuso cadastrado é corrigido para Manaus.
A agenda passa corretamente a apresentar o compromisso às 08:00.

- Mover para 09:00 em Manaus corresponderia a 13:00Z, uma hora depois.
- O backend rejeita com HTTP 400, pedindo que se escolha um novo horário.
- Mover para 10:00 em Manaus passa, como controle do cenário.

**Causa:** `agendamentoReagendamentoService.reagendarOperacional` compara
`novaData/novoHorario` a `a.data/a.horario`, que continuam sendo valores locais
da criação anterior, embora o novo destino já tenha sido resolvido no fuso
atual. O guard é idêntico ao da main conferida.

**Limite de aplicabilidade:** a reprodução alterou o fuso diretamente no banco
isolado. Não foi identificado um editor de fuso na tela atual da dona.
O achado se aplica a correção operacional/migração do cadastro, e não comprova
um caminho comum que a dona consiga acionar pela interface de hoje.

**Direção de correção:** comparar responsável e instantes canônicos, mantendo
os snapshots e os horários históricos com seu contexto de fuso.

**Referências:** RF26, RF53, RN11 e RN54. CA-AG-20 reforça a preservação dos snapshots
no reagendamento; não há um critério específico para essa troca de fuso nos
casos examinados.

## Regressão e alcance da validação

| Verificação executada nesta revisão | Resultado |
| --- | --- |
| Frontend completo | 781 testes, 116 arquivos, passaram. |
| Backend selecionado: agenda, equipe, sessão e lifecycle | 141 testes, 14 suítes, passaram. |
| Backend selecionado: billing/idempotência | 45 testes, 5 suítes, passaram. |
| Integrações de SQL e rotas | 67 testes, 12 suítes, passaram. |
| Novas reproduções de UI para TD-01 | 2 falhas esperadas contra os requisitos de recuperação; 1 controle passou. |
| Novas reproduções de SQL | TD-02, TD-03, TD-04 e TD-05 confirmados em fixtures isoladas. |
| Lint e build | Passaram. |

A soma de regressões backend/integração é **253**, sem somar repetições ou
contar as reproduções dos defeitos como aprovações. As 114 migrations,
incluindo a 116, foram executadas nos bancos isolados do harness.

Os controles dos quatro achados anteriores verificaram reagendamento com
serviço desativado, ocupação por duração, recuperação da equipe, inativação
manual, capacidade e RN50. Os casos de autorização cobriram auto-inativação,
outro negócio, profissional sem vínculo de dona, reserva de outra responsável,
conta desativada, negócio arquivado e vínculo removido/recriado.

Perfil/publicação, serviços, configurações, onboarding e demais telas entraram
na regressão completa do frontend. Esta foi uma revisão dirigida dos contratos
e dos cenários acima, não uma execução visual ponta a ponta de todas as telas.

## Limites e evidências

- Código examinado/testado localmente, sem alteração no produto durante a auditoria.
- Ambiente Node 24; CI configurado com Node 22 e PostgreSQL 18.
- SQL real executado em PGlite/PostgreSQL WASM com conexão única; concorrência
  entre sessões nativas não foi validada.
- A tentativa de iniciar PostgreSQL nativo local esbarrou na restrição do
  ambiente: `runuser: cannot set groups: Operation not permitted`.
- Testes de componentes usaram jsdom. Smoke visual e Playwright Chromium/WebKit,
  incluindo Safari, permanecem pendentes. Nenhum deles foi declarado aprovado.
- CI remoto, coverage global e audits de dependências não foram executados nesta revisão.

Os dois DOCX anexados foram relidos diretamente das cópias locais:
*Agenda Fashion Critérios de Aceitação v1.2* e *Agenda Fashion Requisitos v1.17*.
As decisões de RN50 e inativação foram cruzadas com `AGENTS.md` e os documentos
canônicos do repositório.

Reproduções e logs locais ficam em
`/workspace/scratch/7eae87c29875/audit-harness/owner-flow-third-20261021`:
`sql-audit.cjs`, `sql-results.json`, `sql-audit.log`,
`OwnerFlowThird.repro.test.jsx`, `ui-repro.log`, `frontend-regression.log`,
`backend-regression.log`, `billing-regression.log`, `sql-regression.log`,
`lint.log` e `build.log`. O arquivo de UI foi removido da árvore do produto
após a reprodução; somente este relatório e seu índice integram a auditoria.


## Correções locais preparadas após esta revisão

| Achado | Correção implementada | Validação específica |
| --- | --- | --- |
| TD-01 | A tela adota a assinatura canônica retornada, serializa operações e atualização, invalida leituras antigas e oferece GET de recuperação. `REACTIVATING` aparece como processamento e permite consultar novamente. | Cancelamento/reativação confirmados com GET falho; clique duplicado; operação inversa durante reconciliação; leitura antiga; escrita incerta; conflito de reativação; saída durante escrita. |
| TD-02 | Novo convite para vínculo inativo por pausa manual ou downgrade é recusado antes de persistir, orientando usar `Ativar profissional`. O bloqueio de aceite de convites antigos foi preservado. | API devolve 409, nenhum convite é criado e o vínculo não muda; ativação explícita continua possível quando há capacidade. |
| TD-03 | O seletor de integrantes usa sobreposição. Reservas próprias ativas são projetadas nos dias seguintes como continuação, preservando data/hora originais e ações. | Agendas ativa/inativa, fim exclusivo, ausência de grade livre para inativa, privacidade de ocupações externas e formulário de reagendamento usando início original. |
| TD-04 | Eventos de inativação/reativação são gravados na mesma transação, com ator efetivo e motivo aplicável. Downgrade usa SYSTEM; repetição sem mudança não emite outro fato. | OWNER e PROFESSIONAL reais, SYSTEM sem usuário inventado, pedidos idempotentes, reservas preservadas e rollback de inativação/ativação quando o evento falha. |
| TD-05 | O guard de alteração compara responsável e instantes canônicos. | O mesmo instante sob outro horário local é recusado; horário local antigo que representa novo instante é aceito, mantendo preço, duração, nome e histórico. |

A continuidade usa `continuacao`, `data_agendamento` e `hora_agendamento` no DTO.
O cartão de `00:00` identifica explicitamente que o atendimento começou em outra
data; abrir o reagendamento usa o início original. A projeção não muda o booking.
O seletor e as consultas de reservas compartilham a regra de sobreposição e o
fim exclusivo. Ocupações externas permanecem redigidas e não viram cartões de
continuação com dados ou ações de outra reserva.

`equipeAnalyticsService` reutiliza a persistência de `analytics_eventos` com o
executor transacional da mudança. Falha ao registrar o evento reverte o estado
da equipe. A whitelist de telemetria do navegador permanece restrita; esses são
fatos emitidos pelo backend, sem dados de contato. Não há emissão retroativa
para estados históricos nem nova migration: o esquema atual já comporta os fatos.

Foram atualizados os contratos em `AGENTS.md`, `docs/planos.md`,
`docs/convites-profissionais.md`, `docs/ciclo-atendimento.md` e
`docs/confiabilidade-compromissos-agenda.md`.

### Verificações finais desta preparação

- **Frontend:** 791 testes em 117 arquivos passaram.
- **Backend selecionado:** 215 testes em 25 suítes passaram.
- **Integração com SQL/rotas:** 78 testes em 13 suítes passaram, incluindo
  11 casos novos de correção dos achados. Total backend/integração: **293**.
- **Lint, build e verificação de código morto:** passaram.
- As 114 migrations, incluindo a 116 já preparada, foram executadas nos bancos
  isolados PGlite. Os anexos de requisitos e critérios foram relidos.

A validação continua local, com Node 24 e PostgreSQL WASM/PGlite de conexão
única. CI com Node 22/PostgreSQL 18, concorrência nativa, coverage global,
audits de dependências e smoke visual Chromium/WebKit/Safari permanecem
pendentes. Nenhum push, merge, deploy ou alteração de produção integra
esta preparação.
