import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

const TARGET_URL = String(
  process.env.PERF_TARGET_URL ||
    "https://agendafashion.com.br"
).replace(/\/+$/, "");

const RUNS = Number(
  process.env.PERF_LCP_RUNS || 3
);

const THRESHOLD_MS = Number(
  process.env.PERF_LCP_MS || 2500
);

const LIGHTHOUSE_VERSION =
  "13.5.0";

function round(value) {
  return Number(
    Number(value).toFixed(2)
  );
}

function median(values) {
  const sorted = [...values]
    .sort((a, b) => a - b);

  if (sorted.length === 0) {
    return null;
  }

  const middle =
    Math.floor(
      sorted.length / 2
    );

  if (
    sorted.length % 2 === 1
  ) {
    return sorted[middle];
  }

  return (
    sorted[middle - 1] +
    sorted[middle]
  ) / 2;
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

function medirComLighthouse({
  relativeUrl,
  outputFile,
}) {
  const absoluteUrl =
    new URL(
      relativeUrl,
      TARGET_URL
    ).toString();

  const result =
    spawnSync(
      "npx",
      [
        "--yes",
        `lighthouse@${LIGHTHOUSE_VERSION}`,
        absoluteUrl,
        "--quiet",
        "--chrome-flags=--headless=new --no-sandbox --disable-dev-shm-usage --disable-background-timer-throttling --disable-backgrounding-occluded-windows --disable-renderer-backgrounding --window-size=390,844",
        "--only-audits=largest-contentful-paint",
        "--output=json",
        `--output-path=${outputFile}`,
        "--form-factor=mobile",
        "--throttling-method=simulate",
        "--throttling.rttMs=150",
        "--throttling.throughputKbps=1600",
        "--throttling.cpuSlowdownMultiplier=4",
        "--max-wait-for-load=45000",
      ],
      {
        encoding:
          "utf8",
        stdio: [
          "ignore",
          "pipe",
          "pipe",
        ],
      }
    );

  if (
    result.status !== 0
  ) {
    throw new Error(
      [
        `Lighthouse falhou em ${relativeUrl}.`,
        String(
          result.stderr || ""
        ).trim(),
        String(
          result.stdout || ""
        ).trim(),
      ]
        .filter(Boolean)
        .join("\n")
    );
  }

  const report =
    JSON.parse(
      fs.readFileSync(
        outputFile,
        "utf8"
      )
    );

  const audit =
    report?.audits?.[
      "largest-contentful-paint"
    ];

  const lcp =
    Number(
      audit?.numericValue
    );

  if (
    !Number.isFinite(lcp) ||
    lcp <= 0
  ) {
    throw new Error(
      `Lighthouse não retornou LCP válido em ${relativeUrl}.`
    );
  }

  return {
    lcp_ms:
      round(lcp),
    display_value:
      audit?.displayValue ||
      null,
    settings:
      report?.configSettings ||
      null,
    environment:
      report?.environment ||
      null,
  };
}

async function main() {
  if (
    !Number.isInteger(RUNS) ||
    RUNS < 3 ||
    RUNS > 5
  ) {
    throw new Error(
      "PERF_LCP_RUNS deve ficar entre 3 e 5."
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

  const outputDir =
    path.resolve(
      process.cwd(),
      "..",
      "performance-results"
    );

  const rawDir =
    path.join(
      outputDir,
      "lighthouse"
    );

  fs.mkdirSync(
    rawDir,
    {
      recursive: true,
    }
  );

  const results = [];
  let representativeSettings =
    null;
  let representativeEnvironment =
    null;

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
      const outputFile =
        path.join(
          rawDir,
          `${testCase.name}-${index + 1}.json`
        );

      const measured =
        medirComLighthouse({
          relativeUrl:
            testCase.path,
          outputFile,
        });

      samples.push(
        measured.lcp_ms
      );

      representativeSettings =
        representativeSettings ||
        measured.settings;

      representativeEnvironment =
        representativeEnvironment ||
        measured.environment;
    }

    const medianMs =
      round(
        median(samples)
      );

    results.push({
      ...testCase,
      runs_ms:
        samples,
      median_ms:
        medianMs,
      min_ms:
        round(
          Math.min(
            ...samples
          )
        ),
      max_ms:
        round(
          Math.max(
            ...samples
          )
        ),
      threshold_ms:
        THRESHOLD_MS,
      passed:
        medianMs <=
        THRESHOLD_MS,
    });
  }

  const report = {
    measured_at:
      new Date()
        .toISOString(),
    target:
      TARGET_URL,
    tool: {
      name:
        "Lighthouse",
      version:
        LIGHTHOUSE_VERSION,
    },
    profile: {
      runs_per_page:
        RUNS,
      acceptance_statistic:
        "median",
      form_factor:
        "mobile",
      throttling_method:
        "simulate",
      rtt_ms:
        150,
      throughput_kbps:
        1600,
      cpu_slowdown_multiplier:
        4,
      storage:
        "cold/default Lighthouse reset",
    },
    lighthouse_settings:
      representativeSettings,
    lighthouse_environment:
      representativeEnvironment,
    slug,
    results,
    passed:
      results.every(
        (item) =>
          item.passed
      ),
  };

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
