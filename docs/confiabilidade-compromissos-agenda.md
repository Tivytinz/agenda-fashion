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

## Serviços e histórico

`agendamentos.servico_id` usa `ON DELETE RESTRICT`, e o agendamento já possui snapshots de preço (`valor_servico`) e duração (`duracao_minutos`). Portanto, serviço utilizado por agendamento é dado histórico e não deve depender de exclusão física para sair da oferta pública.

Regra atual:

- serviço sem referência em agendamentos ainda pode ser excluído fisicamente;
- serviço que já participa de qualquer agendamento não pode ser excluído fisicamente;
- a constraint `agendamentos_servico_fk` continua sendo a barreira final de integridade no PostgreSQL;
- quando essa exclusão é tentada pela API, a violação conhecida de integridade é traduzida para conflito (`409`) com orientação para desativar o serviço;
- desativar o serviço impede novas reservas públicas sem apagar o registro necessário ao histórico.

O sistema não deve transformar qualquer erro `23503` genérico em conflito conhecido: apenas constraints explicitamente reconhecidas podem receber mensagem operacional específica. Outras violações de integridade continuam sendo tratadas como erro inesperado até terem uma regra de domínio definida.

## Pontos ainda pendentes da agenda operacional

Estas proteções resolvem falhas concretas, mas não encerram a arquitetura operacional da agenda. Permanecem como trabalhos separados:

1. fazer a Agenda Geral sempre materializar agendamentos existentes, mesmo quando a configuração atual de horários mudou;
2. separar disponibilidade configurada por `negócio + profissional` da ocupação física global da profissional em múltiplos negócios;
3. oferecer contexto ativo explícito para contas ligadas a mais de um negócio;
4. persistir um ciclo de atendimento confiável (`agendado`, `confirmado`, `realizado`, `falta`, `cancelado`) sem inferir atendimento apenas pela passagem do tempo;
5. derivar/corrigir o fuso horário de negócios fora de `America/Sao_Paulo` sem exigir conhecimento técnico de timezone IANA;
6. evoluir o ciclo de serviço para um arquivamento explícito caso seja necessário distinguir serviço desativado de serviço arquivado;
7. tornar notificações, retorno e recorrência dependentes de fatos de atendimento confiáveis.

## Testes mínimos de regressão

Mudanças relacionadas devem manter cobertura para:

- bloqueio da remoção com compromisso futuro ativo;
- preservação do vínculo quando a remoção é bloqueada;
- liberação da remoção depois que o compromisso ativo é resolvido;
- isolamento por negócio;
- owner não removível;
- exclusão física de serviço referenciado bloqueada pelo banco e traduzida para `409`;
- serviço sem histórico mantendo o fluxo de exclusão existente;
- histórico de preço e duração preservado pelos snapshots do agendamento;
- datas próximas à virada do dia avaliadas no fuso do negócio.
