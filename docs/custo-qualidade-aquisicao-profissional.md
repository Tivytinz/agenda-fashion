# Custo observado da qualidade de aquisição profissional

## Objetivo

Esta leitura conecta investimento de campanhas de aquisição de profissionais à qualidade operacional já medida pelo funil e pela recorrência do Agenda Fashion.

Ela responde, de forma descritiva, quanto investimento foi registrado no período por campanha oficial e qual foi o custo observado por profissional oficialmente atribuído e por profissional que chegou ao primeiro agendamento.

Ela não redefine CAC, ROAS, receita atribuída ou regras de orçamento.

## Fontes de verdade

O investimento usa `marketing_campanha_gastos` e considera somente valores em BRL de campanhas com `marketing_campanhas.objetivo = 'profissional'`.

A qualidade do profissional continua vindo da coorte de recorrência. O primeiro, segundo e terceiro agendamento são derivados de registros reais de `agendamentos`, excluindo status `cancelado`, conforme a metodologia já documentada em `docs/marketing-attribution.md`.

A ligação entre investimento e qualidade usa exclusivamente `campanha_oficial_id`. Nome, UTM textual ou origem isolada não são usados como chave financeira.

## Alinhamento temporal

O gasto e a coorte usam a mesma seleção de período operacional e a mesma referência `America/Sao_Paulo` já usada pelos relatórios administrativos de marketing.

Isso produz uma leitura alinhada do período, mas não significa que cada centavo de gasto tenha sido atribuído individualmente a uma pessoa específica.

## Métricas permitidas neste estágio

Para cada campanha profissional oficial, o painel pode mostrar:

- investimento registrado no período;
- dias com gasto registrado;
- profissionais oficialmente atribuídos à campanha;
- custo observado por profissional oficialmente atribuído, calculado como investimento do período dividido pelos profissionais oficiais da campanha no mesmo período;
- profissionais que chegaram ao primeiro agendamento;
- custo observado por profissional com primeiro agendamento, calculado como investimento do período dividido pelos profissionais oficiais da campanha que chegaram a esse marco;
- recorrência madura D7, D14 e D30 como contexto de qualidade, sem converter essas taxas em custo financeiro.

Os dois custos acima devem ser chamados de **custo observado**, não de CAC.

## Por que não existe custo por recorrente D7, D14 ou D30 neste estágio

A maturidade das janelas de recorrência é definida a partir da idade do primeiro agendamento. O investimento agregado do período, porém, inclui aquisições que podem ainda não ter chegado ao primeiro agendamento ou que chegaram recentemente e ainda não tiveram tempo de completar D7, D14 ou D30.

Dividir todo o investimento do período apenas pelos recorrentes maduros misturaria um numerador com aquisições ainda censuradas por tempo. O resultado pareceria preciso, mas poderia superestimar ou distorcer o custo por recorrente.

Por isso, o AF mostra D7, D14 e D30 ao lado do investimento como contexto de qualidade, mas não calcula custo por recorrente até existir uma regra de coorte financeira que alinhe investimento e maturidade de forma verificável.

## Qualidade da atribuição

A leitura preserva as classificações existentes do backend:

- `oficial`;
- `organico`;
- `rastreamento_incompleto`;
- `identidade_nao_oficial`;
- `sem_evidencia`.

A cobertura paga observada é calculada apenas sobre sinais pagos classificáveis: `oficial / (oficial + rastreamento_incompleto + identidade_nao_oficial)`.

Profissionais `sem_evidencia` são exibidos separadamente porque não devem ser presumidos como orgânicos nem como pagos.

Quando existe rastreamento incompleto, identidade não oficial ou ausência de evidência, o custo continua podendo aparecer como diagnóstico **observado com medição incompleta**, mas não pode ser promovido a CAC, ROAS ou recomendação automática de orçamento.

## Casos que não podem ser ocultados

Uma campanha profissional com investimento registrado e zero profissionais oficialmente atribuídos deve continuar visível. Esse estado é classificado como `investimento_sem_profissional_atribuido` e serve para localizar falhas de aquisição, atribuição ou qualidade de tráfego.

Uma campanha com profissionais oficialmente atribuídos, mas sem gasto registrado no período, deve aparecer como `sem_investimento_registrado`; o sistema não inventa custo zero nem custo financeiro.

## Decisões de orçamento

Esta camada é diagnóstica. Nenhum dos valores novos libera aumento de orçamento, pausa automática de campanha ou conclusão de rentabilidade.

Decisões financeiras continuam exigindo cobertura de atribuição adequada, custo confiável, maturidade suficiente, receita comprovável quando aplicável e amostra compatível com a decisão.
