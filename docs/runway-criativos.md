# Playbook de criativos com Runway

> **Papel documental:** playbook especializado de produção de criativos com Runway. Não define o estado atual do produto, roadmap ou obrigação de uso desse fornecedor.

## Objetivo

Este documento registra regras duráveis para usar o Runway na produção de criativos do Agenda Fashion (AF) com o mínimo de desperdício de créditos.

Créditos de IA generativa devem ser tratados como orçamento de produção. Experimentação deve acontecer primeiro no conceito, roteiro, storyboard, referências e prompt. A geração paga entra somente depois que a direção estiver revisada.

Este playbook complementa `docs/estrategia-conteudo.md`: a estratégia de conteúdo define **o que comunicar e por quê**; este documento define **como transformar a ideia em vídeo sem desperdiçar créditos**.

## Princípio operacional

Evitar o fluxo:

```text
ideia
  → gerar
  → descobrir problema
  → gerar novamente
  → tentar corrigir por nova geração
```

Preferir:

```text
objetivo
  → roteiro
  → referências
  → storyboard
  → revisão
  → geração
  → edição
  → análise
  → aprendizado
```

Uma nova geração deve existir porque há uma mudança concreta de direção ou uma correção bem definida, não apenas porque a anterior "não ficou perfeita".

## Fonte de verdade

Runway é ferramenta de produção visual, não fonte de verdade do produto.

Antes de mostrar uma funcionalidade do AF:

1. verificar o produto atual;
2. usar captura ou gravação da interface real quando a UI for importante;
3. usar material oficial de marca;
4. tratar telas geradas por IA como ilustração, nunca como prova do produto.

Quando uma referência de marca for enviada ao Runway, ela ensina identidade visual, não o comportamento completo da interface.

## Baseline de custo observado

Em setembro de 2026, duas gerações consecutivas usadas neste projeto com vídeo vertical de 8 segundos, 720p e configuração rápida consumiram aproximadamente 232 créditos cada.

Esse valor é **baseline operacional observada**, não contrato de preço. Custos e planos podem mudar.

Antes de uma nova geração relevante:

- consultar o saldo atual da workspace;
- confirmar a configuração;
- considerar se o saldo comporta uma segunda tentativa;
- não assumir que o custo histórico continua igual.

Com um orçamento mensal de 625 créditos e o custo observado acima, a operação deve planejar aproximadamente duas gerações principais desse porte por ciclo, preservando margem para variações.

Não registrar saldo momentâneo de créditos como memória permanente.

## Divisão de responsabilidades

### Runway

Usar principalmente para:

- profissional atendendo;
- ambiente de salão;
- movimento de câmera;
- iluminação;
- atmosfera;
- cenas de rotina;
- transições cinematográficas;
- detalhes de beleza;
- objetos e ações simples.

### Produto real do AF

Usar para:

- tela de agendamento;
- calendário;
- horários;
- dashboard;
- cards;
- fluxos reais;
- estados do produto;
- textos de interface.

Preferir gravação de tela real ou composição derivada de captura real.

### Editor de vídeo

A pós-produção deve controlar:

- textos;
- CTA;
- notificações;
- números;
- métricas;
- logo;
- música;
- cortes;
- transições;
- timing;
- legendas;
- simulações claramente identificadas.

Para o fluxo atual, o CapCut no PC é adequado por permitir maior controle de camadas, keyframes, timing e alinhamento.

## Guardrails de geração

### Não depender do Runway para texto exato

Modelos de vídeo podem gerar letras erradas, palavras inventadas ou ortografia inconsistente.

Não pedir como requisito crítico:

- slogans;
- CTA;
- nomes de botões;
- labels;
- frases em português;
- números exatos;
- valores financeiros.

Adicionar tipografia na pós-produção.

### Não gerar interface detalhada do AF

Evitar pedir uma reprodução completa do aplicativo em vídeo generativo.

Problemas observados:

- calendários incoerentes;
- botões inventados;
- labels sem sentido;
- texto aleatório;
- interface diferente do produto real.

Quando a interface for parte central da mensagem, usar o AF real.

### Reduzir carga semântica

Não concentrar muitas tarefas em poucos segundos.

Evitar, por exemplo, em um vídeo de 8 segundos:

```text
profissional
+ cliente
+ notificações
+ celular
+ fluxo completo de booking
+ dashboard
+ números
+ logo
+ CTA
```

Preferir uma ou duas ideias visuais principais por geração.

### Simplificar interações físicas

Mãos, ferramentas e objetos pequenos aumentam o risco de artefatos quando há muitas interações simultâneas.

Se a cena já possui:

- profissional;
- cliente;
- mãos;
- pincel;
- cabine UV/LED;
- celular;

não adicionar outros objetos ou movimentos sem necessidade narrativa.

### Separar geração de informação

A cena gerada deve vender emoção, contexto e movimento.

Informação precisa deve ser adicionada depois.

Exemplo:

```text
Runway:
profissional atendendo enquanto o celular recebe sinais visuais discretos.

CapCut:
"Novo agendamento"
"Agendamento confirmado"
"Você atende. O Agenda Fashion cuida do agendamento."
```

## Padrões que já falharam

### Texto final gerado diretamente em vídeo

Resultado observado:

- ortografia incorreta;
- caracteres inventados;
- CTA inconsistente.

Decisão:

**texto final é responsabilidade da pós-produção.**

### Interface SaaS detalhada gerada pelo modelo

Resultado observado:

- calendário sem sentido;
- labels fictícios;
- botões inconsistentes;
- aparência que não representa o AF.

Decisão:

**interface crítica deve vir do produto real.**

### Quatro cenas, dashboard, texto e CTA em oito segundos

Resultado observado:

- excesso de informação;
- pouco tempo por conceito;
- maior chance de deformação e transição ruim.

Decisão:

**reduzir número de conceitos por geração e completar a narrativa na edição.**

### Métricas e faturamento dentro do vídeo generativo

Resultado observado:

- números e labels sem confiabilidade visual.

Decisão:

**métricas são compostas na edição ou em imagem controlada.**

## Padrões aprovados para novas tentativas

Até nova evidência, usar como padrão de produção:

- vertical 9:16 para Reels;
- cenário claro;
- rosa e branco;
- estética beauty-tech;
- profissional em atividade real;
- poucas ações simultâneas;
- ausência de texto crítico gerado;
- pós-produção no editor;
- interface real do AF quando necessária;
- CTA adicionado depois;
- notificações adicionadas como overlay.

"Padrão aprovado" significa decisão de produção baseada nos erros já observados, não evidência de melhor performance de marketing.

## Estrutura recomendada para comercial curto

Para um criativo de aproximadamente 6 a 8 segundos:

```text
0–3s
cena cinematográfica da profissional atendendo

3–6s
continuidade da rotina ou transição simples
+ overlays de notificação na edição

6–8s
marca/CTA composto na edição
```

Exemplo de overlays adicionados depois:

```text
Novo agendamento
Agendamento confirmado
Nova cliente
```

Somente usar notificações que sejam compatíveis com o comportamento real do produto ou claramente tratadas como linguagem publicitária.

## Uso de métricas simuladas

Se o criativo usar números ilustrativos, a indicação de simulação deve ser adicionada de forma legível na pós-produção.

Exemplo:

```text
Simulação
Agendamentos: 28 → 41 → 57
```

Nunca transformar números fictícios em depoimento, resultado real ou promessa de faturamento.

## Preflight obrigatório

Nenhuma geração paga relevante deve ser iniciada antes de validar:

- [ ] público definido;
- [ ] etapa do funil definida;
- [ ] objetivo da peça definido;
- [ ] mensagem principal aprovada;
- [ ] duração definida;
- [ ] número de cenas compatível com a duração;
- [ ] referência de marca correta;
- [ ] referência de ambiente/pessoa correta quando necessária;
- [ ] nenhuma UI crítica depende da IA;
- [ ] nenhum texto crítico depende da IA;
- [ ] nenhum número crítico depende da IA;
- [ ] plano de pós-produção definido;
- [ ] saldo atual verificado;
- [ ] prompt revisado;
- [ ] critérios de sucesso visual definidos.

Se um item crítico falhar, corrigir antes de gerar.

## Estratégia para orçamento de duas gerações

Quando o orçamento comportar aproximadamente duas gerações principais no ciclo:

### Geração 1 — master

Objetivo: produzir a melhor versão possível da cena base.

Ela deve partir de:

- roteiro aprovado;
- referência certa;
- prompt enxuto;
- poucos elementos;
- critérios claros.

### Geração 2 — correção estratégica

Não repetir a primeira por impulso.

Antes de gerar novamente:

1. analisar a master;
2. identificar no máximo três defeitos prioritários;
3. preservar o que funcionou;
4. alterar apenas o necessário;
5. decidir se o defeito realmente exige regeneração.

Se o problema puder ser resolvido no editor, não gastar uma segunda geração.

## Análise pós-geração

Depois de cada geração, registrar:

### O que funcionou

Exemplos:

- personagem;
- ambiente;
- enquadramento;
- luz;
- movimento;
- ferramenta;
- consistência da marca.

### O que falhou

Exemplos:

- mão deformada;
- objeto mudando de forma;
- texto inventado;
- UI falsa;
- transição abrupta;
- excesso de elementos.

### Tipo de correção

Classificar:

- `EDITAR`: resolver na pós-produção;
- `REAPROVEITAR`: usar apenas um trecho;
- `REGENERAR`: problema estrutural da cena;
- `DESCARTAR`: não serve como base.

Isso reduz regenerações desnecessárias.

## Aprendizado acumulado

Um erro deve virar regra quando:

- ocorreu de forma clara;
- existe causa plausível no pedido;
- a solução reduz risco futuro.

Um acerto deve virar padrão quando:

- é reproduzível;
- atende a identidade;
- melhora a produção;
- não depende de acaso específico.

Performance de marketing não deve ser inferida a partir da qualidade visual. Para afirmar que um tipo de criativo converte melhor, usar o processo de evidência de `docs/estrategia-conteudo.md`.

## Atualização deste playbook

Atualizar quando houver aprendizado durável sobre:

- custo por configuração;
- comportamento dos modelos;
- limites de texto/UI;
- referências;
- duração;
- composição;
- edição;
- processo de aprovação;
- reaproveitamento de ativos.

Não armazenar aqui:

- saldo atual;
- URL temporária de asset;
- task ID;
- resultado momentâneo de uma campanha;
- prompt descartável de uma única peça.

Esses itens são operacionais e envelhecem rapidamente.
