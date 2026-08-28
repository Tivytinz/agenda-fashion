# Marketing: sincronização de campanhas e GA4

## Objetivo

A área administrativa de Marketing do Agenda Fashion segue o princípio **sincronização + análise**. O fluxo normal não exige recriar no AF uma campanha que já existe no Google Ads ou Meta Ads.

A plataforma deve reduzir configuração manual sem perder auditabilidade, origem, qualidade da atribuição ou o funil real do produto.

## Sincronização de campanhas

Ao sincronizar Google Ads ou Meta Ads, o backend consulta as campanhas reais da conta configurada, compara com `marketing_campanha_vinculos` e cria, quando seguro, a identidade interna necessária para custos e atribuição.

Campanhas importadas automaticamente:

- usam o canal do provedor (`google` ou `meta`);
- usam `cpc` como mídia canônica inicial;
- usam o ID externo real da campanha como `utm_campaign` estável;
- começam com `objetivo = indefinido`;
- não recebem objetivo inferido pelo nome;
- não reativam campanhas internas arquivadas;
- não substituem silenciosamente vínculos existentes;
- criam campanha e vínculo na mesma transação;
- são serializadas por lock de reconciliação para evitar corrida entre worker e ação manual.

Se houver conflito ou ambiguidade, a campanha permanece pendente para revisão. O AF nunca inventa um vínculo para melhorar artificialmente a cobertura.

O administrador classifica uma campanha importada uma única vez como:

- `profissional`: aquisição de profissionais;
- `cliente`: aquisição de clientes.

Depois de definido, o objetivo continua imutável pelas regras existentes para preservar a leitura histórica.

A criação manual de campanha e o vínculo manual continuam disponíveis como fallback para canais ou situações que não possam ser sincronizados automaticamente.

## Custos e atribuição

A sincronização de campanhas acontece antes da reconciliação de custos e valida a conexão e a moeda da conta antes de criar qualquer identidade interna. O AF continua importando custos somente em BRL nesta versão.

As regras existentes de integridade permanecem válidas:

- UTM exata tem prioridade;
- atribuição assistida exige evidência externa verificável;
- tráfego ambíguo permanece fora de CAC, CPA, ROAS e recomendações por campanha;
- dados brutos de aquisição não são reescritos para caber em uma campanha oficial.

## Google Analytics 4

A coleta de GA4 já existente continua usando Consent Mode, rotas sanitizadas e Measurement Protocol quando aplicável. A leitura administrativa é uma camada separada feita pela **Google Analytics Data API**, exclusivamente no backend.

Variáveis da leitura administrativa:

```text
GA4_DATA_API_ENABLED
GA4_PROPERTY_ID
GA4_SERVICE_ACCOUNT_EMAIL
GA4_SERVICE_ACCOUNT_PRIVATE_KEY
GA4_DATA_API_TIMEOUT_MS
GA4_REPORTING_START_DATE
```

A conta de serviço deve possuir somente o acesso necessário de leitura à propriedade GA4. A chave privada nunca pode ser enviada ao navegador, registrada em log ou armazenada no Git.

O painel pode apresentar, entre outros:

- sessões;
- usuários e novos usuários;
- sessões engajadas e taxa de engajamento;
- visualizações;
- grupo de canais, origem e mídia;
- campanha e ID de campanha de sessão quando disponíveis;
- landing page sem query string;
- dispositivo;
- país, região e cidade de forma agregada.

Quando o GA4 sinalizar amostragem, perda por cardinalidade ou limiar de privacidade, o painel deve avisar que a leitura possui limitações.

### Exclusão da área administrativa

Rotas `/admin` e `/admin/*` são tráfego interno e não representam aquisição, ativação, retenção ou uso real do produto por profissionais, negócios ou clientes finais.

O frontend não deve inicializar nem enviar `page_view` do Google nessas rotas. Ao entrar na área administrativa, a coleta Google fica temporariamente negada no runtime sem alterar a preferência persistida da conta. Ao voltar para uma rota de produto, a medição pode ser retomada conforme o consentimento já concedido.

A leitura administrativa pela Data API também exclui sessões cuja `landingPage` começa com `/admin`. Essa segunda proteção evita que tráfego administrativo histórico distorça sessões, usuários, canais, campanhas, dispositivos, localidades e landing pages exibidos no painel.

A exclusão é baseada no prefixo `/admin`, e não em uma lista fechada de páginas, para que novas rotas administrativas também fiquem fora da mensuração por padrão.

## Fonte de verdade

GA4 explica **comportamento e navegação**. Ele não substitui o banco do Agenda Fashion como fonte canônica para resultado do produto.

Continuam vindo do backend/banco do AF:

1. cadastro profissional;
2. negócio criado;
3. serviço cadastrado;
4. negócio publicado;
5. primeiro agendamento;
6. checkout iniciado;
7. assinatura ativada e pagamento confirmado;
8. receita, CAC, CPA e ROAS atribuídos segundo as regras internas.

Uma indisponibilidade da Data API do GA4 não pode derrubar o painel de Marketing nem impedir os fluxos de aquisição, agendamento ou monetização.

## UX administrativa

A área administrativa usa **Marketing** como entrada única para aquisição e mensuração. Custos e funil continuam em rotas próprias, mas funcionam como subáreas da mesma seção e não como destinos concorrentes na navegação global.

A visão principal deve responder primeiro à jornada de negócio:

1. quantas sessões chegaram ao site segundo o GA4;
2. quantos profissionais se cadastraram;
3. quantos chegaram ao primeiro agendamento;
4. quantos ativaram assinatura.

Depois dessa leitura executiva, a tela aprofunda na seguinte ordem:

1. funil profissional completo, preservando os marcos reais do produto;
2. comportamento no GA4, priorizando canais, landing pages, campanhas, dispositivos e localização;
3. campanhas que o AF conseguiu reconhecer com evidência suficiente;
4. sincronização das plataformas como infraestrutura operacional secundária;
5. atalhos para custos e retorno e para o funil detalhado.

Cobertura de atribuição deve aparecer de forma compacta como sinal de confiança, sem duplicar cartões ou competir visualmente com os resultados do funil.

Cadastrar campanha manualmente não é a ação principal da tela.
