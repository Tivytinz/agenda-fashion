# Ativação profissional: UX da primeira jornada

Este documento registra decisões duráveis da primeira jornada da profissional no Agenda Fashion.

## Objetivo

A primeira experiência deve levar a profissional ao valor com o menor número possível de decisões:

`conta → negócio → primeiro serviço → publicação automática → horários confirmados → compartilhar perfil → primeiro agendamento`

A interface não deve fazer a profissional sentir que precisa configurar todo o SaaS antes de começar.

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

Na criação inicial, priorizar somente o necessário para avançar para publicação:

- nome do negócio;
- pelo menos uma especialidade;
- WhatsApp;
- cidade;
- estado.

O WhatsApp da conta autenticada pode preencher inicialmente o WhatsApp do negócio, mas permanece editável e o backend continua validando o valor recebido.

Foto, descrição, Google Maps e endereço completo enriquecem o perfil e podem ser adicionados depois. Não devem parecer requisitos para iniciar a ativação.

## Primeiro serviço

A foto do serviço é recomendada para conversão, mas não é requisito para publicar o negócio ou liberar a etapa seguinte.

A interface deve deixar claro que o primeiro serviço ativo é o marco necessário. Fotos e descrição podem ser aprimoradas depois.

## Primeira configuração da agenda

A primeira configuração deve priorizar:

1. dias em que a profissional atende;
2. horário de início e fim;
3. pausas, quando existirem;
4. confirmação explícita por `Salvar horários`.

Duração padrão, intervalo entre clientes e antecedências são ajustes avançados. Na primeira configuração, ficam recolhidos para reduzir carga cognitiva. Em uma agenda já configurada, ficam abertos para facilitar a gestão recorrente.

Nenhum horário sugerido deve ser considerado confirmado antes do primeiro salvamento válido. A fonte canônica continua sendo `agenda_configuracoes.configurado_em`.

## Pós-agenda

Depois da primeira configuração válida, a próxima missão é compartilhar o perfil rastreável do AF e conquistar o primeiro agendamento.

Não criar um segundo mecanismo de compartilhamento. Reutilizar os links públicos rastreáveis e o `PublicShareButton` existentes.
