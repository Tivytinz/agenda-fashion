# Growth do Agenda Fashion

> Estrategia e cobertura implementada revisadas contra a `main` em 26 de agosto de 2026.

## Fase atual

O AF esta na fase de aquisicao, ativacao, retencao e monetizacao. O objetivo nao e maximizar cliques ou cadastros isolados, e sim aumentar o numero de negocios que chegam a valor real, recebem agendamentos e permanecem no produto.

As prioridades sao:

1. atrair profissionais de beleza qualificados;
2. transformar cadastros em negocios ativos;
3. conduzir o negocio ate capacidade real de receber agendamentos;
4. gerar o primeiro agendamento e recorrencia;
5. converter o plano Grátis para pago quando houver necessidade real de capacidade;
6. reter profissionais, negocios e clientes finais;
7. crescer sem sacrificar estabilidade, seguranca ou experiencia.

## Funil estrategico completo

O funil que deve orientar decisoes de produto e growth e:

`anuncio -> cadastro profissional -> negocio criado -> servico cadastrado -> agenda configurada -> primeiro agendamento -> recorrencia -> checkout -> pagamento -> retencao`

Nem toda tela precisa mostrar todas as etapas, mas uma recomendacao de growth nao deve otimizar uma etapa intermediaria ignorando as seguintes.

## Cobertura atualmente implementada no painel de trafego pago

O service `adminProfessionalFunnelService` atualmente agrega por campanha:

- cadastros;
- negocios criados;
- servicos criados;
- agendas configuradas;
- negocios publicados;
- checkouts iniciados;
- assinaturas ativadas;
- investimento;
- receita do primeiro pagamento.

Ele calcula taxas de negocio, servico, agenda, publicacao, checkout e assinatura, alem de custo por cadastro, custo por checkout, CAC de assinante e ROAS quando ha investimento atribuido.

### Lacuna conhecida

O funil de trafego pago **ainda nao expoe diretamente primeiro agendamento, recorrencia de agendamentos e retencao por coorte dentro de `adminProfessionalFunnelService`**.

Existem eventos de produto para `agendamento_iniciado` e `agendamento_concluido`, alem de dados de agendamentos no sistema, mas isso nao significa que essas etapas ja estejam incorporadas ao funil pago atual. Nao apresentar o painel como cobertura completa do funil estrategico ate que essas etapas estejam calculadas e testadas no codigo.

Essa distincao e obrigatoria: documentar a meta futura como se ja estivesse implementada produziria uma leitura enganosa do crescimento.

## Qualidade da aquisicao

CTR, CPC, CPM, impressoes e sessoes sao metricas de diagnostico de aquisicao. Volume bruto de cadastro tambem nao e resultado final.

Uma campanha pode ter CPC maior e ainda ser melhor se trouxer profissionais que:

1. criam negocio;
2. cadastram servico;
3. configuram a operacao;
4. publicam o perfil;
5. recebem uso real;
6. convertem e permanecem.

Buscas por `gratis`, `gratuito` e variacoes sao compativeis com a oferta real do AF e nao devem ser negativadas automaticamente. O plano gratuito e parte do mecanismo de aquisicao e ativacao.

## Decisoes de campanha atualmente implementadas

O backend possui logica de recomendacao de campanha com estados como observar, revisar, manter, escalar e pausar. A decisao considera investimento, volume minimo, assinaturas ativadas e ROAS, com parametros configuraveis por ambiente.

Essas recomendacoes so sao confiaveis quando a atribuicao de campanha e o investimento sao confiaveis. Campanhas com rastreamento incompleto nao devem ser promovidas artificialmente a oficiais para melhorar os numeros.

## Marketplace de dois lados

Growth precisa observar simultaneamente:

- **oferta**: negocios publicados, servicos ativos, profissionais e disponibilidade;
- **demanda**: clientes procurando, visualizando perfis e concluindo agendamentos.

Mais oferta sem demanda suficiente reduz valor percebido pelo negocio. Mais demanda sem oferta relevante aumenta busca sem resultado e abandono.

## KPIs recomendados por etapa

Quando os dados existirem com qualidade suficiente, priorizar:

- custo por cadastro profissional qualificado;
- cadastro -> negocio criado;
- negocio -> primeiro servico ativo;
- negocio -> publicacao;
- tempo ate primeiro agendamento;
- negocio publicado -> primeiro agendamento;
- recorrencia de clientes e agendamentos;
- negocios ativos por periodo;
- conversao Grátis -> pago;
- CAC de assinante;
- receita recorrente;
- churn e retencao por coorte;
- LTV e payback somente com historico suficiente;
- ROAS somente com receita e atribuicao confiaveis.

## Regra para novos indicadores

Nao adicionar KPI apenas porque ele e facil de medir. Antes de promover uma metrica a KPI, responder:

1. qual etapa do funil ela representa?
2. qual entidade ela mede: profissional, negocio ou cliente final?
3. ela mede atividade ou valor entregue?
4. existe denominador claro?
5. a atribuicao e confiavel?
6. o dado pode ser auditado no banco ou no provedor?

## Referencias tecnicas

- funil pago: `src/services/adminProfessionalFunnelService.js`;
- persistencia do funil: `database/migrations/032_marketing_funil_profissionais.sql`;
- eventos de produto: `src/services/eventoProdutoService.js` e `database/migrations/023_eventos_produto.sql`;
- custos automaticos: `src/services/marketingCostSyncService.js`, `src/services/marketingCostSyncWorker.js` e `database/migrations/037_marketing_custos_automaticos.sql`;
- reconciliacao mais recente de campanhas/custos: `database/migrations/057_reconciliacao_campanhas_custos.sql`;
- planos e oferta gratuita: `docs/planos.md`.