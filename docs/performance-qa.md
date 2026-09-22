# Performance QA — API p95 e LCP mobile

> Processo de medição para o `CA-NFR-05` / `RNF02`.
>
> Este documento define o perfil de QA, os alvos, os limites e a forma de
> interpretar a evidência. Ele não autoriza stress test destrutivo nem escrita em
> produção.

## Critério da baseline

O AF precisa demonstrar, sob carga operacional normal definida no processo de
QA:

- operações críticas de API com **p95 ≤ 2 s**;
- páginas públicas críticas buscando **LCP ≤ 2,5 s** em dispositivo móvel e rede
  representativos.

## Escopo da Wave 15

A medição automatizada desta Wave é deliberadamente **read-only**.

APIs críticas medidas:

1. catálogo público: `GET /negocios-publicos`;
2. perfil público: `GET /perfil-negocio/:slug`;
3. disponibilidade: `GET /agenda-publica`.

Páginas públicas medidas:

1. home `/`;
2. perfil público `/negocio/:slug`.

O cenário descobre automaticamente um negócio publicado que possua serviço e
profissional elegível. Nenhum booking, cadastro, checkout, login, cancelamento ou
outra mutação é executado pelo teste.

## Perfil de carga de API

Configuração padrão:

- 3 warmups por endpoint;
- 30 amostras válidas por endpoint;
- concorrência máxima 3;
- timeout individual de 15 s;
- cache HTTP solicitado como `no-cache`;
- origem do tráfego: runner de QA hospedado no GitHub.

Esse perfil produz tráfego pequeno e controlado, abaixo do limitador público
atual, e tem o objetivo de representar navegação concorrente normal. Ele não é
um teste de capacidade máxima.

Para cada endpoint são registrados:

- mínimo;
- mediana;
- p95;
- máximo;
- número de amostras.

A execução falha se algum p95 ultrapassar 2.000 ms.

## Perfil móvel de LCP

Configuração padrão:

- Chromium headless;
- perfil Pixel 7;
- viewport 390 × 844;
- contexto frio por execução, sem service worker;
- CPU 4× mais lenta;
- latência de 150 ms;
- download de 1,6 Mbps;
- upload de 0,75 Mbps;
- 5 execuções frias por página.

A instrumentação usa `PerformanceObserver` para capturar
`largest-contentful-paint`.

Para reduzir falso positivo por uma execução isolada, o contrato de QA considera
o p95 das execuções frias de cada página. A execução falha se o p95 ultrapassar
2.500 ms.

## Ambiente representativo

O alvo é definido por `PERF_TARGET_URL`.

A preferência operacional é um ambiente de QA com aplicação e dados
representativos. Em 22/09/2026, o ambiente Railway chamado `test` possui
PostgreSQL, mas não possui o serviço da aplicação. Por isso a Wave 15 pode usar o
domínio público já implantado como alvo **somente para leituras controladas**,
sem criar carga de stress nem alterar dados.

Esse uso transitório não transforma produção em ambiente de QA permanente. Se
um serviço de aplicação for criado no ambiente `test`, o alvo de execução deve
ser migrado para ele após validação de dados, domínio e configuração.

## Execução

Scripts:

```bash
PERF_TARGET_URL=https://agendafashion.com.br \
  node scripts/performance-api-p95.mjs

cd frontend
PERF_TARGET_URL=https://agendafashion.com.br \
  node scripts/performance-lcp.mjs
```

A workflow `Performance QA` executa os mesmos scripts e publica os JSONs de
resultado como artifact.

Variáveis opcionais:

```text
PERF_API_SAMPLES
PERF_API_CONCURRENCY
PERF_API_P95_MS
PERF_LCP_RUNS
PERF_LCP_MS
```

Os limites padrão permanecem alinhados à baseline. Alterá-los em uma execução
exploratória não altera o critério de aceite.

## Evidência e conclusão

Uma execução só pode fechar `CA-NFR-05` quando:

1. o alvo estiver saudável e representativo;
2. todos os endpoints definidos tiverem p95 ≤ 2 s;
3. home e perfil público tiverem LCP p95 ≤ 2,5 s no perfil móvel definido;
4. os resultados estiverem ligados ao commit/deployment medido;
5. qualquer falha ou gargalo encontrado tiver sido investigado antes de marcar o
   critério como concluído.

Resultado de CI local, build rápido ou inspeção de código não substituem essa
evidência.
