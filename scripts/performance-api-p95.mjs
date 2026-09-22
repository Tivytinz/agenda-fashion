import fs from "node:fs";
import path from "node:path";
import { performance } from "node:perf_hooks";

const TARGET_URL = String(
  process.env.PERF_TARGET_URL ||
    "https://agendafashion.com.br"
).replace(/\/+$/, "");

const SAMPLE_COUNT = Number(
  process.env.PERF_API_SAMPLES || 30
);
const CONCURRENCY = Number(
  process.env.PERF_API_CONCURRENCY || 3
);
const THRESHOLD_MS = Number(
  process.env.PERF_API_P95_MS || 2000
);

if (
  !Number.isInteger(SAMPLE_COUNT) ||
  SAMPLE_COUNT < 10 ||
  SAMPLE_COUNT > 100
) {
  throw new Error(
    "PERF_API_SAMPLES deve ficar entre 10 e 100."
  );
}

if (
  !Number.isInteger(CONCURRENCY) ||
  CONCURRENCY < 1 ||
  CONCURRENCY > 10
) {
  throw new Error(
    "PERF_API_CONCURRENCY deve ficar entre 1 e 10."
  );
}

function percentile(values, percentileValue) {
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

async function fetchTimed(relativeUrl) {
  const controller =
    new AbortController();

  const timeout =
    setTimeout(
      () =>
        controller.abort(),
      15000
    );

  const started =
    performance.now();

  try {
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
          signal:
            controller.signal,
        }
      );

    const durationMs =
      performance.now() -
      started;

    if (!response.ok) {
      const body =
        await response
          .text()
          .catch(
            () => ""
          );

      throw new Error(
        `${relativeUrl} respondeu ${response.status}: ${body.slice(0, 160)}`
      );
    }

    return {
      durationMs,
      response,
    };
  } finally {
    clearTimeout(timeout);
  }
}

async function fetchJson(relativeUrl) {
  const { response } =
    await fetchTimed(
      relativeUrl
    );

  return response.json();
}

function encontrarProfissionalElegivel(
  profile
) {
  const services =
    Array.isArray(
      profile?.servicos
    )
      ? profile.servicos
      : [];

  const professionals =
    Array.isArray(
      profile?.profissionais
    )
      ? profile.profissionais
      : [];

  for (const service of services) {
    if (!service?.id) {
      continue;
    }

    const professional =
      professionals.find(
        (item) =>
          item?.id &&
          Array.isArray(
            item.servico_ids
          ) &&
          item.servico_ids.some(
            (id) =>
              String(id) ===
              String(service.id)
          )
      );

    if (professional) {
      return {
        service,
        professional,
      };
    }
  }

  return null;
}

async function descobrirCenarioPublico() {
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

    const eligible =
      encontrarProfissionalElegivel(
        profile
      );

    if (eligible) {
      return {
        slug,
        serviceId:
          eligible.service.id,
        professionalId:
          eligible.professional.id,
      };
    }
  }

  throw new Error(
    "Nenhum negócio público com serviço e profissional elegível foi encontrado para o cenário de performance."
  );
}

async function executarLote(
  relativeUrl
) {
  const warmups = 3;

  for (
    let index = 0;
    index < warmups;
    index += 1
  ) {
    await fetchTimed(
      relativeUrl
    );
  }

  const durations = [];
  let nextIndex = 0;

  async function worker() {
    while (true) {
      const current =
        nextIndex;

      nextIndex += 1;

      if (
        current >=
        SAMPLE_COUNT
      ) {
        return;
      }

      const result =
        await fetchTimed(
          relativeUrl
        );

      durations.push(
        result.durationMs
      );
    }
  }

  await Promise.all(
    Array.from(
      {
        length:
          Math.min(
            CONCURRENCY,
            SAMPLE_COUNT
          ),
      },
      () => worker()
    )
  );

  return {
    samples:
      durations.length,
    min_ms:
      round(
        Math.min(
          ...durations
        )
      ),
    median_ms:
      round(
        percentile(
          durations,
          0.5
        )
      ),
    p95_ms:
      round(
        percentile(
          durations,
          0.95
        )
      ),
    max_ms:
      round(
        Math.max(
          ...durations
        )
      ),
  };
}

async function main() {
  const scenario =
    await descobrirCenarioPublico();

  const agendaParams =
    new URLSearchParams({
      slug:
        scenario.slug,
      servicoId:
        String(
          scenario.serviceId
        ),
      profissionalId:
        String(
          scenario.professionalId
        ),
    });

  const cases = [
    {
      name:
        "catalogo_publico",
      path:
        "/negocios-publicos?pagina=1&limite=12",
    },
    {
      name:
        "perfil_publico",
      path:
        `/perfil-negocio/${encodeURIComponent(scenario.slug)}`,
    },
    {
      name:
        "agenda_publica",
      path:
        `/agenda-publica?${agendaParams.toString()}`,
    },
  ];

  const results = [];

  for (const testCase of cases) {
    const metrics =
      await executarLote(
        testCase.path
      );

    results.push({
      ...testCase,
      ...metrics,
      threshold_ms:
        THRESHOLD_MS,
      passed:
        metrics.p95_ms <=
        THRESHOLD_MS,
    });
  }

  const report = {
    measured_at:
      new Date()
        .toISOString(),
    target:
      TARGET_URL,
    profile: {
      samples_per_endpoint:
        SAMPLE_COUNT,
      concurrency:
        CONCURRENCY,
      warmups_per_endpoint:
        3,
      method:
        "GET-only, cold HTTP requests from GitHub-hosted QA runner",
    },
    scenario,
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
      "api-p95.json"
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
