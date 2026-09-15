# Confiabilidade dos compromissos da agenda

Este documento registra invariantes operacionais do Agenda Fashion para preservar compromissos já assumidos com clientes.

## Princípio

Depois que um agendamento válido existe, alterações administrativas em equipe, serviço, configuração de agenda ou plano não devem fazer o compromisso desaparecer silenciosamente nem tornar sua gestão impossível.

A reserva pertence operacionalmente ao negócio e deve continuar rastreável até uma resolução explícita do seu ciclo de vida.

## Remoção de profissional da equipe

A remoção de um vínculo em `usuarios_negocios` não pode ser usada para apagar ou esconder compromissos futuros.

Regra atual:

- apenas a dona do negócio pode remover uma profissional;
- a dona não pode remover o próprio vínculo;
- se a profissional possuir agendamento futuro com status `agendado` ou `confirmado` naquele negócio, a remoção deve ser bloqueada com conflito (`409`);
- a verificação de futuro considera `negocios.fuso_horario`, com fallback legado `America/Sao_Paulo`;
- agendamentos de outro negócio não entram nessa decisão;
- compromissos cancelados ou que já ficaram no passado não impedem a remoção.

Enquanto existir compromisso futuro ativo, a interface deve orientar a dona a resolvê-lo antes de remover a profissional. O sistema não transfere nem cancela reservas implicitamente.

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
- a Agenda Geral inclui horários reais de reservas e bloqueios mesmo quando eles não coincidem com a grade horária fixa usada como base visual;
- a resposta da agenda profissional preserva o status persistido do agendamento. A simples passagem do horário não transforma `agendado` ou `confirmado` em `realizado`;
- ocupação da mesma profissional em outro negócio pode bloquear/materializar o horário para evitar dupla reserva, mas dados de cliente, serviço e demais detalhes do outro negócio permanecem redigidos;
- a camada `agendaOperacionalService` é responsável por materializar esses compromissos sobre a grade já produzida pela agenda existente, mantendo a correção isolada e reversível enquanto a arquitetura de disponibilidade multi-negócio não é concluída.

`realizado` deve representar um fato de atendimento persistido, nunca uma inferência baseada apenas em data e hora.

## Pontos ainda pendentes da agenda operacional

Estas proteções resolvem falhas concretas, mas não encerram a arquitetura operacional da agenda. Permanecem como trabalhos separados:

1. separar disponibilidade configurada por `negócio + profissional` da ocupação física global da profissional em múltiplos negócios;
2. oferecer contexto ativo explícito para contas ligadas a mais de um negócio;
3. concluir as transições operacionais do ciclo de atendimento (`agendado`, `confirmado`, `realizado`, `falta`, `cancelado`), incluindo quem alterou o estado e quando;
4. derivar/corrigir o fuso horário de negócios fora de `America/Sao_Paulo` sem exigir conhecimento técnico de timezone IANA;
5. evoluir o ciclo de serviço para um arquivamento explícito caso seja necessário distinguir serviço desativado de serviço arquivado;
6. tornar notificações, retorno e recorrência dependentes de fatos de atendimento confiáveis;
7. substituir gradualmente a grade visual fixa da Agenda Geral por uma representação derivada da disponibilidade configurada, sem voltar a acoplar a existência de compromissos à configuração atual.

## Testes mínimos de regressão

Mudanças relacionadas devem manter cobertura para:

- bloqueio da remoção com compromisso futuro ativo;
- preservação do vínculo quando a remoção é bloqueada;
- liberação da remoção depois que o compromisso ativo é resolvido;
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
