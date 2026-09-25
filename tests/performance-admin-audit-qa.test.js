const { spawn, spawnSync } = require("node:child_process");
const http = require("node:http");
const path = require("node:path");

const script = path.join(__dirname, "../scripts/performance-admin-audit-qa.mjs");

function run(overrides = {}) {
  return spawnSync(process.execPath, [script], {
    encoding: "utf8",
    env: {
      ...process.env,
      NODE_ENV: "test",
      PERF_ADMIN_TARGET_URL: "http://127.0.0.1:3000",
      PERF_ADMIN_QA_DATABASE_URL: "postgresql://qa:private-pass@127.0.0.1:5432/agenda_fashion_qa",
      PERF_ADMIN_QA_DATABASE_NAME: "agenda_fashion_qa",
      PERF_ADMIN_BUILD_SHA: "a".repeat(40),
      PERF_ADMIN_MIN_ATTEMPTS: "1000",
      PERF_ADMIN_MIN_REVIEWS: "10",
      PERF_ADMIN_TOKEN: "private-token",
      ...overrides
    }
  });
}

describe("medidor de escritas administrativas", () => {
  test("recusa alvo HTTP público antes de conectar ou executar escritas", () => {
    const result = run({ PERF_ADMIN_TARGET_URL: "https://app.agendafashion.com.br" });
    expect(result.status).toBe(1);
    expect(result.stdout).toBe("");
    expect(result.stderr).toMatch(/URLs loopback/);
    expect(result.stderr).not.toMatch(/private-pass|private-token/);
  });

  test("recusa nome de banco não confirmado e ambiente de produção", () => {
    for (const env of [
      { PERF_ADMIN_QA_DATABASE_NAME: "outro_qa" },
      { NODE_ENV: "production" },
      { PERF_ADMIN_QA_DATABASE_URL: "postgresql://qa:private-pass@127.0.0.1/agenda_fashion_qa?host=db.railway.app" },
      { PERF_ADMIN_QA_DATABASE_URL: "postgresql://qa:private-pass@127.0.0.1:5432/agenda_fashion" }
    ]) {
      const result = run(env);
      expect(result.status).toBe(1);
      expect(result.stdout).toBe("");
      expect(result.stderr).not.toMatch(/private-pass|private-token/);
    }
  });
});

test("medidor de escritas rejeita build divergente antes de criar fixtures", async () => {
  const seen = [];
  const server = http.createServer((req, res) => {
    seen.push(req.url);
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ status: "ready", database: "ok", buildSha: "b".repeat(40) }));
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  try {
    const result = await new Promise((resolve, reject) => {
      const child = spawn(process.execPath, [script], {
        env: { ...process.env,
          NODE_ENV: "test", PERF_ADMIN_TOKEN: "private-token",
          PERF_ADMIN_TARGET_URL: `http://127.0.0.1:${server.address().port}`,
          PERF_ADMIN_QA_DATABASE_URL: "postgresql://qa:private-pass@127.0.0.1:1/agenda_fashion_qa",
          PERF_ADMIN_QA_DATABASE_NAME: "agenda_fashion_qa",
          PERF_ADMIN_BUILD_SHA: "a".repeat(40),
          PERF_ADMIN_MIN_ATTEMPTS: "1000", PERF_ADMIN_MIN_REVIEWS: "10"
        }
      });
      let stdout = "";
      child.stdout.on("data", (chunk) => { stdout += chunk; });
      child.on("error", reject);
      child.on("close", (code) => resolve({ code, stdout }));
    });
    expect(result.code).not.toBe(0);
    expect(result.stdout).toBe("");
    expect(seen).toEqual(["/health/ready"]);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

test("medidor de leituras aquece cada cenário e não imprime o token", async () => {
  const seen = new Map();
  const server = http.createServer((req, res) => {
    seen.set(req.url, (seen.get(req.url) || 0) + 1);
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify(req.url === "/health/ready"
      ? { status: "ready", database: "ok", buildSha: "a".repeat(40) }
      : { eventos: [] }));
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  try {
    const output = await new Promise((resolve, reject) => {
      const child = spawn(process.execPath, [path.join(__dirname,
        "../scripts/performance-admin-audit.mjs")], {
        env: { ...process.env,
          PERF_ADMIN_TARGET_URL: `http://127.0.0.1:${server.address().port}`,
          PERF_ADMIN_TOKEN: "private-token", PERF_ADMIN_ACTOR_ID: "17",
          PERF_ADMIN_SAMPLES: "10", PERF_ADMIN_CONCURRENCY: "2",
          PERF_ADMIN_BUILD_SHA: "a".repeat(40) }
      });
      let stdout = "";
      let stderr = "";
      child.stdout.on("data", (chunk) => { stdout += chunk; });
      child.stderr.on("data", (chunk) => { stderr += chunk; });
      child.on("error", reject);
      child.on("close", (code) => code === 0 ? resolve(stdout) : reject(new Error(stderr)));
    });
    const results = output.trim().split("\n").map((line) => JSON.parse(line));
    expect(results.map((row) => row.cenario)).toEqual([
      "recentes", "pendentes", "revisadas", "ator"
    ]);
    expect(results.every((row) => row.aquecimentos === 3 && row.amostras === 10 &&
      row.buildSha === "a".repeat(40) && row.aprovado)).toBe(true);
    expect(seen.get("/health/ready")).toBe(1);
    expect([...seen.entries()].filter(([path]) => path !== "/health/ready")
      .map(([, count]) => count)).toEqual([13, 13, 13, 13]);
    expect(output).not.toContain("private-token");
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

test("medidor de leituras rejeita build diferente antes de consultar auditoria", async () => {
  const seen = [];
  const server = http.createServer((req, res) => {
    seen.push(req.url);
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ status: "ready", database: "ok", buildSha: "b".repeat(40) }));
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  try {
    const result = await new Promise((resolve, reject) => {
      const child = spawn(process.execPath, [path.join(__dirname,
        "../scripts/performance-admin-audit.mjs")], {
        env: { ...process.env,
          PERF_ADMIN_TARGET_URL: `http://127.0.0.1:${server.address().port}`,
          PERF_ADMIN_TOKEN: "private-token", PERF_ADMIN_ACTOR_ID: "17",
          PERF_ADMIN_BUILD_SHA: "a".repeat(40) }
      });
      let stdout = "";
      child.stdout.on("data", (chunk) => { stdout += chunk; });
      child.on("error", reject);
      child.on("close", (code) => resolve({ code, stdout }));
    });
    expect(result.code).not.toBe(0);
    expect(result.stdout).toBe("");
    expect(seen).toEqual(["/health/ready"]);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});
