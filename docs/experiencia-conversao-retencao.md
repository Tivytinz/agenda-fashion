# Experiência de conversão e retenção

Este documento registra regras duráveis de UX do Agenda Fashion para a transição entre ativação profissional, descoberta, agendamento e recorrência da cliente.

## Dashboard profissional: uma missão por vez

O onboarding do dashboard existe somente enquanto houver configuração inicial pendente.

Quando perfil, serviço, agenda e publicação estiverem concluídos, o checklist deixa de ser exibido. A partir desse ponto, a próxima missão operacional é responsabilidade do `DashboardNextAction`, evitando dois componentes concorrentes orientando a profissional ao mesmo tempo.

A sequência de produto continua acompanhando o funil real: configurar, publicar, divulgar, converter visitas, obter o primeiro agendamento e aumentar recorrência.

## Catálogo: não prometer horários sem agenda confirmada

O catálogo pode manter negócios legados publicados e descobríveis, conforme as regras de compatibilidade existentes, mas o CTA `Ver horários` somente pode aparecer quando existir evidência explícita de agenda online confirmada.

O marco canônico é `agenda_configuracoes.configurado_em`. O backend expõe `agendamento_online_disponivel` como dado somente de leitura para o catálogo e perfil público.

Regras:

- `agendamento_online_disponivel = true`: o serviço pode direcionar para o perfil com o serviço pré-selecionado e usar `Ver horários`;
- sinal `false` ou ausente: o serviço direciona apenas para o perfil e usa `Ver perfil`;
- um perfil legado não é despublicado apenas por não possuir o marco de confirmação;
- a disponibilidade real continua sendo calculada e validada no backend. O sinal do catálogo não substitui a validação dos slots.

## Cliente: agendar novamente

Atendimentos realizados podem oferecer `Agendar novamente` quando o histórico possui `slug` do negócio e `servico_id`.

O reagendamento preserva somente o serviço:

`/negocio/<slug>?servico=<servico_id>`

A profissional anterior não deve ser fixada na URL. O fluxo público resolve novamente os profissionais ativos e compatíveis, preservando a regra de não exigir uma escolha quando houver apenas uma opção.

Históricos antigos sem `servico_id` continuam utilizáveis e mantêm o acesso `Ver negócio`, sem inventar um serviço para reagendamento.

## Medição esperada

Estas mudanças devem ser avaliadas por métricas de funil, não apenas por cliques:

- ativação profissional concluída;
- divulgação após ativação;
- visita de perfil para agendamento iniciado;
- primeiro agendamento;
- repetição de agendamento por clientes;
- recorrência e retenção dos negócios.
