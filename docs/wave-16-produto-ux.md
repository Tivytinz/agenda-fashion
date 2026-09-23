# Wave 16 — Produto e UX pós-baseline

> **Papel documental:** documento histórico/evidência do recorte de Produto e UX da Wave 16. Decisões duráveis resultantes devem permanecer nos documentos canônicos correspondentes.

> Análise técnica e de produto do primeiro recorte da Wave 16.
>
> A baseline funcional P0 + P1 permanece congelada em **67/67 (100%)**. A Wave
> 16 é hardening de experiência e não cria critérios retroativos.

## Objetivo

A Wave 16 começa pela jornada pública móvel:

```text
home / descoberta
  → perfil público
  → serviço
  → profissional quando houver escolha real
  → horário
  → revisão
  → confirmação
  → sucesso
```

O foco é reduzir fricção e regressão em mobile, principalmente Safari/WebKit,
sem alterar regras de booking, preço, plano, autenticação, autorização ou banco
quando o problema for de apresentação.

## Estado implementado

O primeiro patch atua no hero público, que já possuía rotação automática a cada
7 segundos e tratamento de `prefers-reduced-motion`, mas não oferecia um
controle explícito para interromper o movimento.

A implementação atual:

- adiciona controle visível de pausa/retomada;
- inicia com a rotação pausada quando
  `prefers-reduced-motion: reduce` estiver ativo;
- pausa a rotação quando a pessoa navega manualmente por seta, indicador ou
  gesto de swipe;
- permite retomar a rotação somente por ação explícita;
- amplia os alvos de toque dos indicadores do hero sem aumentar o ponto visual;
- preserva a prioridade de carregamento da primeira imagem usada no LCP;
- não altera APIs, persistência, segurança, pagamentos, WhatsApp ou regras de
  agendamento.

O recorte foi desenvolvido na branch `feat/product-ux-wave-16` e integrado à `main` pelo PR #274.

## Evidência disponível

A cobertura adicionada nesta Wave inclui:

- teste unitário da home para pausa após navegação manual;
- teste unitário da home para preferência de movimento reduzido;
- regressão equivalente no catálogo público;
- Playwright do shell público para pausa do hero e ausência de overflow.

A configuração atual do Playwright executa os testes móveis gerais em:

- WebKit 360 × 740;
- WebKit 390 × 844;
- WebKit 430 × 932;
- Chromium mobile 390 × 844.

O repositório já possui cobertura adicional da jornada pública:

- perfil e fluxo de escolha contidos no viewport móvel;
- navegação por teclado e foco visível no fluxo de agendamento;
- estados de perfil sem serviço e sem horário;
- erro de agenda com tentativa novamente;
- confirmação com proteção contra envio duplicado;
- conflito de horário;
- sucesso do agendamento em testes de componente.

## Análise de impacto

### Frontend

O impacto funcional é baixo e concentrado no conteúdo acima da dobra da home.
A alteração melhora controle do usuário sobre conteúdo em movimento e mantém os
controles acessíveis por nome e estado `aria-pressed`.

Existe duplicação de comportamento do hero entre `HomePage` e
`ExplorePage`. Hoje isso não caracteriza falha funcional, mas aumenta risco de
divergência entre duas implementações equivalentes. Uma extração para componente
compartilhado pode ser avaliada em uma mudança separada; não deve ampliar este
patch sem ganho comprovado.

### Backend e banco

Nenhuma mudança necessária. A Wave 16 atual não altera contratos de API,
autorização, isolamento entre negócios, migrations ou integridade de booking.

### Segurança e privacidade

Não há nova entrada de dados sensíveis nem alteração de autenticação. Os
controles adicionados são apenas de apresentação local.

### Integrações

Nenhuma mudança em Asaas, Meta/WhatsApp, Resend ou plataformas de marketing.

### Testes

A cobertura do comportamento novo é proporcional ao risco e foi ampliada até o
fim da jornada pública móvel.

O Playwright agora atravessa:

```text
perfil público
  → serviço
  → horário
  → revisão
  → confirmação
  → sucesso
```

com APIs mockadas e sem escrita em produção. O mesmo cenário continua validando
ausência de overflow horizontal e visibilidade das ações críticas no viewport.

O **Backend CI #1259** concluiu com sucesso no commit
`dcd486f14b18cc17688783c9869df9cb2e99cff4`, cobrindo lint, dead code, build,
testes frontend, migrations, Jest/PostgreSQL, audits e Playwright mobile.

## Evidências de encerramento da Wave

### Performance

O **Performance QA #25** concluiu com sucesso no mesmo commit medido. O artifact
é `performance-qa-35801698769`.

API p95:

| Cenário | p95 | Limite |
| --- | ---: | ---: |
| Catálogo público | 140,19 ms | ≤ 2.000 ms |
| Perfil público | 92,53 ms | ≤ 2.000 ms |
| Agenda pública | 95,03 ms | ≤ 2.000 ms |

LCP móvel, mediana de três execuções:

| Página | Mediana | Limite |
| --- | ---: | ---: |
| Home pública | 2.391,71 ms | ≤ 2.500 ms |
| Perfil público | 2.181,50 ms | ≤ 2.500 ms |

A home permaneceu dentro da meta e melhorou frente à mediana registrada na Wave
15, sem transformar essa comparação pontual em promessa de tendência.

### Jornada móvel

A jornada pública até o estado de sucesso foi incorporada ao
`agendamento-mobile.spec.js` e passou na matriz mobile do Quality Gate,
incluindo WebKit e Chromium conforme a configuração do Playwright.

### Acessibilidade e controle do movimento

O hero possui pausa/retomada explícita, pausa após interação manual,
`aria-pressed`, alvos de toque ampliados e inicialização pausada quando
`prefers-reduced-motion: reduce` estiver ativo.

### Estados públicos

Os testes existentes continuam cobrindo perfil sem serviço, ausência de horário,
erro/retry da agenda, conflito de confirmação e sucesso. O E2E móvel protege o
layout real da jornada crítica contra overflow.

## Encerramento da Wave 16

Os gates definidos para esta Wave foram atendidos no estado executável medido:

1. Quality Gate verde;
2. Performance QA verde;
3. jornada móvel E2E até sucesso;
4. ausência de overflow na regressão mobile;
5. controle explícito de movimento e preferência reduzida preservados;
6. nenhum contrato crítico de backend foi alterado para acomodar UX.

O primeiro recorte da Wave 16 foi integrado à `main`. Este arquivo permanece como evidência do estado medido; novas decisões duráveis devem ser refletidas nos documentos canônicos correspondentes.
