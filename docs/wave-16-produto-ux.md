# Wave 16 — Produto e UX pós-baseline

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

A mudança está isolada na branch `feat/product-ux-wave-16` e no PR #274.

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

A cobertura do comportamento novo é proporcional ao risco. O Quality Gate final
deve ser executado no **head final** da branch, incluindo lint, dead code, build,
testes frontend, cobertura backend, audits e Playwright mobile.

## Riscos e pendências antes de encerrar a Wave

### 1. Revalidar performance da home

Este é o principal gate técnico da Wave.

A evidência da Wave 15 registrou LCP móvel mediano da home em **2.412,60 ms**
para um limite de **2.500 ms**. A folga é de apenas **87,40 ms**.

Mesmo que o patch atual seja pequeno e não altere a imagem LCP, ele modifica a
árvore e o CSS acima da dobra. Por isso a Wave 16 não deve ser considerada
encerrada sem repetir o Performance QA no head final e confirmar que o LCP da
home continua dentro da meta.

### 2. Fechar a jornada móvel ponta a ponta

O Playwright atual valida o perfil e chega até a ação de revisão do agendamento,
enquanto confirmação e sucesso possuem forte cobertura em testes de componente.

Para fechar a intenção da Wave 16 de proteger a cadeia
`descoberta → perfil → horário → revisão → agendamento`, falta uma evidência
E2E móvel única que atravesse a confirmação e chegue ao estado de sucesso com
APIs mockadas e sem depender de produção.

### 3. Validar estados críticos no navegador

Loading, vazio e erro possuem cobertura de componente, mas a Wave deve manter ao
menos uma verificação no navegador para evitar tela vazia, overflow ou CTA
inacessível nos estados públicos mais importantes.

Não é necessário duplicar toda a matriz unitária em E2E. O objetivo é cobrir os
pontos em que layout, viewport e WebKit podem introduzir regressões que o jsdom
não detecta.

## Critério de encerramento da Wave 16

A primeira Wave pós-baseline pode ser encerrada quando:

1. o Quality Gate estiver verde no head final;
2. o Performance QA confirmar novamente API e LCP, especialmente a home;
3. a jornada móvel pública possuir evidência E2E até sucesso;
4. não houver overflow horizontal nos viewports móveis suportados;
5. movimento reduzido e pausa explícita permanecerem funcionais;
6. nenhuma correção da Wave alterar contratos críticos do backend apenas para
   acomodar UX.

## Próximo passo técnico

A sequência recomendada é manter o patch atual pequeno, completar a regressão E2E
da jornada pública até sucesso e então repetir o Performance QA no head final.

Somente depois dessas duas evidências a Wave 16 deve ser marcada como concluída
e preparada para merge.
