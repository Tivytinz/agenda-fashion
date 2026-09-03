# Ativação profissional: UX da primeira jornada

Este documento registra decisões duráveis da primeira jornada da profissional no Agenda Fashion.

## Objetivo

A primeira experiência deve levar a profissional ao valor com uma jornada clara e com dados de qualidade:

`conta → negócio completo → primeiro serviço → horários confirmados → publicação automática → compartilhar perfil → primeiro agendamento`

A interface deve evitar decisões que não pertencem ao momento atual, mas não deve sacrificar a qualidade dos dados estruturais do negócio.

## Emojis e identidade

Emojis fazem parte da identidade do Agenda Fashion quando ajudam a leitura e reforçam o contexto de beleza, agenda, celebração ou crescimento.

Exemplos adequados:

- `💅` para catálogo, beleza e ativação de serviços;
- `📅` para disponibilidade e agenda;
- `✨` para orientação, conclusão de etapa e publicação;
- `💖` quando fizer sentido como reforço acolhedor da marca.

Eles não substituem texto, rótulos, ícones acessíveis, estados de erro ou instruções necessárias.

## Cadastro profissional

O cadastro profissional deve pedir somente os dados necessários para criar a conta.

Consentimentos de WhatsApp com finalidades profissionais não devem competir com a criação da conta:

- avisos operacionais de novos agendamentos, alterações e cancelamentos são oferecidos contextualmente no painel;
- orientações de ativação e divulgação continuam com consentimento separado e também são oferecidas no painel;
- as duas preferências começam desativadas até ação explícita da profissional.

O cadastro de cliente continua podendo oferecer separadamente a preferência de notificações dos próprios agendamentos.

## Criação do negócio

Todo novo negócio deve nascer com as informações estruturais essenciais do perfil preenchidas. A criação exige:

- nome do negócio;
- pelo menos uma especialidade;
- WhatsApp;
- link de localização do Google Maps;
- CEP;
- endereço;
- número;
- bairro;
- cidade;
- estado.

Descrição, foto e complemento são opcionais. O upload de foto continua acontecendo pelo fluxo próprio depois que o negócio existe. A descrição pode ser melhorada depois e o complemento pode ser preenchido quando fizer sentido para o endereço, sem bloquear a criação quando não existir.

Na criação padrão, sem checkout de plano nem rota explícita de retorno, a interface deve continuar diretamente para o cadastro do primeiro serviço. O dashboard não deve introduzir uma decisão intermediária antes dessa etapa.

O WhatsApp da conta autenticada pode preencher inicialmente o WhatsApp do negócio, mas permanece editável e o backend continua validando o valor recebido.

Esta exigência vale para **criação de novos negócios**. Ela não altera retroativamente os requisitos canônicos de publicação de negócios existentes, preservando compatibilidade com perfis legados.

## Primeiro serviço

A foto do serviço é recomendada para conversão, mas não é requisito para liberar a etapa seguinte ou publicar o negócio depois da confirmação dos horários.

A interface deve deixar claro que o primeiro serviço ativo é necessário, mas não publica sozinho um negócio novo. Depois dele, o fluxo segue diretamente para a confirmação dos horários. Fotos e descrição do serviço podem ser aprimoradas depois.

Durante essa primeira missão de onboarding, o formulário deve priorizar apenas nome, categoria, valor e duração. Descrição, fotos e o controle de visibilidade ficam para a gestão posterior; o primeiro serviço nasce ativo para não criar uma pendência contraditória imediatamente antes da confirmação dos horários.

## Primeira configuração da agenda

A primeira configuração deve priorizar:

1. dias em que a profissional atende;
2. horário de início e fim;
3. pausas, quando existirem;
4. confirmação explícita por `Salvar horários`.

### Confirmação rápida da primeira disponibilidade

Quando a agenda ainda não tiver `configurado_em` e houver horários sugeridos válidos, a primeira tela deve priorizar uma confirmação rápida antes do editor semanal completo:

1. resumir os dias, faixas de atendimento e pausas sugeridas;
2. oferecer `Confirmar horários e publicar` como ação principal;
3. oferecer `Ajustar horários` como ação secundária, abrindo o editor completo existente;
4. deixar explícito que nenhum horário fica disponível para clientes antes da confirmação;
5. exigir pelo menos um dia ativo na primeira confirmação, sem impedir que uma agenda já configurada seja posteriormente fechada em todos os dias quando necessário.

A confirmação rápida não altera a fonte de verdade: o frontend envia os sete dias ao endpoint existente, o backend valida e persiste a configuração, marca `agenda_configuracoes.configurado_em` e somente então recalcula a elegibilidade de publicação.

Os eventos existentes de agenda devem distinguir a origem da interação por `propriedades.origem`, usando `confirmacao_rapida`, `ajuste_manual` ou `editor`, sem criar um segundo funil de analytics.

Depois que o backend confirmar a primeira configuração e a publicação, o editor deixa de competir visualmente com a missão seguinte. A interface deve priorizar imediatamente o `PublicShareButton` e a cópia do link rastreável para conduzir a profissional à divulgação e ao primeiro agendamento.

Duração padrão, intervalo entre clientes e antecedências são ajustes avançados. Na primeira configuração, ficam recolhidos para reduzir carga cognitiva. Em uma agenda já configurada, ficam abertos para facilitar a gestão recorrente.

Nenhum horário sugerido deve ser considerado confirmado antes do primeiro salvamento válido. A fonte canônica continua sendo `agenda_configuracoes.configurado_em`.

Para negócios criados no fluxo novo, a agenda confirmada é requisito de publicação. O primeiro salvamento válido recalcula a elegibilidade no backend e publica automaticamente apenas quando os dados obrigatórios e o serviço ativo também estiverem presentes.

Negócios anteriores a essa regra mantêm os critérios legados. Eles não devem ser despublicados nem obrigados retroativamente a confirmar a agenda.

## Pós-agenda

Depois da primeira configuração válida e da publicação confirmada pelo backend, a próxima missão é compartilhar o perfil rastreável do AF e conquistar o primeiro agendamento. Se ainda houver alguma pendência obrigatória, a interface não deve oferecer o compartilhamento como se o perfil estivesse no ar.

No dashboard, essa missão deve aparecer antes de métricas e relatórios. Enquanto o perfil tiver menos de 15 visitas e ainda não tiver recebido o primeiro agendamento, a interface continua incentivando divulgação em vez de diagnosticar baixa conversão com uma amostra pequena. A partir desse volume, o AF pode sugerir revisão de serviços, preços e horários como orientação, sem tratar o número isolado como prova estatística de problema.

No fluxo público de agendamento, compartilhar um serviço é uma ação secundária. Ela não deve competir com a escolha do serviço em cada card; pode ser oferecida depois que a cliente já tiver selecionado o serviço.

Não criar um segundo mecanismo de compartilhamento. Reutilizar os links públicos rastreáveis e o `PublicShareButton` existentes.
