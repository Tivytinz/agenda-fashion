# Visão geral de Marketing do Admin

## Objetivo

A rota `/admin/trafego-pago` deve responder duas perguntas sem misturar fontes ou fabricar conversões:

1. de onde vem a aquisição;
2. quais origens trazem profissionais que avançam até primeiro agendamento válido e monetização.

A página é uma visão de decisão. Operações de OAuth, teste de conexão, vínculo e sincronização de plataformas permanecem no painel canônico de custos, em `/admin/trafego-pago/custos#integracoes-custos`.

## Fontes

- GA4: navegação, sessões, usuários, canais, landing pages, dispositivos e localização agregada.
- Banco do AF: cadastro profissional, negócio, serviço, agenda, publicação, primeiro agendamento válido, checkout, assinatura paga e receita.
- Atribuição do AF: classificação oficial, orgânica, rastreamento incompleto, identidade não oficial e ausência de evidência.

Sessão do GA4 não é cadastro e não pode ser usada como denominador automático para taxa de cadastro. Um usuário pode produzir várias sessões, e o recorte de navegação não representa necessariamente a mesma coorte comercial.

## Cobertura

`qualidadeMensuracao.coberturaAtribuicaoPagaPercentual` mede **cadastros pagos atribuídos**, calculados no backend sobre cadastros pagos classificáveis. A interface não deve chamar essa métrica de “percentual do tráfego pago identificado”.

A cobertura de sessões pagas é uma métrica separada, calculada a partir das sessões oficiais e das sessões pagas ainda pendentes de campanha/identidade. As duas coberturas podem divergir e devem continuar visíveis como conceitos diferentes.

## Coorte profissional

Os marcos do painel são:

- cadastro;
- negócio criado;
- serviço cadastrado;
- agenda configurada;
- negócio publicado;
- primeiro agendamento válido;
- checkout iniciado;
- assinatura paga.

Os percentuais desses marcos usam `cadastros` da coorte como denominador. Eles **não são conversões adjacentes**. Negócios legados podem permanecer publicados sem confirmação de agenda, então a contagem de publicados pode ser maior que a contagem de agendas configuradas.

A interface não deve usar conectores ou numeração que façam esses marcos parecerem uma sequência monotônica obrigatória.

## Qualidade da aquisição

A qualidade deve priorizar a coorte do AF, não volume bruto de sessão.

Para cada origem/campanha com evidência suficiente, a visão pode mostrar:

- cadastros profissionais;
- primeiro agendamento válido;
- taxa `primeiro agendamento / cadastros`;
- assinaturas pagas.

Campanhas classificadas como `oficial` podem sustentar leitura por campanha e, quando os demais guardrails permitirem, análises financeiras. Origem `organico` pode aparecer como qualidade comportamental sem ser tratada como campanha paga.

Classificações `rastreamento_incompleto`, `identidade_nao_oficial` e `sem_evidencia` permanecem visíveis para diagnóstico, mas não devem ser apresentadas como aquisição comprovada nem usadas para CAC, ROAS ou recomendação forte.

## Integrações

A saúde de Google Ads, Meta Ads, TikTok Ads e Pinterest Ads representa estado operacional atual e não o período selecionado na visão de Marketing.

Por isso, OAuth, teste de conexão, vínculos, última sincronização e sincronização manual ficam no painel `integracoes-custos`, que já concentra a operação canônica das integrações de mídia.

## Terminologia

- `primeirosAgendamentos` → “1º agendamento válido”; reservas canceladas não contam para a ativação canônica.
- `assinaturasAtivadas` → “Assinaturas pagas” quando a interface estiver descrevendo o marco comercial validado pelo primeiro pagamento elegível.
- checkout continua sendo intenção de compra, não receita.
- sessão e usuário do GA4 continuam sendo comportamento, não ativação ou monetização.

## Guardrails

Amostra pequena, maturidade insuficiente, atribuição incompleta ou ausência de custo continuam bloqueando conclusões fortes. A Visão Geral não deve recomendar aumento ou pausa de orçamento apenas por CTR, CPC, sessão, cadastro isolado ou ausência de assinatura em coorte ainda imatura.
