# Centro de comando administrativo

Este documento registra a semântica durável dos indicadores usados na visão administrativa principal do Agenda Fashion.

## Marcos profissionais de ativação

O Centro de comando pode apresentar os principais marcos atingidos pelos profissionais da coorte:

1. cadastro profissional;
2. negócio criado;
3. serviço ativo;
4. negócio publicado;
5. primeiro agendamento válido.

A disponibilidade é importante para a confiabilidade do agendamento, mas não é etapa canônica de ativação nem gate de publicação. O AF inicializa uma disponibilidade padrão ao criar o negócio, e a personalização posterior pode ser acompanhada como diagnóstico técnico separado quando isso ajudar a operação.

Esses números são **marcos independentes dentro da mesma coorte**, não um funil sequencial garantido entre etapas. Por compatibilidade com negócios legados e regras históricas, uma etapa posterior pode ter valor igual ou maior que uma etapa anterior.

Por isso, o Centro de comando não deve calcular nem apresentar automaticamente perdas ou taxas de conversão adjacentes entre esses marcos. A análise detalhada de aquisição pode usar coortes e regras específicas quando houver base suficiente para isso.

### Primeiro agendamento válido

Para ativação e para o relatório administrativo, o primeiro agendamento válido é o primeiro agendamento do negócio cujo status não é `cancelado`.

- `agendado`: conta;
- `confirmado`: conta;
- `realizado`: conta;
- `cancelado`: não conta.

Um agendamento cancelado também não pode impedir que um agendamento válido posterior seja reconhecido como o primeiro agendamento válido.

Esta regra mede a primeira reserva válida recebida pelo negócio. Ela **não** confirma comparecimento, atendimento realizado ou receita.

## Monetização

Checkout e assinatura paga são indicadores separados dos marcos de ativação.

O Centro de comando pode expor ambos para distinguir:

- checkout iniciado: sinal de intenção de compra;
- assinatura paga: primeiro pagamento válido de um plano pago.

Esses indicadores preservam a verdade financeira do backend e não devem ser apresentados como consequência automática de um marco operacional anterior.

A assinatura paga continua dependente das regras financeiras canônicas do backend. O painel não infere receita a partir de clique, cadastro ou checkout.

## Pendências de ativação

Diagnósticos como `Sem negócio`, `Sem serviço` e `Não publicados` podem se sobrepor. Um mesmo profissional pode aparecer em mais de uma pendência.

Questões de disponibilidade podem aparecer em um diagnóstico técnico separado, mas não reduzem o percentual de ativação nem impedem a publicação por si só.

Por isso, a soma dos cards de pendência não deve ser apresentada como equivalente ao total de profissionais com ativação pendente.

A lista operacional pode priorizar profissionais mais avançados no onboarding e, entre candidatos com o mesmo progresso carregado, aqueles há mais tempo sem atividade.

## Cliente final

Os eventos `Descobriram`, `Avaliaram`, `Iniciaram agendamento` e `Reservas criadas` representam contagens de sessões que emitiram cada sinal no período.

Enquanto não existir uma coorte sequencial que imponha a ordem temporal `home → perfil → início → reserva`, esses números não devem ser apresentados como taxas de conversão adjacentes.

O evento técnico `agendamento_concluido` significa que a criação da reserva retornou sucesso. No produto administrativo ele deve ser descrito como **Reserva criada**, não como atendimento concluído.

## Retenção

A visão de retenção reutiliza a leitura existente de recorrência profissional e mede repetição de uso após o primeiro agendamento não cancelado no primeiro negócio do profissional.

Ela pode mostrar, entre outros:

- profissionais com primeiro agendamento;
- profissionais com segundo agendamento;
- taxa de segundo sobre primeiro;
- tempo mediano entre primeiro e segundo agendamento.

Essa leitura não equivale a cliente recorrente, não confirma atendimento realizado e não representa receita por si só.
