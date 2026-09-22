import fs from "node:fs";
import path from "node:path";
import {
  chromium,
  devices,
} from "@playwright/test";

const TARGET_URL = String(
  process.env.PERF_TARGET_URL ||
    "https://agendafashion.com.br"
).replace(/\/+$/, "");

const RUNS = Number(
  process.env.PERF_LCP_RUNS || 5
);
const THRESHOLD_MS = Number(
  process.env.PERF_LCP_MS || 2500
);

const NETWORK = {
  latency: 150,
  downloadThroughput:
    (1.6 * 1024 * 1024) /
    8,
  uploadThroughput:
    (0.75 * 1024 * 1024) /
    8,
};

function percentile(
  values,
  percentileValue
) {
  const sorted = [...values]
    .sort((a, b) => a - b);

  if (sorted.length === 0) {
    return null;
  }

  const index = Math.max(
    0,
    Math.ceil(
      percentileValue *
        sorted.length
    ) - 1
  );

  return sorted[index];
}

function round(value) {
  return Number(
    Number(value).toFixed(2)
  );
}

async function fetchJson(
  relativeUrl
) {
  const response =
    await fetch(
      new URL(
        relativeUrl,
        TARGET_URL
      ),
      {
        headers: {
          Accept:
            "application/json",
          "Cache-Control":
            "no-cache",
          "User-Agent":
            "AgendaFashion-Performance-QA/1.0",
        },
      }
    );

  if (!response.ok) {
    throw new Error(
      `${relativeUrl} respondeu ${response.status}`
    );
  }

  return response.json();
}

async function descobrirSlug() {
  const catalog =
    await fetchJson(
      "/negocios-publicos?pagina=1&limite=12"
    );

  const businesses =
    Array.isArray(
      catalog?.negocios
    )
      ? catalog.negocios
      : [];

  for (const business of businesses) {
    const slug =
      String(
        business?.slug || ""
      ).trim();

    if (!slug) {
      continue;
    }

    const profile =
      await fetchJson(
        `/perfil-negocio/${encodeURIComponent(slug)}`
      );

    if (
      profile?.negocio?.id
    ) {
      return slug;
    }
  }

  throw new Error(
    "Nenhum perfil público disponível para medir LCP."
  );
}

async function medirPagina(
  browser,
  relativeUrl
) {
  const context =
    await browser
      .newContext({
        ...devices[
          "Pixel 7"
        ],
        viewport: {
          width: 390,
          height: 844,
        },
        serviceWorkers:
          "block",
      });

  const page =
    await context
      .newPage();

  await page
    .addInitScript(
      () => {
        window.__AF_LCP =
          0;

        window.__AF_LCP_OBSERVER =
          new PerformanceObserver(
            (list) => {
              for (
                const entry
                of list.getEntries()
              ) {
                window.__AF_LCP =
                  Math.max(
                    window.__AF_LCP,
                    entry.startTime
                  );
              }
            }
          );

        window.__AF_LCP_OBSERVER
          .observe({
            type:
              "largest-contentful-paint",
            buffered:
              true,
          });
      }
    );

  const cdp =
    await context
      .newCDPSession(
        page
      );

  await cdp.send(
    "Network.enable"
  );

  let lcpCdpEpochSeconds =
    0;

  cdp.on(
    "PerformanceTimeline.timelineEventAdded",
    ({ event }) => {
      if (
        event?.type !==
          "largest-contentful-paint"
      ) {
        return;
      }

      const details =
        event.lcpDetails ||
        {};

      const candidate =
        Number(
          details.renderTime ||
          details.loadTime ||
          event.time ||
          0
        );

      if (
        Number.isFinite(
          candidate
        ) &&
        candidate >
          lcpCdpEpochSeconds
      ) {
        lcpCdpEpochSeconds =
          candidate;
      }
    }
  );

  await cdp.send(
    "PerformanceTimeline.enable",
    {
      eventTypes: [
        "largest-contentful-paint",
      ],
    }
  );

  await cdp.send(
    "Network.emulateNetworkConditions",
    {
      offline: false,
      latency:
        NETWORK.latency,
      downloadThroughput:
        NETWORK
          .downloadThroughput,
      uploadThroughput:
        NETWORK
          .uploadThroughput,
      connectionType:
        "cellular4g",
    }
  );

  await cdp.send(
    "Emulation.setCPUThrottlingRate",
    {
      rate: 4,
    }
  );

  const response =
    await page.goto(
      new URL(
        relativeUrl,
        TARGET_URL
      ).toString(),
      {
        waitUntil:
          "domcontentloaded",
        timeout:
          30000,
      }
    );

  if (
    !response ||
    response.status() >= 400
  ) {
    const status =
      response
        ?.status() ??
      "sem resposta";

    await context.close();

    throw new Error(
      `${relativeUrl} respondeu ${status}`
    );
  }

  await page.waitForLoadState(
    "load",
    {
      timeout:
        30000,
    }
  );

  await page.waitForTimeout(
    3000
  );

  const diagnostico =
    await page.evaluate(
      () => ({
        lcp:
          Number(
            window.__AF_LCP ||
              0
          ),
        timeOrigin:
          Number(
            performance.timeOrigin
          ),
        supported:
          Array.isArray(
            PerformanceObserver
              .supportedEntryTypes
          )
            ? PerformanceObserver
                .supportedEntryTypes
                .includes(
                  "largest-contentful-paint"
                )
            : null,
      })
    );

  const lcpCdp =
    lcpCdpEpochSeconds > 0
      ? (
          lcpCdpEpochSeconds *
            1000 -
          diagnostico.timeOrigin
        )
      : 0;

  const lcp =
    Math.max(
      diagnostico.lcp,
      lcpCdp
    );

  await context.close();

  if (
    !Number.isFinite(lcp) ||
    lcp <= 0
  ) {
    throw new Error(
      `LCP não foi observado em ${relativeUrl}. PerformanceObserver suporta LCP: ${diagnostico.supported}; CDP capturou: ${lcpCdpEpochSeconds > 0}`
    );
  }

  return lcp;
}

async function main() {
  if (
    !Number.isInteger(RUNS) ||
    RUNS < 3 ||
    RUNS > 10
  ) {
    throw new Error(
      "PERF_LCP_RUNS deve ficar entre 3 e 10."
    );
  }

  const slug =
    await descobrirSlug();

  const pages = [
    {
      name:
        "home_publica",
      path:
        "/",
    },
    {
      name:
        "perfil_publico",
      path:
        `/negocio/${encodeURIComponent(slug)}`,
    },
  ];

  const browser =
    await chromium.launch({
      headless: true,
    });

  const results = [];

  try {
    for (
      const testCase
      of pages
    ) {
      const samples = [];

      for (
        let index = 0;
        index < RUNS;
        index += 1
      ) {
        samples.push(
          await medirPagina(
            browser,
            testCase.path
          )
        );
      }

      const p95 =
        round(
          percentile(
            samples,
            0.95
          )
        );

      results.push({
        ...testCase,
        runs:
          samples.map(
            round
          ),
        median_ms:
          round(
            percentile(
              samples,
              0.5
            )
          ),
        p95_ms:
          p95,
        threshold_ms:
          THRESHOLD_MS,
        passed:
          p95 <=
          THRESHOLD_MS,
      });
    }
  } finally {
    await browser.close();
  }

  const report = {
    measured_at:
      new Date()
        .toISOString(),
    target:
      TARGET_URL,
    profile: {
      device:
        "Pixel 7 / 390x844",
      cold_context:
        true,
      cpu_slowdown:
        "4x",
      latency_ms:
        NETWORK.latency,
      download_mbps:
        1.6,
      upload_mbps:
        0.75,
      runs_per_page:
        RUNS,
    },
    slug,
    results,
    passed:
      results.every(
        (item) =>
          item.passed
      ),
  };

  const outputDir =
    path.resolve(
      process.cwd(),
      "..",
      "performance-results"
    );

  fs.mkdirSync(
    outputDir,
    {
      recursive: true,
    }
  );

  fs.writeFileSync(
    path.join(
      outputDir,
      "lcp-mobile.json"
    ),
    JSON.stringify(
      report,
      null,
      2
    )
  );

  console.log(
    JSON.stringify(
      report,
      null,
      2
    )
  );

  if (!report.passed) {
    process.exitCode = 1;
  }
}

main().catch(
  (error) => {
    console.error(
      error
    );
    process.exitCode = 1;
  }
);
