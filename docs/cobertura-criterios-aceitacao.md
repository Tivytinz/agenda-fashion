# Cobertura dos critérios de aceitação

> **Papel documental:** documento de evidência e rastreabilidade de cobertura. Não substitui regras canônicas de produto, arquitetura, segurança ou operação.

> Estado consolidado após a Wave 19 — 23/09/2026.
>
> Este documento registra rastreabilidade de implementação e não substitui a
> baseline funcional nem a matriz oficial de testes. Código executável,
> migrations e testes continuam sendo a evidência técnica do estado real.

## Estado P0

A baseline possui **60 cenários P0**. Após as Waves de cobertura concluídas,
todos os 60 possuem automação, evidência técnica compatível com o critério ou,
quando o próprio critério prevê essa saída, decisão formal de engenharia.

```text
Cobertura P0 da baseline: 60/60 (100%)
```

Essa porcentagem não significa que toda condição operacional externa já foi
comprovada em produção.

### Ressalva operacional de backup e recuperação

O `CA-NFR-07` permite como saída uma decisão formal de engenharia quando a
infraestrutura ainda não demonstra as metas exigidas. O AF adotou essa saída:

- a meta continua sendo RPO ≤ 1 hora e RTO ≤ 4 horas;
- o repositório possui runbook e condição de saída em
  `docs/backup-recovery.md`;
- a conformidade operacional com RPO/RTO **não deve ser declarada** enquanto
  não houver evidência de backup/PITR recorrente e restore test controlado com
  medição real.

Portanto, o P0 está coberto segundo o contrato da baseline, mas a evidência
operacional de recuperação continua pendente.

## Fechamentos recentes

### Wave 10 — identidade e autenticação profissional

Fechou os cenários P0 de identidade profissional na mesma conta:

- ativação do perfil profissional sem usuário duplicado;
- preservação de Client e histórico da identidade existente;
- ativação transacional em cadastro com intenção profissional, criação de
  negócio próprio e aceite válido de convite.

### Wave 11 — Analytics

Fechou os eventos críticos de booking no backend:

- `booking_created`;
- `booking_rescheduled`;
- `booking_cancelled`;
- `booking_completed`;
- `booking_no_show`.

Esses eventos são fatos de domínio persistidos em `analytics_eventos`, com
identificadores e ator derivados do estado persistido e dentro da mesma
transação lógica da mutação crítica.

### Wave 12 — não funcionais P0

Consolidou:

- retry/idempotência dos fluxos cobertos;
- instante canônico de agendamento em UTC/`TIMESTAMPTZ`;
- snapshot de fuso IANA por booking;
- conflito global de agenda entre contextos em fusos diferentes;
- cobertura de acessibilidade dos fluxos críticos;
- contrato do Quality Gate;
- runbook e decisão formal de backup/recuperação.

### Wave 13 — jornada pública e cliente

Fechou quatro cenários P1 ligados à conversão de agendamento:

- `CA-AG-04`: cliente autenticada reutiliza nome e WhatsApp persistidos, e o backend ignora identidade divergente enviada pelo navegador;
- `CA-NEG-06`: negócio previamente publicado continua acessível sem serviço ativo, sem permitir booking de serviço inativo;
- `CA-NEG-07`: perfil e serviço continuam visíveis sem slots, com estado vazio na UI e bloqueio de criação fora da disponibilidade;
- `CA-AG-21`: reagendamento que já fica fora do cutoff comunica à cliente que o cancelamento direto pelo AF está indisponível.

Com a Wave 13, a cobertura P1 passou para **4/7 (57,1%)** e a cobertura combinada
P0 + P1 passou para **64/67 (95,5%)**.

## Tempo e fuso horário

Para agendamentos:

- `agendamentos.inicio_previsto_em` representa **quando** o compromisso ocorre
  em instante absoluto;
- `agendamentos.fuso_horario_snapshot` registra **qual regra local IANA** foi
  usada, por exemplo `America/Sao_Paulo` ou `America/Manaus`;
- conflitos globais são comparados pelo instante absoluto;
- apresentação e geração de slots convertem o instante para o fuso IANA do
  contexto consultado;
- alterar o fuso cadastrado do negócio posteriormente não reinterpreta bookings
  históricos.

A advisory lock de agenda é global por profissional, evitando que duas
transações em datas locais/fusos diferentes confirmem intervalos absolutos
incompatíveis.

### Wave 14 — autenticação e privacidade

Fechou os dois cenários funcionais P1 restantes:

- `CA-AUT-04`: recuperação de senha validada ponta a ponta com token aleatório
  de uso único, hash persistido, rejeição de token inválido/reutilizado, troca
  efetiva da senha e novos links com o segredo no fragmento `#token=`;
- `CA-PRV-03`: negócio arquivado deixa explicitamente de contar como negócio
  próprio operacional e a mesma conta pode criar um novo negócio após o
  arquivamento seguro.

### Wave 15 — desempenho representativo

Fechou o último cenário P1 da baseline, `CA-NFR-05` / `RNF02`, com medição
automatizada read-only ligada ao commit medido:

- catálogo público: p95 **236,95 ms**;
- perfil público: p95 **167,91 ms**;
- agenda pública: p95 **102,87 ms**;
- home pública: LCP móvel mediano **2.412,60 ms**;
- perfil público: LCP móvel mediano **2.210,41 ms**.

A evidência final foi produzida pelo **Performance QA #22** e pelo **Backend CI
#1250**, ambos concluídos com sucesso para o head
`21aaa5b046f879b2230e716699647c054ad6b887`. Os limites permanecem API p95
≤ 2 s e LCP mobile ≤ 2,5 s.

Com isso, a baseline consolidada alcançou **67/67 (100%)** entre P0 e P1. Essa
cobertura não remove a ressalva operacional de backup/recuperação descrita acima.

## Cobertura P1 atual

A baseline possui **7 cenários P1**. Os sete estão concluídos:

| Critério | Tema | Estado |
| --- | --- | --- |
| `CA-AG-04` | Reutilizar dados do cliente autenticado | Concluído na Wave 13 |
| `CA-NEG-06` | Negócio publicado sem serviço ativo | Concluído na Wave 13 |
| `CA-NEG-07` | Negócio publicado sem disponibilidade | Concluído na Wave 13 |
| `CA-AG-21` | Reagendamento já sem cancelamento direto | Concluído na Wave 13 |
| `CA-AUT-04` | Recuperação de senha | Concluído na Wave 14 |
| `CA-PRV-03` | Negócio arquivado não conta no limite | Concluído na Wave 14 |
| `CA-NFR-05` | Metas de desempenho | Concluído na Wave 15 |

```text
Cobertura P1:       7/7  (100%)
Cobertura P0 + P1: 67/67 (100%)
```

## Wave 16 — hardening de Produto e UX pós-baseline

Com a baseline P0 + P1 em 100%, a Wave 16 deixa de perseguir porcentagem de
cobertura e passa a tratar regressões e fricções observáveis na experiência
crítica.

O primeiro recorte é a experiência pública móvel, especialmente WebKit, porque
ela concentra descoberta → perfil → escolha do serviço → horário → revisão e
agendamento. O escopo deve permanecer pequeno e reversível:

- revisar a home e o perfil público após as otimizações de performance da Wave
  15, preservando os ganhos medidos;
- reforçar acessibilidade do conteúdo em movimento, incluindo controle explícito
  da rotação automática do hero e respeito a `prefers-reduced-motion`;
- validar loading, vazio, erro e sucesso sem tela vazia ou ação inacessível;
- executar regressão em 360, 390 e 430 px no WebKit e no cenário mobile Chromium
  já coberto pelo Playwright;
- não alterar contrato de booking, preço, plano, autorização ou backend quando o
  problema for estritamente de apresentação.

A Wave 16 é uma evolução de qualidade de Produto e UX; ela não cria novos
critérios retroativamente na baseline congelada de 67 cenários. Novos requisitos
formais devem ser versionados separadamente.

### Estado da Wave 16

A Wave 16 fechou o primeiro hardening pós-baseline sem alterar a baseline
congelada de 67 cenários.

O patch implementa controle explícito de pausa/retomada do hero, pausa após
navegação manual, respeito inicial a `prefers-reduced-motion`, alvos de toque
maiores para os indicadores e uma jornada E2E móvel que chega até o sucesso do
agendamento com APIs mockadas.

A evidência de encerramento foi validada no estado executável do commit
`dcd486f14b18cc17688783c9869df9cb2e99cff4`:

- **Backend CI #1259**: sucesso, incluindo Playwright mobile;
- **Performance QA #25**: sucesso;
- home pública: LCP móvel mediano **2.391,71 ms**;
- perfil público: LCP móvel mediano **2.181,50 ms**;
- catálogo/perfil/agenda públicos: p95 **140,19 / 92,53 / 95,03 ms**.

As alterações documentais posteriores não mudam o estado executável medido. A
análise completa, impactos e evidências estão em
[`wave-16-produto-ux.md`](./wave-16-produto-ux.md).

## Wave 17 — ativação profissional até o primeiro agendamento

A Wave 17 fechou a regressão integrada da primeira jornada profissional sem
alterar a baseline congelada de 67 cenários.

O navegador passou a proteger, na mesma jornada:

- criação da conta profissional;
- negócio criado;
- primeiro serviço ativo e publicação;
- confirmação rápida de horários;
- compartilhamento rastreável do perfil;
- manutenção da missão de ativação depois do compartilhamento;
- encerramento da ativação somente após o backend informar primeiro agendamento
  válido;
- transição do dashboard para o contexto pós-ativação.

O **Backend CI #1266** passou no head final
`93f61481cd94fcf71611f01480cf8715ab049ba5`. O PR #275 foi mergeado na
`main` pelo commit
`7930c92288985af10c328ee49d64f13f9510b4f0`.

A Wave 17 não cria novos critérios P0/P1 e não altera **67/67 (100%)**.

## Wave 18 — recorrência e segundo agendamento

A Wave 18 fechou o hardening da passagem de primeiro valor para repetição de
valor, mantendo separados três fatos:

```text
cliente selecionou “Agendar novamente”
  != novo booking persistido
  != recorrência observada do negócio
```

O navegador protege a jornada mobile até o segundo booking, a profissional
elegível é resolvida novamente, os pipelines distinguem intenção de repetição e
o dashboard identifica a recorrência como histórica do negócio.

O head final `b4920b27b5edf2c094b83e604778e2bee0f4d1ee` passou no
**Backend CI #1275** e no **Performance QA #30**. O PR #277 foi mergeado na
`main` pelo commit
`ecf5738ab4a8fd9ba3c0bb75a58bf3912b129284`.

A Wave 18 não cria novos critérios P0/P1 e mantém **67/67 (100%)**.

## Wave 19 — monetização e ativação de assinatura paga

A Wave 19 fechou a proteção integrada da passagem:

```text
intenção de plano pago
  → checkout elegível
  → PIX pendente
  → pagamento confirmado
  → assinatura efetivamente ativa
```

O backend passou a exigir negócio publicado antes de iniciar checkout pago e o
Playwright mobile passou a proteger PIX único, estado intermediário de ativação,
assinatura `ACTIVE` e recuperação visual de upgrade pendente após recarga.

O head final `9ee9a90be3f294728b7c20f349cb2167351b4742` passou no
**Backend CI #1277**. O PR #278 foi mergeado na `main` pelo commit
`979cc742f1bdb1643efebe6ff0724315eb83c514`.

A Wave 19 não cria novos critérios P0/P1 e mantém **67/67 (100%)**.

## Wave 20 — retenção paga e recuperação da assinatura

A Wave 20 fechou o hardening do ciclo pós-conversão:

```text
assinatura ativa
  → renovação
  → atraso, reversão ou cancelamento
  → recuperação ou fim do período pago
```

O runtime passou a preservar a fatura recorrente do Asaas, diferenciar atraso
recuperável de estorno/disputa, recuperar o histórico financeiro da assinatura
suspensa e apresentar `Acesso até` após cancelamento com período pago. A
regressão mobile protege cancelamento e atraso → regularização → reativação.

O head final `4d5b87a7822479fc0300724c26cfd544ba8ba1f4` passou no
**Backend CI #1281**. O PR #279 foi mergeado na `main` pelo commit
`8d246de46afc9b49e099564856714856f58cc85e`.

A Wave 20 não cria novos critérios P0/P1 e mantém **67/67 (100%)**.

## Wave 21 — retenção financeira e receita recorrente

A Wave 21 fechou a classificação financeira pós-conversão sem alterar a baseline
formal:

```text
primeira conversão paga
  → renovação da mesma assinatura
  → atraso e recuperação
  → mudança de plano
  → cancelamento agendado
  → encerramento efetivo do acesso pago
```

O recorte separa receita inicial, receita de renovação e primeiro pagamento de
uma assinatura paga posterior do mesmo negócio. Também mede renovações vencidas,
confirmadas, com atraso observado e recuperadas, mantendo cancelamento agendado
separado de encerramento após cancelamento.

O head final `8754b2960634f89e3f092dbb34c694d3a62459ee` passou no
**Backend CI #1285**. O PR #280 foi mergeado na `main` pelo commit
`3d95d04a898dd242b0eaa5babd896d5628e2ac6e`.

A Wave não declara churn, LTV ou payback oficiais e mantém **67/67 (100%)**.

## Wave 22 — lifecycle pago canônico e reativação

A Wave 22 fechou o registro estruturado das transições financeiras de domínio:

```text
conversão inicial
  → renovação
  → atraso / recuperação / reversão
  → mudança de plano
  → cancelamento de renovação
  → saída efetiva da base paga
  → eventual reativação
```

A migration 093 criou `assinatura_eventos` com escrita append-only e chave
idempotente. O Admin passou a expor os eventos canônicos registrados desde a
Wave 22, sem backfill especulativo do período anterior e sem rotular atraso ou
cancelamento agendado como churn.

O head final `8dee4f0163fed2c46d843a9650b6e1baf0f05b0a` passou no
**Backend CI #1293**. O PR #281 foi mergeado na `main` pelo commit
`858e83a27d52db174addd8d83979a22b2b7ed481`.

A baseline formal permanece **67/67 (100%)**.

## Wave 23 — reconciliação temporal da base paga

A Wave 23 fechou o hardening do instante de saída efetiva da base paga. Um
cancelamento cujo período já venceu passou a ser reconciliado por background
worker, sem depender de uma leitura posterior do plano.

O head final `71f27e28f2ad55644abc0665c80d85cdf8d71da9` passou no
**Backend CI #1295**. O PR #282 foi mergeado na `main` pelo commit
`faeeacb7e1cb6044396a714615cdd1b95964283a`.

A Wave 23 não criou churn, LTV ou payback oficiais e manteve a baseline formal em
**67/67 (100%)**.

## Wave 24 — episódios pagos e churn observável v1

A Wave 24 fechou a baseline explícita de churn por negócio, sem backfill
especulativo. A migration 095 registra o cutover em `financeiro_marcos` e
captura a base paga presente naquele instante como
`EPISODIO_PAGO_BASELINE`.

O head final `abf2831cb38721970570e64128b5380d39c2289a` passou no
**Backend CI #1298**. O PR #283 foi mergeado na `main` pelo commit
`4f5ee55f6cd989837af82e95d36e28a33e06825a`.

A Wave 24 não alterou a baseline funcional, que continua em **67/67 (100%)**.

## Wave 25 — MRR canônico, GRR e NRR v1

A Wave 25 fechou o ledger monetário append-only a partir de cutover explícito.
A migration 096 preserva snapshots mensais no lifecycle e registra a base
contratada do cutover como `MRR_BASELINE`, usando `assinaturas.valor` em vez
do preço atual do catálogo.

O head final `627ead4149ef827c21c09ed46e2f366856341655` passou no
**Backend CI #1310**. O PR #284 foi mergeado na `main` pelo commit
`0b17d84b979d26f63a813c1c06b8730bb533b761`.

A Wave 25 manteve a baseline funcional em **67/67 (100%)**.

## Wave 26 — coortes de receita e LTV bruto observado v1

A Wave 26 fechou o cutover próprio de LTV e a leitura de receita acumulada por
negócio em D30, D60 e D90, sem backfill especulativo.

O head final `f86a33ab3dcb22b54ea9e72894bf696704931002` passou no
**Backend CI #1312**. O PR #285 foi mergeado na `main` pelo commit
`ec50de88d69fe90de9d345555d6e21a21b8d3f08`.

A Wave 26 manteve a baseline funcional em **67/67 (100%)**.

## Wave 27 — aquisição financeira e retorno bruto observado v1

A Wave 27 fechou o cutover próprio de aquisição financeira por negócio e a
ligação entre campanha, custo de mídia, primeira conversão paga e receita futura
na mesma coorte.

O head final `24640fec15e0fc889d3f66e14eb456f1ce65e2c6` passou no
**Backend CI #1338**. O PR #286 foi mergeado na `main` pelo commit
`1c39a6cf3435a3809183a8c4d008b7f612729116`.

CAC permanece explicitamente **CAC de mídia observado** e o retorno
D30/D60/D90 permanece receita bruta, não margem ou payback econômico.

A Wave 27 manteve a baseline funcional em **67/67 (100%)**.

## Wave 28 — economia líquida de gateway observada v1

A Wave 28 fechou o cutover próprio de economia líquida por pagamento, reconciliando
`netValue`, data de crédito e refunds do Asaas sem alterar o contrato de billing.
Somente refunds concluídos reduzem a receita líquida; estados pendentes ou em
disputa bloqueiam a leitura correspondente.

LTV líquido de gateway reutiliza as coortes/maturidade da Wave 26 e retorno
líquido de gateway reutiliza aquisição/custo da Wave 27. A Wave não declara
lucro, margem de contribuição, CAC total ou payback econômico.

O head final `7dfac372742886d5b09a2e5105c3bbe6b08ca18b` passou no
**Backend CI #1346**, incluindo migrations de teste, Jest + PostgreSQL com
coverage, frontend lint/build/tests, audits e Playwright mobile. O PR #287 foi
mergeado por squash na `main` pelo commit
`d5142b210f8b68253a19ee8255402c0a4e53dd88`.

A Wave 28 não alterou a baseline funcional, que continua em **67/67 (100%)**.

## Regra de atualização

Atualizar este documento quando uma Wave alterar a cobertura da baseline ou
quando uma evidência operacional pendente mudar de estado.

Não usar este arquivo para substituir regras de produto permanentes. Decisões
duráveis de arquitetura, segurança, produto e operação permanecem nos documentos
especializados e, quando autorizado, no `AGENTS.md`.
