# Centro de comando administrativo

Este documento registra a semântica durável dos indicadores usados na visão administrativa principal do Agenda Fashion.

## Funil profissional de ativação

O funil principal de ativação do Centro de comando é **cumulativo**. Cada etapa só contabiliza profissionais da mesma coorte que também cumpriram todos os marcos anteriores:

1. cadastro profissional;
2. negócio criado;
3. serviço criado;
4. agenda configurada;
5. negócio publicado;
6. primeiro agendamento válido.

A compatibilidade de publicação de negócios legados continua preservada no produto. O fato de um negócio legado poder permanecer publicado sem ter passado pelo gate atual de agenda não autoriza uma subida artificial no funil cumulativo do Centro de comando.

### Primeiro agendamento válido

Para ativação e para o funil administrativo, o primeiro agendamento válido é o primeiro agendamento do negócio cujo status não é `cancelado`.

- `agendado`: conta;
- `confirmado`: conta;
- `realizado`: conta;
- `cancelado`: não conta.

Um agendamento cancelado também não pode impedir que um agendamento válido posterior seja reconhecido como o primeiro agendamento válido.

Esta regra mede a primeira reserva válida recebida pelo negócio. Ela **não** confirma comparecimento, atendimento realizado ou receita.

## Monetização

Checkout e assinatura são indicadores separados do funil cumulativo de ativação.

O Centro de comando deve expor ambos para distinguir:

- checkout iniciado: sinal de intenção de compra;
- assinatura paga: primeiro pagamento válido de um plano pago.

Esses indicadores não devem ser artificialmente rebaixados para obrigá-los a seguir a sequência da ativação, porque a verdade financeira do backend tem prioridade sobre a apresentação visual do funil.

A assinatura paga continua dependente das regras financeiras canônicas do backend. O painel não infere receita a partir de clique, cadastro ou checkout.

## Pendências de ativação

Os cards `Sem negócio`, `Sem serviço`, `Sem agenda` e `Não publicados` são diagnósticos independentes. Um mesmo profissional pode aparecer em mais de uma pendência.

Por isso, a soma desses cards não deve ser apresentada como equivalente ao total de profissionais com ativação pendente.

A lista operacional prioriza profissionais mais avançados no onboarding e, entre candidatos com o mesmo progresso carregado, aqueles há mais tempo sem atividade.

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
