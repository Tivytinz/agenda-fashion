# Ativação profissional: UX da primeira jornada

Este documento registra decisões duráveis da primeira jornada da profissional no Agenda Fashion.

## Objetivo

A primeira experiência deve levar a profissional ao valor com uma jornada curta, clara e com dados estruturais suficientes para publicar um perfil utilizável:

`conta → negócio completo → primeiro serviço → publicação automática → confirmação rápida da agenda → compartilhar perfil/checkout → primeiro agendamento`

A preparação necessária para publicar possui duas etapas:

1. `Negócio`;
2. `Serviço`.

Depois que o primeiro serviço torna o negócio elegível e a publicação é confirmada pelo backend, a interface apresenta um terceiro momento visível, `Horários`, para mostrar que o Agenda Fashion também é uma agenda editável. Essa etapa não participa do gate de publicação: o perfil já está publicado antes dela.

Na primeira passagem pelos horários, o AF mostra a disponibilidade sugerida e oferece três caminhos:

- `Confirmar horários`: grava a sugestão exibida e continua;
- `Pular por agora`: pula somente a edição manual, grava a mesma sugestão exibida e continua;
- `Ajustar horários`: abre o editor para a profissional personalizar a disponibilidade antes de salvar.

Assim, “pular” nunca significa deixar a agenda sem persistência conhecida. A profissional pode editar a disponibilidade novamente quando quiser.

A interface deve evitar decisões que não pertencem ao momento atual, sem sacrificar a qualidade dos dados estruturais do negócio.

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

No dashboard, esses convites também não devem competir com uma etapa canônica de ativação antes da publicação. Depois que o negócio estiver publicado, a interface oferece no máximo um convite de WhatsApp por vez: primeiro os avisos operacionais de agendamento; depois, se ainda não houver primeiro agendamento e o consentimento operacional já estiver resolvido, as orientações de divulgação.

O cadastro de cliente continua podendo oferecer separadamente a preferência de notificações dos próprios agendamentos.

## Criação do negócio

Todo novo negócio deve nascer com as informações estruturais essenciais do perfil preenchidas. A criação exige:

- nome do negócio;
- pelo menos uma especialidade;
- WhatsApp válido com DDD;
- link de localização com URL HTTP/HTTPS válida;
- CEP válido;
- endereço;
- número;
- bairro;
- cidade;
- estado brasileiro válido.

Descrição, foto e complemento são opcionais. O upload de foto continua acontecendo pelo fluxo próprio depois que o negócio existe. A descrição pode ser melhorada depois e o complemento pode ser preenchido quando fizer sentido para o endereço, sem bloquear a criação quando não existir.

O backend é a fonte de verdade desses requisitos. Não basta o frontend apresentar seletores ou máscaras: WhatsApp, CEP, UF, URL e demais campos obrigatórios continuam validados no servidor.

Na criação padrão, a interface deve continuar diretamente para o cadastro do primeiro serviço. Isso também vale quando a profissional chega com um plano pago pré-selecionado: a escolha pode ser carregada como intenção durante `Negócio → Serviço → Horários`, mas o checkout não deve abrir antes de o primeiro serviço ser salvo e o perfil estar publicado. Depois da publicação, o fluxo apresenta primeiro os horários sugeridos. Ao confirmar ou pular a edição dos horários, uma intenção de plano pago segue para o checkout; sem intenção de plano pago, segue para o painel e para a próxima missão do produto.

`Negócio` e `Serviço` devem aparecer como progresso compacto durante a preparação da publicação. Depois da publicação, `Horários` aparece como configuração rápida da agenda, sem comunicar que ainda falta algo para o perfil ser publicado. A entrada do primeiro serviço usa `?onboarding=servico` como marcador navegável, em vez de depender apenas de estado transitório do React Router; assim, atualizar a página ou reabrir o link não transforma acidentalmente a primeira missão no editor completo. Quando a ativação ainda não possui nenhum serviço, a próxima ação do dashboard deve abrir diretamente esse cadastro. Se já houver apenas serviços inativos, deve abrir a gestão para permitir reativação em vez de chamar o próximo cadastro de primeiro serviço.

O WhatsApp da conta autenticada pode preencher inicialmente o WhatsApp do negócio, mas permanece editável e o backend continua validando o valor recebido.

## Primeiro serviço e publicação

O primeiro serviço deve priorizar somente os dados necessários para colocar a oferta no ar:

- nome;
- categoria;
- valor;
- duração.

Descrição e fotos do serviço podem ser aprimoradas depois. Durante a primeira missão, o serviço nasce ativo para não criar uma pendência contraditória antes da publicação.

Depois de salvar o primeiro serviço ativo, o backend recalcula a elegibilidade do negócio. A publicação automática exige simultaneamente:

- nome do negócio;
- pelo menos uma especialidade;
- WhatsApp válido;
- cidade;
- estado brasileiro válido;
- bairro;
- endereço;
- número;
- CEP válido;
- link de localização HTTP/HTTPS válido;
- pelo menos um serviço ativo.

Descrição, complemento e fotos não bloqueiam a publicação. Horários também não bloqueiam a publicação.

Se algum dado estrutural obrigatório estiver ausente ou inválido, o serviço continua salvo, mas o fluxo retorna para a edição do negócio com a pendência explícita em vez de apresentar o perfil como publicado. A tela de horários só entra na primeira jornada depois que o backend já confirmou a publicação.

A mesma regra deve ser usada pela publicação manual, pela publicação automática após alterações de serviço e por qualquer backfill de migration. Não pode existir um caminho mais permissivo que outro.

## Disponibilidade padrão e confirmação rápida

A disponibilidade é infraestrutura de agendamento e também um momento de descoberta do produto, mas não é requisito de publicação.

Ao criar um novo negócio, a mesma transação que cria o negócio e o vínculo da dona inicializa a configuração de agenda e os sete dias da semana. A sugestão padrão do AF é:

- domingo: fechado;
- segunda a sexta: 08:00–18:00, com pausa 12:00–13:00;
- sábado: 08:00–13:00.

A existência dessa sugestão permite que o AF apresente uma agenda utilizável sem obrigar a profissional a montar a semana do zero. Na primeira jornada, porém, a interface torna essa disponibilidade visível logo após o primeiro serviço e pede que a profissional confirme, pule a edição ou ajuste. `Confirmar horários` e `Pular por agora` enviam a sugestão ao mesmo fluxo de salvamento; se o salvamento falhar, a interface não deve avançar.

`Pular por agora` significa aceitar a sugestão atual sem entrar no editor. Não significa ignorar a agenda, deixar dados sem salvar ou tornar a configuração requisito de publicação.

`agenda_configuracoes.configurado_em` não deve ser usado como condição de elegibilidade para publicação. A configuração e os horários padrão podem existir antes de uma ação explícita na tela; o marcador passa a registrar a primeira configuração/salvamento reconhecida pelo fluxo de agenda. A origem dos horários continua separada desse gate:

- `padrao_af`: sugestão automática ainda não personalizada;
- `personalizado`: a profissional salvou sua disponibilidade;
- `legado_desconhecido`: configuração histórica cuja origem não pode ser provada.

Ao salvar a agenda pelo fluxo atual, o backend registra a configuração e a profissional pode editar dias, faixas, pausas, duração padrão, intervalos e antecedências quando quiser no painel.

A disponibilidade sugerida nunca deve sobrescrever silenciosamente uma agenda comprovadamente personalizada.

## Negócios existentes e migração

O campo `negocios.publicacao_exige_agenda` é legado e não deve voltar a ser usado como gate de publicação.

A migração da regra deve:

- desativar o gate legado;
- preservar agendas personalizadas ou de origem não comprovada;
- normalizar automaticamente apenas configurações identificadas com segurança como padrão do AF;
- inicializar disponibilidade ausente para vínculos ativos;
- publicar retroativamente somente negócios que atendam a todos os requisitos estruturais atuais e possuam serviço ativo.

O backfill não pode publicar perfis com UF inexistente, WhatsApp/CEP inválidos ou link de localização sem HTTP/HTTPS apenas porque os campos estão preenchidos.

## Pós-publicação

Depois da publicação confirmada pelo backend e da passagem pela configuração rápida de horários, a próxima missão é compartilhar o perfil rastreável do AF e conquistar o primeiro agendamento. Se ainda houver alguma pendência obrigatória, a interface não deve oferecer compartilhamento como se o perfil estivesse no ar.

Quando existir uma intenção válida de plano pago trazida desde a aquisição/cadastro, ela deve ser preservada durante `Negócio → Serviço → Horários` e pode seguir para o checkout depois que os horários sugeridos forem salvos ou ajustados. Checkout iniciado continua sendo uma etapa de monetização e não equivale a pagamento confirmado.

No dashboard, a missão de conquistar o primeiro agendamento deve aparecer antes de métricas e relatórios. Enquanto o perfil tiver menos de 20 visitas e ainda não tiver recebido o primeiro agendamento, a interface continua incentivando divulgação em vez de diagnosticar baixa conversão com uma amostra pequena. A partir desse volume, o AF pode sugerir revisão de serviços, preços e horários como orientação, sem tratar o número isolado como prova estatística de problema.

No fluxo público de agendamento, compartilhar um serviço é uma ação secundária. Ela não deve competir com a escolha do serviço em cada card; pode ser oferecida depois que a cliente já tiver selecionado o serviço.

Não criar um segundo mecanismo de compartilhamento. Reutilizar os links públicos rastreáveis e o `PublicShareButton` existentes.
