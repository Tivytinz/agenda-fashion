# Memoria operacional do Agenda Fashion

> Contexto permanente para agentes de desenvolvimento. Atualizado em 26 de
> agosto de 2026.

Este arquivo deve ser lido antes de analisar, planejar ou alterar o projeto.
Ele registra a direcao do produto e as regras que nao podem ser perdidas entre
conversas, sprints ou agentes diferentes.

## Objetivo principal

O objetivo do Agenda Fashion (AF) e **se tornar referencia no Brasil para
agendamento de beleza e estetica**.

O AF nao e apenas uma agenda digital. Ele deve conectar clientes a
profissionais e negocios, facilitar a descoberta de servicos e transformar a
busca por beleza e estetica em um agendamento simples, seguro e confiavel.

## Fase atual do produto

O AF ja possui produto funcional e esta na fase de **aquisicao, ativacao,
retencao e monetizacao**.

As prioridades atuais sao, nesta ordem logica de jornada:

1. atrair profissionais e negocios de beleza qualificados;
2. transformar cadastros em negocios realmente configurados e ativos;
3. ajudar esses negocios a receberem o primeiro agendamento;
4. aumentar recorrencia de agendamentos e uso real do produto;
5. converter usuarios gratuitos para planos pagos quando precisarem de mais
   capacidade;
6. reter profissionais, negocios e clientes finais;
7. crescer sem comprometer estabilidade, seguranca, privacidade ou experiencia.

Clique, impressao, visita, cadastro ou checkout isolado nao representam sucesso
por si so. O AF deve analisar a jornada completa e a qualidade de cada etapa.

O funil principal de crescimento e:

`anuncio -> cadastro profissional -> negocio criado -> servico cadastrado -> agenda configurada -> primeiro agendamento -> recorrencia -> checkout -> pagamento -> retencao`

Nem toda analise precisa conter todas as etapas, mas nenhuma recomendacao de
growth deve otimizar uma etapa intermediaria ignorando o impacto nas etapas
seguintes.

## Entidades que nunca devem ser confundidas

Os eventos, relatorios, dashboards, analises e recomendacoes devem distinguir:

- **profissional**: pessoa que trabalha no negocio e pode prestar servicos;
- **negocio**: unidade comercial/perfil publico que oferece servicos e possui
  agenda, configuracoes, plano e capacidade;
- **cliente final**: pessoa que descobre servicos e realiza agendamentos.

Um cadastro profissional nao equivale automaticamente a um negocio ativo. Um
negocio criado nao equivale a um negocio pronto para receber agendamentos. Um
cliente cadastrado nao equivale a um agendamento. Um checkout iniciado nao
equivale a receita.

Sempre que uma metrica puder ser interpretada por mais de uma dessas entidades,
o nome do evento, coluna, card ou KPI deve deixar a entidade explicita.

## Modelo de sucesso e KPIs

O AF deve preferir indicadores conectados a valor real do produto.

Indicadores importantes incluem, conforme o contexto:

- custo por cadastro profissional qualificado;
- taxa de cadastro profissional -> negocio criado;
- taxa de negocio criado -> primeiro servico ativo;
- taxa de negocio configurado -> primeiro agendamento;
- tempo ate o primeiro agendamento;
- negocios ativos por periodo;
- clientes finais que concluem agendamento;
- taxa de recorrencia de agendamentos;
- ocupacao/capacidade utilizada do negocio;
- conversao Gratis -> plano pago;
- receita recorrente, churn e retencao por coorte;
- CAC, LTV e payback quando os dados forem maduros o suficiente;
- ROAS somente quando receita e atribuicao forem confiaveis.

CTR, CPC, CPM, impressoes, sessoes e volume bruto de cadastros sao metricas de
diagnostico e aquisicao. Elas nao devem ser tratadas automaticamente como KPI
final de negocio.

Uma campanha com CTR menor pode ser melhor se trouxer profissionais que ativam
o negocio, recebem agendamentos e permanecem no produto. Uma campanha com
cadastros baratos pode ser ruim se esses usuarios nao configurarem o negocio ou
nao gerarem uso real.

## Proposta de valor

Para profissionais e negocios, o AF deve deixar claro que:

1. e possivel comecar gratis;
2. o perfil publico ajuda a conquistar novos clientes;
3. clientes podem escolher servico, profissional, data e horario sem depender
   de atendimento manual para marcar;
4. o AF avisa sobre agendamentos pelo WhatsApp;
5. o dashboard mostra agenda, ocupacao e crescimento do negocio;
6. o produto reduz trabalho operacional e devolve tempo a profissional.

Para clientes, o AF deve permitir:

1. descobrir profissionais, studios, clinicas e saloes;
2. comparar servicos e informacoes relevantes;
3. consultar disponibilidade real;
4. agendar com poucos passos;
5. acompanhar seus agendamentos com confianca.

## Publico e mercado

- Mercado principal: Brasil.
- Segmentos: beleza e estetica.
- Oferta: profissionais autonomos, studios, saloes, clinicas e outros negocios
  compativeis com agendamento.
- Demanda: pessoas procurando servicos e horarios disponiveis.

O crescimento deve equilibrar os dois lados do marketplace: sem negocios e
horarios de qualidade nao existe boa descoberta; sem clientes e agendamentos o
AF nao demonstra valor para os negocios.

## Principios de growth

- Crescimento deve ser analisado como sistema, nao como soma de campanhas.
- Aquisicao sem ativacao nao e crescimento sustentavel.
- Ativacao sem disponibilidade real de servicos e horarios nao gera boa
  experiencia para a cliente.
- Oferta sem demanda suficiente reduz a percepcao de valor para o negocio.
- Demanda sem oferta relevante aumenta buscas sem resultado e abandono.
- Incentivos, onboarding e mensagens devem ajudar o usuario a chegar ao valor do
  produto, nao apenas aumentar contadores internos.
- O plano Gratis deve ser usado como mecanismo real de aquisicao e ativacao,
  sem esconder sua existencia ou criar friccao artificial para forcar upgrade.
- Upgrade deve aparecer quando o usuario encontrar um limite real de capacidade
  ou enxergar valor suficiente para desejar mais recursos.
- Toda recomendacao de marketing pago deve considerar qualidade pos-clique e
  nao somente custo de trafego.
- SEO, conteudo, indicacoes, compartilhamento de perfis e descoberta organica
  fazem parte da estrategia de aquisicao e nao devem ser tratados como canais
  secundarios por padrao.

## Principios de produto

- O AF deve evoluir continuamente em produto, tecnologia, seguranca, UX e
  operacao, sempre em direcao ao objetivo de se tornar referencia no Brasil.
- Evolucao nunca deve significar instabilidade: nenhuma melhoria pode quebrar
  um fluxo que ja funciona ou introduzir uma regressao conhecida.
- A cliente deve conseguir agendar sem precisar conversar com o negocio.
- O WhatsApp complementa o fluxo com avisos; ele nao deve ser obrigatorio para
  concluir manualmente cada agendamento.
- Clientes com conta controlam os avisos de agendamento no cadastro e em Minha
  Conta; cadastros anteriores sem evidencia auditavel de consentimento ficam
  desativados ate a cliente autorizar explicitamente.
- O plano gratuito deve entregar valor real antes de qualquer pressao por
  upgrade.
- O perfil publico de cada negocio e uma ferramenta de aquisicao e deve ter
  link curto, estavel, compartilhavel e indexavel quando publicado.
- A descricao do negocio melhora a qualidade do perfil, mas e opcional e nao
  pode bloquear a publicacao; especialidade, WhatsApp, cidade, estado e ao
  menos um servico ativo formam os requisitos minimos de descoberta.
- Links antigos de perfis devem continuar funcionando quando o slug mudar.
- O dashboard deve traduzir dados em crescimento compreensivel, nao apenas
  exibir numeros soltos.
- A experiencia deve ser simples no celular, inclusive em telas pequenas e no
  Safari/WebKit.
- Estados de carregamento, vazio, erro, sucesso e sessao expirada fazem parte
  do fluxo e devem ser tratados.
- Privacidade, isolamento entre negocios e confiabilidade de horarios sao
  requisitos de produto, nao melhorias opcionais.

## Identidade do AF

- Nome: Agenda Fashion.
- Sigla: AF.
- Dominio principal: `https://app.agendafashion.com.br`.
- Identidade visual: rosa, acolhedora, moderna e ligada ao universo de beleza.
- Paleta de interface: rosa, branco e grafite suave. Vinho nao deve ser usado
  como cor dominante ou como substituto do grafite nos textos e superficies.
- A organizacao visual pode usar destaque amplo, hierarquia limpa e fileiras
  horizontais inspiradas em catalogos de streaming, sem copiar outra marca e
  sem descaracterizar o Agenda Fashion.
- A home publica segue o prototipo aprovado: cabecalho com Inicio, Favoritos,
  Meus agendamentos, busca e foto da conta; a busca substitui o atalho
  redundante "Buscar servicos". O banner nao possui campo de busca interno e
  funciona como carrossel navegavel.
- A home nao pode inferir a localizacao da cliente pela cidade do primeiro
  negocio retornado. A cliente escolhe manualmente entre "Todo o Brasil" e as
  cidades com oferta publicada; a escolha fica salva no navegador. Sem uma
  localizacao escolhida ou autorizada, usar contexto nacional e nao afirmar
  que os resultados estao perto.
- Cada categoria da home possui uma foto panoramica propria para o carrossel.
  As fotos editoriais ficam somente no banner; os cards de navegacao, perfis e
  servicos sem foto cadastrada mantem o fallback antigo com o icone da
  categoria para preservar a identidade visual do AF.
- Emojis fazem parte da comunicacao da marca quando ajudam a leitura, sem
  substituir acessibilidade ou clareza.
- Usar os arquivos oficiais de marca existentes em
  `frontend/src/assets/brand/`; nao criar logotipos substitutos.

## Descoberta e marketplace

A home e as superficies publicas devem facilitar descoberta e navegacao com
hierarquia simples, conteudo relevante e exploracao fluida. A referencia a
servicos de streaming serve apenas como principio de facilidade de descoberta,
organizacao e continuidade visual; o AF nao deve copiar identidade, layout ou
componentes proprietarios de outra marca.

Ao avaliar descoberta, considerar conjuntamente:

1. quantidade e qualidade de negocios publicados;
2. cobertura geografica real;
3. diversidade de categorias e servicos;
4. disponibilidade real de horarios;
5. buscas sem resultado;
6. visualizacao de perfil/servico;
7. inicio e conclusao de agendamento;
8. retorno da cliente para novos agendamentos.

## Planos oficiais

| Plano | Valor mensal | Agendamentos/mes | Profissionais | Servicos |
| --- | ---: | ---: | ---: | ---: |
| Gratis | R$ 0,00 | 10 | 1 | 2 |
| Autonoma | R$ 49,90 | 20 | 1 | 4 |
| Studio | R$ 99,90 | 30 | 1 | 10 |
| Salao | R$ 199,90 | Ilimitados | 5 | Ilimitados |

O plano Gratis e uma oferta ativa e entrega valor real, sem cobranca e sem
cartao. Seu slug interno permanece `inicial` por compatibilidade. Planos pagos
usam checkout por PIX e somente sao ativados depois da confirmacao autenticada
e idempotente do Asaas.

Em marketing, buscas por `gratis`, `gratuito` e variacoes sao compativeis com a
oferta do AF e nao devem ser negativadas automaticamente. A aquisicao gratuita,
a ativacao do negocio e a conversao para plano pago devem ser medidas como
etapas diferentes. Os detalhes ficam em `docs/planos.md`.

## Arquitetura atual

- Backend: Node.js 22, Express 5 e JavaScript CommonJS.
- Frontend: React 19, React Router 7, Vite 7 e CSS.
- Banco: PostgreSQL, acessado diretamente pelo pacote `pg`.
- Camadas: routes, controllers, services, repositories e PostgreSQL.
- Autenticacao: JWT em cookie `HttpOnly`, bcrypt e Google Identity. Tokens
  Bearer antigos continuam aceitos apenas durante a migracao compativel.
- Recuperacao de senha: link de uso unico enviado por e-mail, com token
  armazenado somente como hash e validade de 30 minutos.
- Imagens: Busboy, validacao de conteudo e Cloudinary.
- Pagamentos: Asaas com confirmacao por webhook idempotente.
- Notificacoes: WhatsApp Cloud API oficial da Meta.
- Conversas no WhatsApp: os quatro quebra-gelos oficiais possuem respostas
  livres somente dentro da janela iniciada pela pessoa, com deduplicacao pelo
  `wamid`, validacao do numero destinatario e flag operacional de ativacao.
- Ativacao de negocios: orientacoes de WhatsApp exigem consentimento explicito,
  ficam limitadas a tres mensagens no total, respeitam intervalo minimo de tres
  dias e param imediatamente quando a preferencia for desativada ou a pessoa
  responder PARAR MARKETING. Pedidos genericos SAIR, PARAR ou STOP interrompem
  todas as categorias, revogam os agendamentos ja consentidos para o numero e
  cancelam as mensagens ainda pendentes.
- Marketing: eventos de produto, atribuicao, GA4, Google Ads, Meta CAPI e
  leitura de custos de Google Ads e Meta Ads. A classificacao oficial de
  campanhas e resolvida no backend; cliques pagos sem `utm_campaign` permanecem
  como rastreamento incompleto e nao entram em CAC, ROAS ou recomendacoes.
  Atribuicao publicitaria, GA4 e Google Ads exigem consentimento opcional;
  rotas enviadas ao Google sao genericas, sem query strings, tokens, slugs ou
  referenciador. `ad_personalization` permanece negado e a revogacao apaga os
  identificadores opcionais da conta, registra historico auditavel e bloqueia
  eventos server-side.
- Testes backend: Jest, Supertest e PostgreSQL de teste.
- Testes frontend: Vitest e Testing Library.
- Testes de jornada: Playwright em Chromium e WebKit, com foco mobile.
- Qualidade: ESLint e `npm audit` no CI.
- CI/CD: GitHub Actions e Railway.
- Deploy: migrations antes da aplicacao e healthcheck em `/health/ready`.

Detalhes e regras de cada camada ficam em `docs/arquitetura.md`.

## Fonte de verdade e verificacao

Antes de afirmar que uma funcionalidade, integracao, evento, limite, rota,
tecnologia ou comportamento existe no AF, verificar o estado atual do
repositorio.

A ordem de confianca e:

1. codigo executavel e migrations aplicadas/previstas pelo repositorio;
2. testes que validam o comportamento atual;
3. configuracoes e contratos de integracao versionados;
4. documentacao tecnica atualizada;
5. este `AGENTS.md` como direcao, regra e contexto operacional.

Se a memoria ou documentacao disser que algo existe, mas o codigo nao
implementar esse comportamento, nao apresentar a intencao como fato. Registrar
a divergencia e tratar o codigo/migrations como estado implementado.

Dados mutaveis como numero de usuarios, receita, custos, campanhas ativas,
status de anuncios, volume de eventos e performance nao devem ser congelados
neste arquivo como verdade permanente. Para esses dados, consultar a fonte
operacional atual correspondente antes de analisar.

## Como analisar produto, growth e analytics

Ao receber uma solicitacao de analise:

1. definir qual entidade esta sendo analisada: profissional, negocio ou cliente;
2. identificar a etapa do funil;
3. separar volume, taxa, custo, qualidade e resultado final;
4. comparar periodos equivalentes quando houver dados historicos;
5. procurar gargalos antes de recomendar aumento de investimento;
6. diferenciar correlacao de causalidade;
7. nao transformar ausencia de dado em conclusao;
8. apontar problemas de instrumentacao quando a metrica nao for confiavel;
9. priorizar recomendacoes pelo impacto esperado no funil completo;
10. proteger experiencia, seguranca, privacidade e estabilidade mesmo quando
    houver oportunidade de crescimento.

Quando houver dados suficientes, segmentar por canal, campanha, dispositivo,
localidade, categoria de beleza, plano, coorte e etapa de ativacao. Evitar
segmentacoes que criem grupos pequenos demais para conclusoes confiaveis.

## Regras tecnicas obrigatorias

1. Analisar o impacto de toda mudanca no frontend, backend, banco, seguranca e
   testes.
2. Preservar fluxos que ja funcionam e evitar correcoes isoladas que quebrem a
   jornada completa.
3. Nao escrever SQL em routes ou controllers e nao adicionar SQL novo em
   services.
4. Nao confiar em `negocio_id`, papel, permissao, preco ou limite enviado pelo
   frontend.
5. Validar autenticacao, autorizacao e isolamento entre negocios no backend.
6. Usar transacao em operacoes criticas que alteram mais de uma tabela.
7. Toda alteracao de banco deve ter migration nova. Migration aplicada nunca
   deve ser reescrita.
8. Webhooks e operacoes financeiras devem ser autenticados e idempotentes.
9. Segredos nunca podem aparecer no Git, no frontend ou nos logs.
10. Manter contratos entre frontend e backend sincronizados.
11. Nao introduzir `/api` apenas em algumas rotas sem uma migracao planejada de
    todo o contrato.
12. Mudancas relevantes devem incluir testes proporcionais ao risco.
13. Antes de deploy, executar lint, build, Vitest, Jest e Playwright aplicavel.
14. Nao fazer deploy, push ou merge sem solicitacao explicita do usuario.

## Evolucao continua e segura

O AF deve melhorar constantemente, mas nenhuma entrega deve tratar velocidade
como justificativa para aceitar erros conhecidos. A meta operacional e evoluir
com previsibilidade e reduzir continuamente a possibilidade de falhas.

Para cada evolucao:

1. entender a causa e o fluxo completo antes de alterar o codigo;
2. preferir mudancas pequenas, modulares e reversiveis;
3. validar frontend, backend, banco, integracoes e seguranca afetados;
4. criar ou atualizar testes que reproduzam o comportamento esperado;
5. nao publicar com lint, build ou testes obrigatorios falhando;
6. nao fazer deploy cru: revisar o diff e executar os testes proporcionais ao
   risco antes da publicacao;
7. depois do deploy, realizar smoke tests e acompanhar healthcheck, logs,
   webhooks e metricas relevantes;
8. quando surgir uma falha, priorizar a causa raiz e proteger o comportamento
   com teste de regressao;
9. manter compatibilidade ou planejar uma migracao segura quando contratos,
   rotas, banco ou links publicos mudarem;
10. atualizar a documentacao para que a proxima evolucao parta do estado real
    do produto.

Nao existe garantia tecnica honesta de erro zero. Por isso, o padrao do AF e:
prevenir falhas, nao integrar erros conhecidos, detectar problemas cedo,
recuperar com seguranca e aprender com testes de regressao.

## Criterios de decisao

Ao comparar solucoes, priorizar nesta ordem:

1. confiabilidade do agendamento;
2. seguranca e privacidade;
3. experiencia da cliente e da profissional;
4. aquisicao, ativacao e retencao de negocios e clientes;
5. manutencao simples e codigo modular;
6. observabilidade e operacao previsivel;
7. monetizacao sustentavel;
8. custo de infraestrutura proporcional ao estagio do AF.

Nao reescrever o sistema ou adicionar uma tecnologia apenas por ser mais nova.
React, Node.js, Express e PostgreSQL continuam sendo a base oficial enquanto
atenderem bem ao produto. TypeScript pode ser adotado gradualmente quando
trouxer ganho concreto, sem reescrita total.

## O que pertence ou nao a esta memoria

Registrar aqui apenas informacoes duraveis que devam sobreviver a conversas e
sprints, como:

- objetivo e posicionamento do produto;
- definicoes das entidades principais;
- regras de negocio criticas;
- planos oficiais;
- arquitetura aprovada;
- principios de seguranca, UX, growth e analytics;
- criterios de decisao;
- contratos ou restricoes que nao podem ser esquecidos.

Nao registrar como regra permanente:

- numeros atuais de campanha;
- quantidade atual de usuarios;
- custos de um periodo especifico;
- bugs temporarios ja resolvidos;
- hipoteses ainda nao aprovadas;
- credenciais, tokens, chaves, IDs secretos ou dados pessoais;
- preferencias momentaneas que nao foram transformadas em decisao de produto.

## Como manter esta memoria atualizada

Ao concluir uma mudanca que altere objetivo, publico, proposta de valor,
arquitetura, integracao, infraestrutura, funil, plano, metrica principal ou
regra critica:

1. atualizar este `AGENTS.md` no mesmo conjunto de mudancas;
2. atualizar `docs/arquitetura.md` quando houver impacto tecnico;
3. atualizar a documentacao de produto/analytics correspondente quando houver
   impacto de negocio ou mensuracao;
4. registrar apenas o estado aprovado e atual, removendo orientacoes
   conflitantes;
5. conferir o codigo e as migrations antes de afirmar que uma tecnologia ou
   comportamento esta ativo;
6. manter a data no inicio deste arquivo atualizada.

Em caso de divergencia, o codigo executavel e as migrations representam o
estado implementado. Este arquivo representa a intencao e as regras do produto.
A divergencia deve ser corrigida na documentacao, nao ignorada.
