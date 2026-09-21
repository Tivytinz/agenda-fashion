# Estratégia de conteúdo do Agenda Fashion

## Objetivo

Esta documentação orienta a criação de conteúdo orgânico e promocional do Agenda Fashion (AF) a partir do estado real do produto, do funil e das evidências disponíveis.

O objetivo não é produzir peças apenas porque parecem bonitas ou seguem uma tendência. Cada conteúdo deve responder a uma necessidade concreta de aquisição, ativação, prova de produto, crescimento, monetização, retenção ou marca.

Conteúdo deve acompanhar a evolução do AF. Uma mensagem adequada quando o gargalo é aquisição pode deixar de ser prioritária quando o principal problema passa a ser primeiro agendamento, recorrência ou monetização.

## Fonte de verdade

Antes de afirmar que o AF possui uma funcionalidade, fluxo, plano, limite, integração ou benefício específico, verificar o estado atual do repositório.

A prioridade é:

1. código executável e migrations;
2. testes;
3. `AGENTS.md` e documentos especializados;
4. dados atuais de analytics e campanhas quando a afirmação depender deles;
5. materiais criativos e conversas anteriores apenas como referência secundária.

Não anunciar roadmap, hipótese, mockup, tela gerada por IA ou comportamento antigo como se já estivesse implementado.

Quando uma peça mostrar a interface do produto, priorizar captura, gravação ou composição baseada na interface real do AF.

## Públicos

Não misturar públicos na mesma promessa sem necessidade clara.

### Profissional

Pessoa que presta serviços de beleza e estética.

Conteúdos podem abordar:

- organização da agenda;
- redução de trabalho manual;
- recebimento de agendamentos;
- divulgação do perfil;
- rotina de atendimento;
- crescimento do negócio;
- recorrência e relacionamento com clientes.

### Negócio

Unidade operacional que possui serviços, equipe, agenda, plano e perfil público.

Conteúdos podem abordar:

- gestão de serviços;
- equipe;
- agenda;
- operação;
- crescimento;
- assinaturas e capacidade;
- indicadores do negócio.

### Cliente final

Pessoa que encontra e agenda serviços.

Conteúdos podem abordar:

- descoberta;
- conveniência;
- disponibilidade;
- agendamento simples;
- confiança;
- experiência mobile.

## Funil principal

Para aquisição e ativação profissional, alinhar conteúdo ao funil canônico:

```text
origem/anúncio
  → cadastro profissional
  → negócio criado
  → serviço ativo
  → negócio publicado
  → primeiro agendamento válido
  → checkout iniciado
  → pagamento/assinatura
  → recorrência e retenção
```

Clique, visita, cadastro, negócio criado, compartilhamento, checkout e pagamento são fatos diferentes.

Um conteúdo só deve ser considerado bem-sucedido quando for analisado conforme o objetivo que pretendia melhorar. Curtidas, visualizações e CTR podem ser sinais úteis, mas não substituem ativação, primeiro agendamento, assinatura, recorrência ou retenção quando esses forem os objetivos reais.

## Processo de criação

Toda peça relevante deve nascer desta sequência:

```text
problema ou oportunidade
  → público
  → etapa do funil
  → hipótese de comunicação
  → mensagem
  → formato
  → CTA
  → medição
```

Antes de produzir, responder:

- para quem é esta peça;
- qual problema ela comunica;
- qual etapa do funil pretende melhorar;
- qual comportamento o CTA pede;
- como o resultado será observado.

## Pilares editoriais

### Aquisição

Objetivo: gerar descoberta qualificada do AF.

Temas possíveis:

- problemas de agenda manual;
- excesso de mensagens no WhatsApp;
- dificuldade de organizar horários;
- apresentação simples da proposta de valor;
- rotina de profissionais de beleza.

Exemplo de direção:

> Enquanto você atende uma cliente, outra pode agendar.

A peça deve comunicar o benefício sem prometer resultado financeiro não comprovado.

### Ativação

Objetivo: ajudar a transformar cadastro em negócio utilizável e primeiro agendamento.

Temas possíveis:

- criar o negócio;
- cadastrar serviço;
- publicar o perfil;
- compartilhar o link;
- conquistar o primeiro agendamento.

A mensagem deve respeitar a regra atual de produto: horários não são gate de publicação.

### Prova de produto

Objetivo: tornar o funcionamento do AF compreensível.

Priorizar:

- gravação real do produto;
- fluxo real de agendamento;
- notificações e confirmações compatíveis com o comportamento implementado;
- telas reais;
- situações de uso plausíveis.

Evitar interfaces fictícias produzidas por IA quando puderem ser confundidas com o produto real.

### Crescimento

Objetivo: mostrar como o AF ajuda um negócio já ativado a operar e crescer.

Temas possíveis:

- mais organização;
- acompanhamento de agendamentos;
- serviços com tração;
- conversão de visitas em reservas;
- recorrência;
- divulgação do perfil;
- oportunidades indicadas pelo produto quando efetivamente disponíveis.

Não transformar heurísticas internas em garantia causal.

### Monetização

Objetivo: explicar capacidade, planos e upgrade no momento adequado.

O plano gratuito deve continuar sendo comunicado como oferta real de valor.

Não usar pressão por upgrade antes de o conteúdo explicar claramente o valor que o profissional consegue obter.

Preços, limites e regras de plano devem sempre ser verificados no backend e na documentação vigente antes da publicação.

### Marca

Objetivo: construir reconhecimento e confiança.

A identidade deve permanecer ligada a:

- rosa;
- branco;
- grafite;
- universo de beleza;
- linguagem acolhedora;
- simplicidade;
- organização;
- mobile;
- símbolo oficial da marca.

Arquivos oficiais da marca ficam em `frontend/src/assets/brand/`.

## Formatos

### Reels

Usar quando movimento, demonstração ou rotina ajudarem a explicar a proposta.

Boas aplicações:

- profissional atendendo enquanto o AF recebe um agendamento;
- gravação curta do fluxo real;
- antes/depois de uma rotina operacional;
- demonstração visual de um benefício.

O gancho deve aparecer cedo. Evitar introduções longas antes da mensagem principal.

### Stories

Usar para:

- chamada rápida;
- prova social válida;
- bastidores;
- educação curta;
- direcionamento para ação;
- sequência de perguntas e respostas.

### Carrossel

Usar quando o entendimento melhora com progressão:

- problema;
- explicação;
- solução;
- benefício;
- CTA.

### Post estático

Usar para mensagens simples de marca, posicionamento ou anúncio que não dependam de demonstração.

## Tom de voz

O AF deve soar:

- claro;
- próximo;
- profissional;
- simples;
- ligado ao universo de beleza;
- confiante sem exagero.

Evitar:

- promessas absolutas;
- linguagem excessivamente corporativa;
- excesso de termos técnicos para cliente ou profissional;
- frases que impliquem faturamento garantido;
- urgência artificial;
- alegações que os dados não sustentam.

## CTA

O CTA deve refletir o estágio do conteúdo.

Exemplos:

- aquisição: conhecer o AF;
- ativação: cadastrar serviço;
- publicação: compartilhar perfil;
- primeiro agendamento: divulgar o link;
- produto: experimentar o fluxo;
- monetização: conhecer ou comparar planos quando aplicável.

Não usar checkout, cadastro ou clique como sinônimo de receita.

## Métricas, números e simulações

Métricas exibidas em criativos precisam ser classificadas corretamente.

### Dados reais

Só podem ser tratados como dados reais quando houver fonte verificável e contexto suficiente.

### Simulações

Números ilustrativos devem estar claramente identificados como simulação, demonstração ou exemplo.

Exemplo aceitável:

```text
Simulação
Agendamentos: 28 → 41 → 57
```

Isso não pode ser usado para afirmar que o AF produzirá esse resultado para um profissional.

Evitar frases como:

- "você vai faturar X";
- "o AF vai dobrar seus agendamentos";
- "resultado garantido".

Sem evidência adequada, preferir benefícios descritivos:

- mais organização;
- menos trabalho manual;
- facilitar o recebimento de agendamentos;
- acompanhar a evolução da agenda.

## Experimentação

Um experimento de conteúdo deve registrar pelo menos:

- hipótese;
- público;
- etapa do funil;
- formato;
- gancho;
- CTA;
- período;
- fonte de aquisição quando aplicável;
- resultado observado.

Um experimento isolado não vira regra permanente.

## Aprendizado de conteúdo

A evolução ocorre em três níveis.

### 1. Hipótese

Exemplo:

```text
Mostrar a profissional trabalhando enquanto o AF recebe agendamentos
pode comunicar melhor automação do que uma peça institucional estática.
```

Isso ainda não é uma regra.

### 2. Evidência

A hipótese deve ser observada por sinais coerentes com o objetivo, por exemplo:

```text
visualização
  → visita ao perfil/landing page
  → cadastro profissional
  → negócio criado
  → primeiro agendamento válido
```

A análise deve respeitar maturidade, amostra e cobertura de atribuição.

### 3. Aprendizado durável

Somente padrões repetidos e suficientemente sustentados devem ser adicionados à seção de aprendizados permanentes.

Não promover para memória permanente:

- resultado de um único post;
- número momentâneo de visualizações;
- CTR isolado;
- comentário individual;
- tendência passageira;
- resultado sem atribuição adequada.

## Aprendizados duráveis validados

Esta seção deve ser atualizada apenas quando houver evidência suficiente.

No estado atual, não existe base no repositório que permita declarar um formato, gancho ou mensagem como vencedor permanente.

## Relação com analytics

Conteúdo deve ser analisado pelo resultado posterior do funil quando houver rastreamento suficiente.

Para aquisição profissional, priorizar:

- custo por profissional ativado;
- progressão até primeiro agendamento válido;
- assinatura paga quando a coorte estiver madura;
- recorrência e retenção.

Não concluir que conteúdo ou campanha é bom apenas por CTR, CPC, CPM, visualização ou cadastro bruto.

## Atualização desta memória

Atualizar este documento quando houver mudança durável em:

- posicionamento;
- público prioritário;
- proposta de valor;
- pilares editoriais;
- política de claims;
- processo de experimentação;
- padrão de criação comprovadamente melhor.

Não armazenar aqui:

- calendário editorial da semana;
- resultado de um post específico;
- saldo de mídia;
- campanha temporária;
- tendência passageira;
- roteiro de um único anúncio.

Esses itens pertencem a documentos operacionais temporários, ferramentas de campanha ou relatórios.
