import { performance } from "node:perf_hooks";
import { verifyQaBuild } from "./admin-performance-qa-identity.mjs";

const baseUrl = process.env.PERF_ADMIN_TARGET_URL;
const token = process.env.PERF_ADMIN_TOKEN;
const actorId = process.env.PERF_ADMIN_ACTOR_ID;
const samples = Number(process.env.PERF_ADMIN_SAMPLES || 30);
const concurrency = Number(process.env.PERF_ADMIN_CONCURRENCY || 3);
const limitMs = Number(process.env.PERF_ADMIN_P95_MS || 2000);
const buildSha = process.env.PERF_ADMIN_BUILD_SHA;

if (!baseUrl || !token || !/^[1-9]\d*$/.test(actorId || "") ||
    !Number.isInteger(samples) || samples < 10 || samples > 100 ||
    !Number.isInteger(concurrency) || concurrency < 1 || concurrency > 10 ||
    !Number.isFinite(limitMs) || limitMs <= 0 ||
    !/^[a-f0-9]{40}$/i.test(buildSha || "")) {
  throw new Error("Configure URL, token, ator e SHA do build QA; use 10–100 amostras e concorrência de 1–10.");
}

const target = new URL(baseUrl);
if (!["https:", "http:"].includes(target.protocol) || target.username || target.password) {
  throw new Error("PERF_ADMIN_TARGET_URL deve ser HTTP(S) sem credenciais na URL.");
}

await verifyQaBuild(target, buildSha);

async function measure(path) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);
  const start = performance.now();
  try {
    const response = await fetch(new URL(path, target), {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
        "Cache-Control": "no-cache"
      },
      redirect: "error",
      signal: controller.signal
    });
    if (!response.ok) throw new Error(`Auditoria retornou HTTP ${response.status}.`);
    const body = await response.json();
    if (!Array.isArray(body.eventos)) throw new Error("Resposta de auditoria inválida.");
    return performance.now() - start;
  } finally {
    clearTimeout(timeout);
  }
}

async function sample(path) {
  for (let i = 0; i < 3; i += 1) await measure(path);
  const durations = [];
  let next = 0;
  await Promise.all(Array.from({ length: concurrency }, async () => {
    while (next < samples) {
      next += 1;
      durations.push(await measure(path));
    }
  }));
  durations.sort((a, b) => a - b);
  return Number(durations[Math.ceil(samples * 0.95) - 1].toFixed(2));
}

const scenarios = {
  recentes: "/admin/auditoria?limite=25",
  pendentes: "/admin/auditoria?resultado=PENDENTE&limite=25",
  revisadas: "/admin/auditoria?resultado=REVISADA&limite=25",
  ator: `/admin/auditoria?atorId=${actorId}&limite=25`
};

let failed = false;
for (const [name, path] of Object.entries(scenarios)) {
  const p95Ms = await sample(path);
  const passed = p95Ms <= limitMs;
  process.stdout.write(`${JSON.stringify({cenario:name,buildSha,amostras:samples,aquecimentos:3,concorrencia:concurrency,p95Ms,limiteMs:limitMs,aprovado:passed})}\n`);
  if (!passed) failed = true;
}
if (failed) process.exitCode = 1;
