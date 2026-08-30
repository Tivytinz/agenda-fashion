# Prontidão financeira da recorrência profissional

## Objetivo

Esta camada responde se uma campanha profissional possui evidência suficientemente alinhada para ler, na mesma base madura, investimento, recorrência e primeiro pagamento de plano pago.

Ela não cria uma nova recomendação de mídia. A decisão de escalar, manter, revisar ou pausar continua pertencendo ao funil profissional e às regras já implementadas em `adminProfessionalFunnelService`.

Também não define retenção oficial, LTV, payback ou um segundo ROAS.

## Fontes reutilizadas

A prontidão não cria uma nova origem de dados. Ela reutiliza:

- campanhas oficiais resolvidas pelo backend;
- investimento diário de `marketing_campanha_gastos`;
- base de recorrência profissional já carregada pelo endpoint administrativo;
- primeiro pagamento de plano pago já adicionado à base de recorrência;
- configuração de decisão já usada pelo funil profissional.

Não existe nova migration nem nova consulta pesada da coorte.

## Base financeira comum

Para uma campanha e uma janela D7, D14 ou D30, a leitura conjunta usa somente profissionais que:

1. foram classificados como `oficial` para o mesmo `campanha_oficial_id`;
2. foram adquiridos em um dia que possui gasto registrado para a campanha;
3. pertencem a um dia de gasto já completamente maduro para a janela financeira;
4. permanecem na mesma base usada para avaliar primeiro, segundo e terceiro agendamento e primeiro pagamento.

O gasto diário não contém o horário exato de cada aquisição. Por isso, a maturidade financeira conserva a regra já usada no custo de recorrência: o dia de gasto precisa estar completamente maduro.

A base é reconstruída pelos mesmos dias maduros e sua quantidade precisa coincidir com `profissionaisMadurosComGasto` da leitura de custo. Divergência gera `base_financeira_inconsistente` e bloqueia a leitura.

## Maturidade

A prontidão compara duas exigências:

- a maturidade da base de custo de recorrência, hoje `ativação + Dn`;
- a maturidade da monetização, que usa `max(monetização, ativação + Dn)`.

Quando a monetização exigir mais tempo do que a base financeira já coberta pela leitura de custo, a prontidão retorna `maturidade_financeira_desalinhada`.

Esse bloqueio é deliberadamente conservador: o AF não mistura investimento de uma coorte mais jovem com monetização de uma coorte mais madura apenas para produzir uma comparação.

Com a configuração padrão atual, ativação de 14 dias e monetização de 21 dias, as janelas ficam alinhadas em:

- D7: 21 dias;
- D14: 28 dias;
- D30: 44 dias.

## Guardrails herdados

A leitura conjunta só fica disponível quando a base de custo correspondente já está em `base_madura_comparavel`.

Portanto, continuam bloqueando a leitura:

- `aguardando_gasto_maduro`;
- `gasto_maduro_sem_profissional`;
- `cobertura_custo_incompleta`;
- `origem_sem_evidencia`;
- `atribuicao_paga_incompleta`;
- `amostra_madura_pequena`.

A prontidão não cria uma segunda régua para cobertura ou amostra. Ela herda a régua operacional já configurada no funil e na camada de custo.

## Resultado zero não é falha de mensuração

Depois que a base está íntegra, zero pode ser um resultado legítimo.

Por exemplo, uma campanha pode possuir base madura comparável e ainda ter:

- zero segundo agendamento;
- zero terceiro agendamento;
- zero assinatura dentro da janela de monetização.

Esses resultados descrevem o comportamento observado e não transformam a base em inválida.

No modelo freemium do AF, zero assinatura dentro da janela também não significa ausência de valor do produto nem autoriza pausar mídia automaticamente.

## Mínimo de assinaturas da régua de ROAS

A tabela exibe quantas assinaturas válidas da base comum foram observadas em relação a `MARKETING_DECISION_MIN_SUBSCRIPTIONS`.

Essa informação é somente contexto de prontidão para a etapa financeira já existente. Atingir o mínimo de assinaturas, sozinho, não libera uma decisão de ROAS.

A recomendação do funil continua considerando sua própria sequência completa de mensuração, amostra, maturidade, ativação, monetização, receita e ROAS.

## Estados da prontidão

Os estados específicos desta camada são:

- `leitura_conjunta_disponivel`: a base comum está íntegra e pode ser lida descritivamente;
- `sem_base_custo`: não existe a janela de custo correspondente;
- `sem_base_monetizacao`: não existe a janela de monetização correspondente;
- `maturidade_financeira_desalinhada`: monetização exige maturidade maior do que a base de custo atualmente cobre;
- `base_financeira_inconsistente`: a reconstrução dos profissionais pelos dias maduros de gasto não coincide com a base registrada.

Os códigos de bloqueio da base madura de custo são preservados sem renomear, para facilitar auditoria e evitar duas taxonomias para o mesmo problema.

## Interpretação permitida

“Leitura conjunta disponível” significa somente que investimento, atribuição, recorrência e monetização foram alinhados de forma suficiente para uma leitura descritiva na mesma base.

Não significa:

- campanha rentável;
- ROAS aprovado;
- CAC recuperado;
- payback atingido;
- LTV conhecido;
- retenção comprovada;
- autorização para escalar, manter ou pausar orçamento.

Essas conclusões exigem as regras e evidências específicas de cada métrica e continuam fora desta camada.
