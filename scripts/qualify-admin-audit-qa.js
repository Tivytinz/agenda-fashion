// Executes the six audit scenarios against one isolated QA application/database.
// Reports measured results and volume comparison, never automatic ADM-043 coverage.
const { execFile } = require("node:child_process");
const { readFile } = require("node:fs/promises");
const { join } = require("node:path");
const { promisify } = require("node:util");

const execute = promisify(execFile);
const script = (name) => join(__dirname, name);
const writeScenarios = ["campanha_criar", "auditoria_revisar"];
const readScenarios = ["recentes", "pendentes", "revisadas", "ator"];

function config(env = process.env) {
  let target;
  let database;
  try {
    target = new URL(env.PERF_ADMIN_TARGET_URL);
    database = new URL(env.PERF_ADMIN_QA_DATABASE_URL);
  } catch {
    throw new Error("Configure a aplicação e o banco QA isolados.");
  }
  const name = decodeURIComponent(database.pathname.slice(1));
  if (env.NODE_ENV !== "test" ||
      target.protocol !== "http:" ||
      !["127.0.0.1", "localhost", "[::1]"].includes(target.hostname) ||
      target.username || target.password || target.pathname !== "/" ||
      target.search || target.hash ||
      !["postgres:", "postgresql:"].includes(database.protocol) ||
      !["127.0.0.1", "localhost", "[::1]"].includes(database.hostname) ||
      database.search || database.hash ||
      !/^[a-z0-9_-]*(?:_qa|_test)$/i.test(name) ||
      env.PERF_ADMIN_QA_DATABASE_NAME !== name ||
      !/^[a-f0-9]{40}$/i.test(env.PERF_ADMIN_BUILD_SHA || "") ||
      !/^[1-9]\d*$/.test(env.PERF_ADMIN_ACTOR_ID || "") ||
      !env.PERF_ADMIN_REFERENCE_FILE || !env.PERF_ADMIN_TOKEN) {
    throw new Error("Qualificação exige aplicação e PostgreSQL loopback, SHA, ator, token e perfil de referência.");
  }
  return { name, sha: env.PERF_ADMIN_BUILD_SHA,
    referenceFile: env.PERF_ADMIN_REFERENCE_FILE };
}

function parseLines(output) {
  return output.trim().split(/\r?\n/).filter(Boolean).map((line) => JSON.parse(line));
}

function validProfile(profile) {
  const keys = ["attempts", "results", "reviews", "pending", "last30days", "actors"];
  if (!profile || profile.cenario !== "perfil_aggregate_auditoria" ||
      !Number.isFinite(Date.parse(profile.medidoEm)) ||
      keys.some((key) => !Number.isSafeInteger(profile[key]) || profile[key] < 0) ||
      profile.results + profile.reviews + profile.pending !== profile.attempts ||
      profile.last30days > profile.attempts || profile.actors > profile.attempts ||
      !Array.isArray(profile.acoes) ||
      profile.acoes.some((item) => !/^[a-z0-9_]+$/.test(item.acao) ||
        !Number.isSafeInteger(item.total) || item.total < 0) ||
      profile.acoes.reduce((sum, item) => sum + item.total, 0) !== profile.attempts) {
    throw new Error("Perfil agregado inválido ou com contagens inconsistentes.");
  }
  return Object.fromEntries(keys.map((key) => [key, profile[key]]));
}

function report(reference, before, after, writes, reads, cfg) {
  const baseline = validProfile(reference);
  const qaBefore = validProfile(before);
  const qaAfter = validProfile(after);
  const writeProfile = writes.find((line) => line.cenario === "perfil");
  const integrity = writes.find((line) => line.cenario === "integridade");
  const measured = [...writes, ...reads].filter((line) =>
    [...writeScenarios, ...readScenarios].includes(line.cenario));
  const names = [...writeScenarios, ...readScenarios];
  const writeSamples = measured.find((row) => row.cenario === writeScenarios[0])?.amostras;
  if (writes.length !== 4 || reads.length !== 4 ||
      measured.length !== names.length ||
      names.some((name) => measured.filter((row) => row.cenario === name).length !== 1) ||
      !writeProfile || writeProfile.buildSha !== cfg.sha || writeProfile.banco !== cfg.name ||
      writeProfile.tentativasAntes !== qaBefore.attempts ||
      writeProfile.revisoesAntes !== qaBefore.reviews ||
      !integrity || integrity.aprovado !== true ||
      !Number.isSafeInteger(integrity.paresAuditoria) ||
      integrity.paresAuditoria !== 2 * (writeSamples + 3) ||
      integrity.revisoes !== writeSamples + 3 ||
      measured.some((row) => !Number.isInteger(row.amostras) || row.amostras < 10 ||
        !Number.isInteger(row.concorrencia) || row.concorrencia < 1 ||
        !Number.isFinite(row.p95Ms) || row.p95Ms < 0 ||
        row.limiteMs !== 2000 || row.aprovado !== (row.p95Ms <= 2000)) ||
      measured.some((row) => row.amostras !== writeSamples ||
        row.concorrencia !== measured[0].concorrencia) ||
      reads.some((row) => readScenarios.includes(row.cenario) && row.buildSha !== cfg.sha) ||
      qaAfter.attempts < qaBefore.attempts + 3 * (writeSamples + 3) + 1 ||
      qaAfter.results < qaBefore.results + 2 * (writeSamples + 3) ||
      qaAfter.reviews < qaBefore.reviews + writeSamples + 3) {
    throw new Error("Medição incompleta, divergente do banco/build ou sem integridade comprovada.");
  }
  return {
    cenario: "qualificacao_admin_043", buildSha: cfg.sha, medidoEm: new Date().toISOString(),
    referenciaEm: reference.medidoEm,
    volumes: { referencia: baseline, qaAntes: qaBefore, qaDepois: qaAfter },
    acoes: { referencia: reference.acoes, qaAntes: before.acoes },
    integridade: { paresAuditoria: integrity.paresAuditoria, revisoes: integrity.revisoes },
    medidas: names.map((name) => {
      const row = measured.find((item) => item.cenario === name);
      return { cenario: name, p95Ms: row.p95Ms, amostras: row.amostras,
        concorrencia: row.concorrencia, aprovado: row.aprovado };
    }),
    p95Aprovado: measured.every((row) => row.aprovado),
    adm043: "PENDENTE_VALIDACAO_REPRESENTATIVIDADE"
  };
}

async function run(name, env) {
  try {
    const { stdout } = await execute(process.execPath, [script(name)], {
      env, maxBuffer: 1024 * 1024, timeout: 15 * 60 * 1000
    });
    return parseLines(stdout);
  } catch (error) {
    // The medidores return exit 1 for p95 failures after emitting complete
    // JSON. Preserve those measurements; reject all incomplete runs below.
    if (error.code === 1 && error.stdout) return parseLines(error.stdout);
    throw error;
  }
}

async function main() {
  const cfg = config();
  const reference = JSON.parse(await readFile(cfg.referenceFile, "utf8"));
  validProfile(reference);
  const env = { ...process.env,
    PERF_ADMIN_PROFILE_DATABASE_URL: process.env.PERF_ADMIN_QA_DATABASE_URL,
    PERF_ADMIN_PROFILE_CONFIRM_DATABASE: cfg.name,
    PERF_ADMIN_PROFILE_READ_ONLY: "auditoria",
    PERF_ADMIN_P95_MS: "2000" };
  const beforeRows = await run("profile-admin-audit-volume.js", env);
  if (beforeRows.length !== 1) throw new Error("Perfil QA inicial incompleto.");
  const before = beforeRows[0];
  const writes = await run("performance-admin-audit-qa.mjs", env);
  const reads = await run("performance-admin-audit.mjs", env);
  const afterRows = await run("profile-admin-audit-volume.js", env);
  if (afterRows.length !== 1) throw new Error("Perfil QA final incompleto.");
  const after = afterRows[0];
  const result = report(reference, before, after, writes, reads, cfg);
  process.stdout.write(`${JSON.stringify(result)}\n`);
  if (!result.p95Aprovado) process.exitCode = 1;
}

if (require.main === module) {
  main().catch(() => {
    // Do not expose tokens, database URLs, reference paths or server responses.
    process.stderr.write("Qualificação incompleta; confira perfil, build, volumes e cenários no QA.\n");
    process.exitCode = 1;
  });
}

module.exports = { config, validProfile, report };
