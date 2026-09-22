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
atual, e representa navegação concorrente normal. Ele não é um teste de
capacidade máxima.

Para cada endpoint são registrados mínimo, mediana, p95, máximo e número de
amostras. A execução falha se algum p95 ultrapassar 2.000 ms.

## Perfil móvel de LCP

O LCP é medido com **Lighthouse 13.5.0** fixado pela workflow. Cada página recebe
3 navegações frias independentes e o critério usa a **mediana** dessas execuções.
A baseline define o limite de LCP, mas não define percentil para essa métrica;
por isso o processo de QA registra também mínimo e máximo sem transformar o pior
outlier isolado em um novo requisito.

Perfil:

- form factor mobile;
- throttling simulado;
- RTT de 150 ms;
- throughput de 1.600 Kbps;
- CPU slowdown 4×;
- armazenamento/cache reiniciado pelo comportamento padrão do Lighthouse;
- limite de aceite: mediana de LCP ≤ 2.500 ms em cada página crítica.

Os relatórios JSON brutos da categoria `performance` do Lighthouse são
preservados junto com o resumo. Assim, uma falha mantém evidência do elemento
LCP, das fases de carregamento e dos gargalos relacionados, sem exigir uma nova
execução apenas para diagnóstico.

## Ambiente representativo

O alvo é definido por `PERF_TARGET_URL`.

A preferência operacional é um ambiente de QA com aplicação e dados
representativos. Em 22/09/2026, o ambiente Railway chamado `test` possui
PostgreSQL, mas não possui o serviço da aplicação. Por isso a Wave 15 pode usar o
domínio público já implantado como alvo **somente para leituras controladas**,
sem criar carga de stress nem alterar dados.

Esse uso transitório não transforma produção em ambiente de QA permanente. Se
um serviço de aplicação for criado no ambiente `test`, o alvo deve ser migrado
para ele depois de validar dados, domínio e configuração.

O domínio canônico usado para a medição é `app.agendafashion.com.br`. Durante
a investigação da Wave 15, o domínio raiz `agendafashion.com.br` respondeu o
documento HTML, mas devolveu `403` para assets JS/CSS no perfil de navegador
móvel sintético, impedindo FCP/LCP. Esse comportamento é tratado como achado
separado de roteamento/CORS e não deve contaminar a evidência do app canônico.

## Execução

Scripts:

```bash
PERF_TARGET_URL=https://app.agendafashion.com.br \
  node scripts/performance-api-p95.mjs

cd frontend
PERF_TARGET_URL=https://app.agendafashion.com.br \
  node scripts/performance-lcp.mjs
```

A workflow `Performance QA` executa os mesmos scripts e publica os JSONs e os
relatórios Lighthouse como artifact.

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
3. home e perfil público tiverem mediana de LCP ≤ 2,5 s no perfil móvel definido;
4. os resultados estiverem ligados ao commit/deployment medido;
5. qualquer falha ou gargalo encontrado tiver sido investigado antes de marcar o
   critério como concluído.

Resultado de CI local, build rápido ou inspeção de código não substituem essa
evidência.

## Evidência final da Wave 15

A execução que fechou o critério foi ligada ao commit
`21aaa5b046f879b2230e716699647c054ad6b887` e ao alvo canônico
`app.agendafashion.com.br`.

Resultados de API:

| Cenário | p95 | Limite |
| --- | ---: | ---: |
| Catálogo público | 236,95 ms | ≤ 2.000 ms |
| Perfil público | 167,91 ms | ≤ 2.000 ms |
| Agenda pública | 102,87 ms | ≤ 2.000 ms |

Resultados de LCP móvel, mediana de três execuções:

| Página | Mediana | Limite |
| --- | ---: | ---: |
| Home pública | 2.412,60 ms | ≤ 2.500 ms |
| Perfil público | 2.210,41 ms | ≤ 2.500 ms |

A workflow **Performance QA #22** concluiu com sucesso e preservou o artifact
`performance-wave-15-35798081075`. O **Backend CI #1250** também concluiu com
sucesso no mesmo head.

Portanto, em 22/09/2026, o `CA-NFR-05` / `RNF02` está tecnicamente
demonstrado pelo perfil de QA definido neste documento. Mudanças posteriores na
cadeia crítica de renderização ou nos endpoints medidos devem preservar esses
limites e podem exigir nova medição comparável antes de afirmar que o resultado
continua válido.
