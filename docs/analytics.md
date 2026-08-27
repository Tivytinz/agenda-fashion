# Analytics e atribuicao do Agenda Fashion

> Estado revisado contra a `main` em 26 de agosto de 2026.

## Objetivo

Analytics no AF deve explicar comportamento e crescimento sem confundir atividade com resultado. Eventos e relatorios precisam preservar a diferenca entre conta, profissional, negocio e cliente final.

## Implementacao atual

O frontend possui modulos dedicados para:

- tracking interno de eventos de produto;
- Google Measurement/GA4 e Google Ads;
- Meta Ads;
- consentimento de marketing;
- testes automatizados desses modulos.

No backend existem services e rotas para eventos de produto, Google Measurement, Meta Ads, atribuicao persistente, custos de marketing e funil profissional.

As migrations atuais registram, entre outros pontos:

- eventos de produto (`023`);
- campanhas e gastos (`030`, `031`);
- funil profissional (`032`);
- consentimento Meta (`033`);
- Google Ads/GA4 (`034`);
- atribuicao persistente (`036`);
- custos automaticos (`037`);
- reconciliacao Google Ads (`042`);
- alinhamento da atribuicao do usuario (`051`);
- consentimento Google auditavel (`056`);
- reconciliacao de campanhas/custos (`057`).

## Eventos internos permitidos

O `eventoProdutoService` usa allowlist. Entre os eventos atualmente aceitos estao:

- `tela_visualizada`;
- `busca_realizada`;
- `categoria_selecionada`;
- `perfil_visualizado`;
- `servico_selecionado`;
- `profissional_selecionado`;
- `negocio_selecionado`;
- `agendamento_iniciado`;
- `agendamento_concluido`;
- `agendamento_cancelado`;
- eventos de copia/compartilhamento de links;
- eventos de dashboard e upgrade;
- eventos da landing para profissionais;
- `catalogo_local_visualizado`.

O service tambem restringe paginas, missoes e propriedades aceitas, limitando chaves e tamanhos antes de persistir.

Nao invente novo nome de evento apenas no frontend. Mudancas no contrato devem manter frontend, backend, persistencia e testes sincronizados.

## Atribuicao

A atribuicao trabalha com sinais como:

- `utm_source`, `utm_medium`, `utm_campaign`, `utm_content`, `utm_term`;
- `gclid`, `gbraid`, `wbraid`;
- `fbclid`;
- identificadores de outros provedores suportados pelo contrato;
- primeira e ultima atribuicao;
- landing page e host de referencia tratados pelo contrato.

A classificacao oficial da campanha e resolvida no backend. A UTM exata tem prioridade. Na ausencia dela, atribuicao assistida so deve ocorrer quando os vinculos persistidos e a reconciliacao do provedor tornam a identidade nao ambigua.

Rastreamento incompleto e identidade nao oficial nao devem entrar em CAC, ROAS ou recomendacoes como se fossem atribuicao confirmada.

A migration `057_reconciliacao_campanhas_custos.sql` faz parte do estado atual. Sincronizacoes anteriores a ela nao devem ser usadas como prova de reconciliacao moderna sem nova execucao do fluxo correspondente.

## Consentimento e privacidade

Atribuicao publicitaria, GA4/Google Ads e Meta devem respeitar os mecanismos de consentimento implementados. O codigo possui trilhas especificas para consentimento Meta e Google.

Regras duraveis:

- nao enviar dado publicitario opcional sem a base de consentimento exigida pelo fluxo;
- revogacao deve interromper processamento opcional correspondente;
- rotas enviadas a provedores devem evitar query strings, tokens e slugs quando a implementacao exigir rotas genericas;
- identificadores e propriedades devem ser sanitizados antes de persistencia/envio;
- nunca usar painel de terceiro como desculpa para misturar entidades internas.

## Entidades nos relatorios

Nomeie explicitamente o que esta sendo contado:

- `profissionais_cadastrados` e diferente de `negocios_criados`;
- `negocios_publicados` e diferente de `negocios_com_agendamento`;
- `clientes_finais` e diferente de contas profissionais;
- `checkouts_iniciados` e diferente de `assinaturas_ativadas`;
- `assinaturas_ativadas` e diferente de receita reconhecida se o criterio financeiro nao estiver satisfeito.

Evite cards genericos como `Usuarios`, `Conversoes` ou `Clientes` quando o significado puder ser ambiguo.

## Funil pago atual

O funil pago implementado cobre cadastro, negocio, servico, agenda, publicacao, checkout, assinatura, investimento e primeiro pagamento. Consulte `docs/growth.md` para as lacunas atuais de primeiro agendamento, recorrencia e retencao no funil pago.

## Qualidade de dados

Antes de usar uma metrica para decisao:

1. confirmar origem do dado;
2. verificar periodo e timezone;
3. identificar a entidade;
4. validar denominador de taxas;
5. separar organico de pago;
6. separar atribuicao oficial de incompleta;
7. nao somar fontes sobrepostas;
8. evitar ROAS quando receita ou investimento nao forem conciliados;
9. registrar metodo de classificacao quando ele afetar a leitura.

## Referencias tecnicas

- frontend: `frontend/src/analytics/`;
- contrato de eventos: `src/services/eventoProdutoService.js`;
- funil profissional: `src/services/adminProfessionalFunnelService.js`;
- Google: `src/services/googleMeasurementService.js`;
- Meta: `src/services/metaAdsService.js`;
- atribuicao de usuario: `src/services/marketingUserAttributionService.js`;
- custos: `src/services/marketingCostSyncService.js`;
- migrations `023`, `030` a `037`, `042`, `051`, `056` e `057`.