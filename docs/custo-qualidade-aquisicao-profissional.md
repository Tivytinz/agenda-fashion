# Custo observado da qualidade de aquisição profissional

## Objetivo

Esta leitura conecta investimento de campanhas de aquisição de profissionais à qualidade operacional já medida pelo funil e pela recorrência do Agenda Fashion.

Ela responde, de forma descritiva, quanto investimento foi registrado no período por campanha oficial e qual foi o custo observado por profissional oficialmente atribuído e por profissional que chegou ao primeiro agendamento.

Ela também pode relacionar investimento a segundo e terceiro agendamento quando gasto e aquisição pertencem a uma base temporalmente madura e verificável, além de mostrar como a assinatura paga coexistiu com esses marcos dentro da mesma coorte madura.

Ela não redefine CAC, ROAS, receita atribuída, retenção oficial, LTV, payback ou regras de orçamento.

## Fontes de verdade

O investimento usa `marketing_campanha_gastos` e considera somente valores em BRL de campanhas com `marketing_campanhas.objetivo = 'profissional'`.

A qualidade do profissional continua vindo da coorte de recorrência. O primeiro, segundo e terceiro agendamento são derivados de registros reais de `agendamentos`, excluindo status `cancelado`, conforme a metodologia já documentada em `docs/marketing-attribution.md`.

A ligação entre investimento e qualidade usa exclusivamente `campanha_oficial_id`. Nome, UTM textual ou origem isolada não são usados como chave financeira.

A monetização preserva a regra já usada pelo funil profissional: considera o primeiro pagamento datado de um plano cujo valor é maior que zero. Esse pagamento só é válido enquanto seu status atual for `CONFIRMED` ou `RECEIVED`.

## Alinhamento temporal

O gasto e a coorte usam a mesma seleção de período operacional e a mesma referência `America/Sao_Paulo` já usada pelos relatórios administrativos de marketing.

Isso produz uma leitura alinhada do período, mas não significa que cada centavo de gasto tenha sido atribuído individualmente a uma pessoa específica.

## Custo observado simples

Para cada campanha profissional oficial, o painel pode mostrar:

- investimento registrado no período;
- dias com gasto registrado;
- profissionais oficialmente atribuídos à campanha;
- custo observado por profissional oficialmente atribuído, calculado como investimento do período dividido pelos profissionais oficiais da campanha no mesmo período;
- profissionais que chegaram ao primeiro agendamento;
- custo observado por profissional com primeiro agendamento, calculado como investimento do período dividido pelos profissionais oficiais da campanha que chegaram a esse marco;
- recorrência madura D7, D14 e D30 como contexto de qualidade.

Esses custos devem ser chamados de **custo observado**, não de CAC.

## Custo de recorrência em coorte madura

O AF não divide mais todo o gasto recente pelos recorrentes antigos. Para relacionar investimento a repetição de valor, a base financeira precisa estar madura desde a aquisição.

A janela de ativação já existente no funil é reutilizada. Por padrão, ela é de 14 dias e continua configurável por `MARKETING_DECISION_ACTIVATION_MATURITY_DAYS`.

Depois dessa ativação, a recorrência mantém as janelas candidatas D7, D14 e D30. Portanto, com a configuração padrão, uma aquisição precisa ter tempo para completar:

- D7: 14 + 7 = 21 dias;
- D14: 14 + 14 = 28 dias;
- D30: 14 + 30 = 44 dias.

Esses valores acompanham a configuração de ativação. Se a janela de ativação mudar, a maturidade financeira total muda junto.

### Dia de gasto completamente maduro

`marketing_campanha_gastos` registra gasto por data, e não pelo horário exato de cada aquisição. Por isso, o AF usa uma regra conservadora: um dia de gasto só entra na base quando o dia inteiro já teve tempo para completar a maturidade necessária.

Na prática, `idade_dias` precisa ser **maior** que a maturidade total da janela. Um gasto com exatamente 28 dias de idade ainda não é considerado um dia completamente maduro para D14, porque aquisições feitas no fim daquele dia podem ainda não ter completado 28 dias exatos.

Somente o investimento desses dias completamente maduros forma `investimentoMaduroCentavos`.

### Cobertura pelo mesmo dia de aquisição

Para entrar na base financeira de uma campanha, o profissional precisa:

1. ter atribuição classificada como `oficial` para o mesmo `campanha_oficial_id`;
2. ter `atribuicao_em` em um dia que possua gasto registrado para a campanha;
3. esse dia de gasto já estar completamente maduro para a janela analisada;
4. ter primeiro agendamento depois da atribuição e dentro da janela de ativação;
5. para contar como repetição, ter o segundo ou terceiro agendamento dentro de D7, D14 ou D30 contados a partir do primeiro agendamento.

A ligação continua sendo de coorte diária, não uma afirmação de que determinado centavo comprou determinada pessoa.

## Custos permitidos na base madura

Quando existe base madura, o painel pode mostrar:

- investimento maduro;
- quantidade de dias maduros com gasto;
- profissionais oficiais maduros cobertos por esses dias de gasto;
- profissionais maduros cujo dia de aquisição não possui gasto registrado;
- profissionais que chegaram ao primeiro agendamento dentro da janela de ativação;
- segundo e terceiro agendamento dentro da janela de recorrência;
- custo observado por primeiro agendamento maduro;
- custo observado por segundo agendamento maduro;
- custo observado por terceiro agendamento maduro.

Se nenhum profissional repetir dentro da janela, o resultado permanece zero ocorrências e o custo unitário fica sem base numérica. O sistema não inventa um valor financeiro finito para uma divisão por zero.

## Quando a base pode ser comparada

A classificação `base_madura_comparavel` reutiliza as proteções já existentes de marketing. Ela só aparece quando, para aquela janela:

- existe investimento em dias completamente maduros;
- existe ao menos um profissional oficial maduro coberto por esses dias;
- não há profissional oficial já maduro em dia sem gasto registrado;
- não existe cadastro `sem_evidencia` na seleção;
- a cobertura dos sinais pagos classificáveis atende `MARKETING_DECISION_MIN_ATTRIBUTION_COVERAGE`, cujo padrão atual é 100%;
- a quantidade de profissionais maduros cobertos atende `MARKETING_DECISION_MIN_SIGNUPS`, cujo padrão atual é 10.

Os demais estados permanecem explícitos:

- `aguardando_gasto_maduro`;
- `gasto_maduro_sem_profissional`;
- `cobertura_custo_incompleta`;
- `origem_sem_evidencia`;
- `atribuicao_paga_incompleta`;
- `amostra_madura_pequena`;
- `base_madura_comparavel`.

Esses estados são guardrails de leitura. Eles não representam comandos automáticos de mídia.

## Recorrência madura e monetização

A análise de monetização usa a mesma coorte oficial da recorrência e acrescenta o primeiro pagamento de plano pago já reconhecido pelo funil profissional.

A janela de monetização continua configurável por `MARKETING_DECISION_MONETIZATION_MATURITY_DAYS` e tem padrão de 21 dias. Para comparar assinatura e repetição sem censurar profissionais recentes, a idade mínima da aquisição em cada janela é o maior valor entre:

- a janela de monetização; e
- a janela de ativação somada à janela candidata de recorrência.

Com ativação de 14 dias e monetização de 21 dias, os mínimos atuais são:

- D7: `max(21, 14 + 7)` = 21 dias;
- D14: `max(21, 14 + 14)` = 28 dias;
- D30: `max(21, 14 + 30)` = 44 dias.

Diferentemente do gasto diário, `atribuicao_em` possui timestamp exato. Por isso, a maturidade comportamental usa comparação inclusiva no limite: uma aquisição com exatamente 28 dias completos já pode entrar na base D14. A regra conservadora `idade_dias > limite` permanece exclusiva do gasto agregado por dia, cujo horário da aquisição não está representado no registro de custo.

### Primeiro pagamento da aquisição

A recorrência preserva a mesma semântica do funil:

1. entram apenas assinaturas de planos com `planos.valor > 0`;
2. é selecionado o primeiro pagamento com `data_pagamento` do negócio, ordenado por data e ID;
3. esse pagamento só conta como monetização quando seu status atual é `CONFIRMED` ou `RECEIVED`;
4. ele precisa ocorrer entre `atribuicao_em` e o limite da janela de monetização;
5. uma renovação posterior não substitui o primeiro pagamento da aquisição;
6. se o primeiro pagamento for reembolsado ou deixar de ter status válido, a monetização inicial deixa de contar mesmo que exista uma renovação posterior recebida.

Essa regra evita inflar aquisição paga com receita posterior que não corresponde ao primeiro pagamento da relação comercial.

### Leitura permitida

Para cada campanha oficial e janela madura, o painel pode mostrar:

- profissionais cuja aquisição já amadureceu para a análise;
- profissionais que chegaram ao primeiro agendamento dentro da janela de ativação;
- profissionais que chegaram ao segundo e ao terceiro agendamento dentro da janela candidata;
- assinaturas válidas dentro da janela de monetização;
- assinaturas entre quem chegou ao primeiro, segundo e terceiro agendamento;
- taxas de assinatura dentro de cada denominador, exibindo `Sem base` quando o denominador é zero;
- indicação de amostra abaixo da régua operacional já usada pelo funil.

“Assinaturas entre quem chegou ao segundo agendamento” significa interseção dos dois comportamentos na mesma coorte. Não significa que o segundo agendamento causou a assinatura nem que o pagamento ocorreu necessariamente depois da repetição.

No modelo freemium do AF, um profissional pode obter valor real sem converter para plano pago dentro da janela. Ausência de assinatura não deve ser interpretada isoladamente como falha de produto ou motivo automático para pausar aquisição.

Esta camada não calcula LTV, payback, CAC recuperado ou ROAS e não transforma D7, D14 ou D30 em retenção oficial.

## Efeito do período selecionado

A seleção do painel continua limitando quais aquisições e gastos entram no relatório.

Com a configuração padrão, D30 exige 44 dias de maturidade desde a aquisição. Assim, uma seleção de apenas 30 dias pode legitimamente mostrar **sem gasto maduro** para D30 e nenhuma coorte comportamental D30 madura. Isso não significa recorrência zero nem falha da campanha; significa que aquela seleção não contém aquisições antigas o suficiente para a comparação.

Para análises de janelas longas, períodos maiores ou `all` podem ser necessários, sempre preservando os mesmos guardrails de atribuição e custo.

## Qualidade da atribuição

A leitura preserva as classificações existentes do backend:

- `oficial`;
- `organico`;
- `rastreamento_incompleto`;
- `identidade_nao_oficial`;
- `sem_evidencia`.

A cobertura paga observada é calculada apenas sobre sinais pagos classificáveis: `oficial / (oficial + rastreamento_incompleto + identidade_nao_oficial)`.

Profissionais `sem_evidencia` são exibidos separadamente porque não devem ser presumidos como orgânicos nem como pagos.

Quando existe rastreamento incompleto, identidade não oficial ou ausência de evidência, o custo simples continua podendo aparecer como diagnóstico observado. A visão madura, porém, permanece bloqueada para comparação forte enquanto os guardrails oficiais não forem atendidos.

## Casos que não podem ser ocultados

Uma campanha profissional com investimento registrado e zero profissionais oficialmente atribuídos deve continuar visível. Esse estado é classificado como `investimento_sem_profissional_atribuido` e serve para localizar falhas de aquisição, atribuição ou qualidade de tráfego.

Uma campanha com profissionais oficialmente atribuídos, mas sem gasto registrado no período, deve aparecer como `sem_investimento_registrado`; o sistema não inventa custo zero nem custo financeiro.

Um profissional oficial cuja aquisição já amadureceu, mas cujo dia não possui gasto registrado, deve aparecer na contagem de cobertura de custo faltante e impedir que a base seja tratada como comparável.

## Decisões de orçamento

Esta camada é diagnóstica. Custo observado por segundo ou terceiro agendamento maduro e coexistência com assinatura paga não são CAC, ROAS, LTV, payback ou retenção oficial.

Nenhum desses valores libera aumento de orçamento, pausa automática de campanha ou conclusão de rentabilidade. Decisões financeiras continuam exigindo cobertura de atribuição adequada, custo confiável, maturidade suficiente, receita comprovável quando aplicável e amostra compatível com a decisão.
