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

A evolução desejada do ciclo de serviços é arquivamento/desativação para novas reservas, preservando referências históricas. Até esse fluxo ser concluído e coberto por testes, mudanças nessa área devem respeitar o `ON DELETE RESTRICT` e não mascarar erro de integridade como sucesso.

## Pontos ainda pendentes da agenda operacional

Esta proteção de offboarding resolve uma falha concreta, mas não encerra a arquitetura operacional da agenda. Permanecem como trabalhos separados:

1. fazer a Agenda Geral sempre materializar agendamentos existentes, mesmo quando a configuração atual de horários mudou;
2. separar disponibilidade configurada por `negócio + profissional` da ocupação física global da profissional em múltiplos negócios;
3. oferecer contexto ativo explícito para contas ligadas a mais de um negócio;
4. persistir um ciclo de atendimento confiável (`agendado`, `confirmado`, `realizado`, `falta`, `cancelado`) sem inferir atendimento apenas pela passagem do tempo;
5. derivar/corrigir o fuso horário de negócios fora de `America/Sao_Paulo` sem exigir conhecimento técnico de timezone IANA;
6. concluir o arquivamento seguro de serviços usados em histórico;
7. tornar notificações, retorno e recorrência dependentes de fatos de atendimento confiáveis.

## Testes mínimos de regressão

Mudanças relacionadas devem manter cobertura para:

- bloqueio da remoção com compromisso futuro ativo;
- preservação do vínculo quando a remoção é bloqueada;
- liberação da remoção depois que o compromisso ativo é resolvido;
- isolamento por negócio;
- owner não removível;
- histórico de serviço preservado;
- datas próximas à virada do dia avaliadas no fuso do negócio.
