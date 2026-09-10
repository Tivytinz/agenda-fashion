# Experiência de conversão e retenção

Este documento registra regras duráveis de UX do Agenda Fashion para a transição entre ativação profissional, descoberta, agendamento e recorrência da cliente.

## Dashboard profissional: uma missão por vez

O onboarding do dashboard existe somente enquanto houver uma etapa canônica de ativação pendente.

Enquanto a ativação estiver pendente, o dashboard mostra a missão útil do momento, sem transformar os estados internos do backend em checklist permanente ou em contagem `X de N etapas`.

Quando o negócio possui serviço ativo e está publicado, a missão principal passa a ser conquistar o primeiro agendamento válido. Depois desse marco, o `DashboardNextAction` deixa de ser exibido de forma permanente e o dashboard passa a priorizar oportunidades de crescimento, recorrência e receita.

A sequência de produto acompanha o valor real do AF: estruturar o negócio, publicar, divulgar, converter visitas em agendamentos e aumentar recorrência.

Personalizar horários é importante para a qualidade operacional, mas não é etapa obrigatória do onboarding nem gate de publicação. O AF inicializa uma disponibilidade sugerida e a profissional pode ajustá-la depois.

## Catálogo e promessa de disponibilidade

A experiência pública não deve prometer um horário específico sem validação real de disponibilidade pelo backend.

`agenda_configuracoes.configurado_em` é marcador técnico de inicialização, não confirmação manual da profissional e não deve ser usado sozinho para decidir se o negócio está ativado ou pode ser publicado.

O catálogo e o perfil público podem orientar a cliente para consultar horários quando o contrato atual do backend permitir seguir para o fluxo de agendamento. A disponibilidade final continua sendo calculada e validada no servidor no momento apropriado; a interface não deve inferir slots apenas a partir de estado visual ou dados locais.

Negócios legados não são despublicados apenas porque não existe evidência de personalização manual dos horários.

## Cliente: agendar novamente

Atendimentos realizados podem oferecer `Agendar novamente` quando o histórico possui `slug` do negócio e `servico_id`.

O reagendamento preserva somente o serviço:

`/negocio/<slug>?servico=<servico_id>`

A profissional anterior não deve ser fixada na URL. O fluxo público resolve novamente os profissionais ativos e compatíveis, preservando a regra de não exigir uma escolha quando houver apenas uma opção.

Históricos antigos sem `servico_id` continuam utilizáveis e mantêm o acesso `Ver negócio`, sem inventar um serviço para reagendamento.

## Medição esperada

Estas mudanças devem ser avaliadas por métricas de funil, não apenas por cliques:

- ativação profissional concluída pelo primeiro agendamento válido;
- divulgação após publicação;
- visita de perfil para agendamento iniciado;
- primeiro agendamento;
- repetição de agendamento por clientes;
- recorrência e retenção dos negócios.

Configuração ou personalização de horários pode ser acompanhada como qualidade operacional, mas não substitui os marcos canônicos acima.
