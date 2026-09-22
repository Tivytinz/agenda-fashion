import { chromium, devices } from "@playwright/test";
import fs from "node:fs/promises";
import path from "node:path";

const baseUrl =
  String(
    process.env.PERFORMANCE_BASE_URL ||
      "https://app.agendafashion.com.br"
  ).replace(/\/$/, "");

const routes = String(
  process.env.PERFORMANCE_ROUTES ||
    "/|/negocio/ac-ana-carolina-esteticista"
)
  .split("|")
  .map((item) => item.trim())
  .filter(Boolean);

const samplesPerRoute = Math.max(
  3,
  Number(
    process.env.PERFORMANCE_SAMPLES ||
      5
  )
);

const thresholdMs = Number(
  process.env.PERFORMANCE_LCP_THRESHOLD_MS ||
    2500
);

const network = {
  latencyMs: 150,
  downloadBytesPerSecond:
    Math.round(
      (1.6 * 1024 * 1024) / 8
    ),
  uploadBytesPerSecond:
    Math.round(
      (750 * 1024) / 8
    ),
  cpuSlowdown: 4,
};

function percentile(values, p) {
  const sorted =
    [...values]
      .sort((a, b) => a - b);

  const index =
    Math.max(
      0,
      Math.ceil(
        p * sorted.length
      ) - 1
    );

  return sorted[index];
}

async function measureRoute(
  browser,
  route
) {
  const samples = [];

  for (
    let index = 0;
    index < samplesPerRoute;
    index += 1
  ) {
    const context =
      await browser.newContext({
        ...devices["Pixel 7"],
        serviceWorkers: "block",
      });

    const page =
      await context.newPage();

    const cdp =
      await context.newCDPSession(
        page
      );

    await cdp.send(
      "Network.enable"
    );

    await cdp.send(
      "Network.setCacheDisabled",
      {
        cacheDisabled: true,
      }
    );

    await cdp.send(
      "Network.emulateNetworkConditions",
      {
        offline: false,
        latency:
          network.latencyMs,
        downloadThroughput:
          network
            .downloadBytesPerSecond,
        uploadThroughput:
          network
            .uploadBytesPerSecond,
        connectionType:
          "cellular4g",
      }
    );

    await cdp.send(
      "Emulation.setCPUThrottlingRate",
      {
        rate:
          network.cpuSlowdown,
      }
    );

    await page.addInitScript(
      () => {
        window.__afLcp = 0;

        new PerformanceObserver(
          (list) => {
            const entries =
              list.getEntries();

            const last =
              entries[
                entries.length - 1
              ];

            if (last) {
              window.__afLcp =
                last.startTime;
            }
          }
        ).observe({
          type:
            "largest-contentful-paint",
          buffered: true,
        });
      }
    );

    const response =
      await page.goto(
        `${baseUrl}${route}`,
        {
          waitUntil:
            "networkidle",
          timeout:
            45000,
        }
      );

    if (
      !response ||
      response.status() >= 400
    ) {
      throw new Error(
        `Falha HTTP em ${route}: ${response?.status() ?? "sem resposta"}`
      );
    }

    await page.waitForTimeout(
      1000
    );

    const lcp =
      await page.evaluate(
        () =>
          Number(
            window.__afLcp || 0
          )
      );

    if (
      !Number.isFinite(lcp) ||
      lcp <= 0
    ) {
      throw new Error(
        `LCP não observado em ${route}`
      );
    }

    samples.push(
      Math.round(lcp)
    );

    await context.close();
  }

  return {
    route,
    samples_ms:
      samples,
    median_ms:
      percentile(
        samples,
        0.5
      ),
    p75_ms:
      percentile(
        samples,
        0.75
      ),
    max_ms:
      Math.max(...samples),
  };
}

const browser =
  await chromium.launch({
    headless: true,
  });

const results = [];

try {
  for (
    const route of routes
  ) {
    results.push(
      await measureRoute(
        browser,
        route
      )
    );
  }
} finally {
  await browser.close();
}

const passed =
  results.every(
    (item) =>
      item.p75_ms <=
      thresholdMs
  );

const report = {
  measured_at:
    new Date().toISOString(),
  base_url:
    baseUrl,
  device:
    "Pixel 7 / Chromium",
  network_reference: {
    latency_ms:
      network.latencyMs,
    download_mbps:
      1.6,
    upload_kbps:
      750,
    cpu_slowdown:
      network.cpuSlowdown,
    cache:
      "disabled per cold run",
  },
  samples_per_route:
    samplesPerRoute,
  threshold_lcp_ms:
    thresholdMs,
  aggregation:
    "p75",
  results,
  passed,
};

const outputPath =
  path.resolve(
    "frontend/test-results/performance-wave15.json"
  );

await fs.mkdir(
  path.dirname(
    outputPath
  ),
  {
    recursive: true,
  }
);

await fs.writeFile(
  outputPath,
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

if (!passed) {
  process.exitCode = 1;
}
