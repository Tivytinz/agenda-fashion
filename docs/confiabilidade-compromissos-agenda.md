# Confiabilidade dos compromissos da agenda

> **Papel documental:** documento especializado de preservação operacional de compromissos existentes. O lifecycle e suas transições são definidos em [`ciclo-atendimento.md`](./ciclo-atendimento.md); este arquivo cobre efeitos de mudanças administrativas, materialização da agenda e integridade do compromisso.

Este documento registra invariantes operacionais do Agenda Fashion para preservar compromissos já assumidos com clientes.

## Princípio

Depois que um agendamento válido existe, alterações administrativas em equipe, serviço, configuração de agenda ou plano não devem fazer o compromisso desaparecer silenciosamente nem tornar sua gestão impossível.

A reserva pertence operacionalmente ao negócio e deve continuar rastreável até uma resolução explícita do seu ciclo de vida.

## Remoção de profissional da equipe

A remoção de um vínculo em `usuarios_negocios` não pode ser usada para apagar ou esconder compromissos ainda sem desfecho.

Regra atual:

- apenas a dona do negócio pode remover uma profissional;
- a dona não pode remover o próprio vínculo;
- RN45/CA-EQP-05: se a profissional possuir qualquer agendamento com status `agendado` ou `confirmado` naquele negócio, a remoção deve ser bloqueada com conflito (`409`), inclusive quando a data já passou ou o vínculo está inativo;
- agendamentos de outro negócio não entram nessa decisão;
- compromissos com desfecho `cancelado`, `realizado` ou `falta` não impedem a remoção; a passagem do relógio, sozinha, não é um desfecho.

Enquanto existir compromisso ativo, a interface deve orientar a dona a resolvê-lo por uma transição válida do lifecycle antes de remover a profissional. O sistema não transfere nem cancela reservas implicitamente. Esta regra substitui a interpretação anterior deste documento, que considerava somente compromissos futuros.

### Concorrência entre remoção e novo agendamento

A validação de pertencimento feita antes de iniciar um agendamento não é suficiente para proteger contra uma remoção concorrente da equipe. O banco deve garantir a relação no momento da gravação.

A migration `068_validar_vinculo_profissional_agendamento.sql` estabelece essa invariável:

- antes de inserir um agendamento ou alterar seu `profissional_id`/`negocio_id`, o PostgreSQL exige um vínculo ativo em `usuarios_negocios` com papel `dono` ou `profissional`;
- a linha do vínculo é bloqueada na mesma transação do agendamento;
- a remoção da profissional bloqueia a mesma linha, serializando as operações concorrentes;
- se o agendamento obtiver o bloqueio primeiro, a remoção espera e depois enxerga o compromisso criado, podendo bloqueá-la com `409`;
- se a remoção for concluída primeiro, o agendamento não pode criar um compromisso órfão e a constraint operacional `agendamentos_profissional_negocio_vinculo` é devolvida como conflito (`409`);
- essa regra vale para qualquer caminho futuro de escrita em `agendamentos`, não apenas para o fluxo público atual.

## Serviços e histórico

`agendamentos.servico_id` usa `ON DELETE RESTRICT`, e o agendamento já possui snapshots de preço (`valor_servico`) e duração (`duracao_minutos`). Portanto, serviço utilizado por agendamento é dado histórico e não deve depender de exclusão física para sair da oferta pública.

Regra atual:

- serviço sem referência em agendamentos ainda pode ser excluído fisicamente;
- serviço que já participa de qualquer agendamento não pode ser excluído fisicamente;
- a constraint `agendamentos_servico_fk` continua sendo a barreira final de integridade no PostgreSQL;
- quando essa exclusão é tentada pela API, a violação conhecida de integridade é traduzida para conflito (`409`) com orientação para desativar o serviço;
- desativar o serviço impede novas reservas públicas sem apagar o registro necessário ao histórico.

O sistema não deve transformar qualquer erro `23503` genérico em conflito conhecido: apenas constraints explicitamente reconhecidas podem receber mensagem operacional específica. Outras violações de integridade continuam sendo tratadas como erro inesperado até terem uma regra de domínio definida.

## Materialização da agenda operacional

A grade configurada representa disponibilidade para novas reservas; ela não é a fonte de verdade para decidir se um compromisso já assumido existe.

Regra atual:

- um agendamento persistido deve aparecer na agenda operacional pelo horário real de início, mesmo que esse horário não exista mais na grade configurada;
- se o dia estiver atualmente marcado como fechado, compromissos já existentes continuam visíveis; o fechamento impede nova disponibilidade, mas não apaga reservas anteriores;
- a responsável atual ativa continua disponível para reagendar uma reserva existente mesmo se o serviço foi desativado; a troca de responsável continua exigindo serviço elegível e profissional ativa habilitada, sem alterar snapshots;
- reservas ativas ocupam todo o intervalo `[início, fim)` da grade, usando a duração congelada e o fuso consultado, inclusive quando começam antes da janela e atravessam a meia-noite. Pontos intermediários aparecem como `ocupado`, sem ações duplicadas; esse é um estado visual, não um novo status de `agendamentos`;
- quando uma reserva ativa começou antes do dia consultado e ainda o ocupa, o cartão de `00:00` identifica explicitamente a continuação e preserva `data_agendamento`/`hora_agendamento` originais. Abrir o reagendamento usa esse início original; o instante persistido não é alterado pela projeção. Integrantes inativas entram na seleção por sobreposição e exibem apenas suas reservas próprias, inclusive continuações;
- a Agenda Geral inclui horários reais de reservas e bloqueios mesmo quando eles não coincidem com a grade horária fixa usada como base visual;
- a dona pode escolher uma data ou navegar entre semanas para encontrar reservas antigas ainda abertas e reservas futuras fora da janela inicial. `GET /agenda-geral?data_inicio=AAAA-MM-DD` sempre consulta sete dias a partir de uma data real validada; sem parâmetro, começa em hoje no fuso do negócio. O período não amplia o escopo de autorização;
- integrantes inativas com reservas não canceladas no período também aparecem para gestão pela dona. Sua grade contém somente essas reservas do negócio, sem horários livres, bloqueios manuais ou ocupações redigidas de outro negócio. A pessoa inativa não é destino de reagendamento; a interface escolhe uma responsável ativa e habilitada, preservando a autorização do backend e sem reativar o vínculo;
- a resposta da agenda profissional preserva o status persistido do agendamento. A simples passagem do horário não transforma `agendado` ou `confirmado` em `realizado`;
- ocupação da mesma profissional em outro negócio pode bloquear/materializar o horário para evitar dupla reserva, mas dados de cliente, serviço e demais detalhes do outro negócio permanecem redigidos;
- a camada `agendaOperacionalService` é responsável por materializar esses compromissos sobre a grade já produzida pela agenda existente, mantendo a correção isolada e reversível enquanto a arquitetura de disponibilidade multi-negócio não é concluída.

`realizado` deve representar um fato de atendimento persistido, nunca uma inferência baseada apenas em data e hora.

## Recuperação de alterações e bloqueios

O frontend envia `bloqueado: true|false` no POST `/bloqueios-horario` para indicar
o estado desejado. Repetir o mesmo pedido conserva o estado, sob o mesmo lock e
transação já usados para validar reservas e bloqueios do negócio. O campo é
opcional para compatibilidade: omiti-lo mantém o toggle dos clientes antigos.
Reservas ativas e bloqueios globais legados continuam protegidos.

A interface permite uma escrita por vez. Se a escrita for confirmada e a leitura
seguinte falhar, informa que a alteração foi salva e desabilita novas ações até
atualizar a agenda. Resultado de escrita incerto também exige consulta antes de
nova tentativa; o diálogo é fechado para deixar essa recuperação acessível.
`Atualizar agenda` faz apenas GET, sem repetir o POST/PATCH. Rejeições de
validação preservam o formulário e exibem o erro no diálogo. Leituras antigas
ou conclusões de escritas de uma tela encerrada não podem iniciar atualizações
na nova tela. Cancelar uma leitura local não desfaz uma escrita já enviada.

## Pontos ainda pendentes da agenda operacional

Estas proteções resolvem falhas concretas, mas não encerram a arquitetura operacional da agenda. Permanecem como trabalhos separados:

1. separar completamente a disponibilidade configurada por `negócio + profissional` da ocupação física global da profissional em múltiplos negócios;
2. oferecer contexto ativo explícito para contas ligadas a mais de um negócio quando o modelo permitir múltiplos vínculos profissionais ativos;
3. derivar/corrigir o fuso horário de negócios fora de `America/Sao_Paulo` sem exigir conhecimento técnico de timezone IANA;
4. evoluir o ciclo de serviço para um arquivamento explícito caso seja necessário distinguir serviço desativado de serviço arquivado;
5. continuar migrando notificações, retorno, recorrência e métricas para fatos persistidos do lifecycle, sem inferência pela passagem do relógio;
6. substituir gradualmente a grade visual fixa da Agenda Geral por uma representação derivada da disponibilidade configurada, sem voltar a acoplar a existência de compromissos à configuração atual.

## Testes mínimos de regressão

Mudanças relacionadas devem manter cobertura para:

- bloqueio da remoção com compromisso ativo futuro ou passado, inclusive vínculo inativo;
- preservação do vínculo quando a remoção é bloqueada;
- liberação da remoção depois que o compromisso ativo é resolvido;
- navegação para reservas antigas e fora da semana inicial com consulta limitada e isolada;
- gestão das reservas de profissionais inativas pela dona, sem novas disponibilidades ou destino de reagendamento inativo;
- repetição idempotente de bloquear/liberar, compatibilidade do toggle e proteção de bloqueios legados;
- falha de leitura após escrita confirmada sem reenvio da alteração, exclusão entre escritas e descarte de respostas antigas;
- rejeição de novo agendamento quando o vínculo profissional-negócio não existe mais;
- tradução da constraint `agendamentos_profissional_negocio_vinculo` para conflito operacional;
- isolamento por negócio;
- owner não removível;
- exclusão física de serviço referenciado bloqueada pelo banco e traduzida para `409`;
- serviço sem histórico mantendo o fluxo de exclusão existente;
- histórico de preço e duração preservado pelos snapshots do agendamento;
- agendamento existente visível mesmo em dia atualmente fechado;
- agendamento com início fora da grade visual base materializado no horário real;
- status persistido preservado sem conversão temporal automática para `realizado`;
- ocupação de outro negócio materializada sem expor cliente ou serviço;
- datas próximas à virada do dia avaliadas no fuso do negócio quando a regra depender de futuro/passado.
