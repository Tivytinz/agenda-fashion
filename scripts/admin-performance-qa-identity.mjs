// Both audit benchmarks must identify the responding QA application before
// reporting a measurement. This value is configured on the application from
// the checked-out commit, independently of the benchmark process.
export async function verifyQaBuild(target, expectedSha) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);
  try {
    const response = await fetch(new URL("/health/ready", target), {
      headers: { Accept: "application/json", "Cache-Control": "no-cache" },
      redirect: "error",
      signal: controller.signal
    });
    if (!response.ok) throw new Error("O serviço QA não está pronto.");
    const health = await response.json();
    if (health.status !== "ready" || health.database !== "ok" ||
        health.buildSha !== expectedSha.toLowerCase()) {
      throw new Error("O build do serviço QA não corresponde ao commit informado.");
    }
  } finally {
    clearTimeout(timeout);
  }
}
