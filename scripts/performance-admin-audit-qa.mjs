// Writes are restricted to a disposable, locally reachable QA application and database.
// The target application must use the same database: a seeded attempt is checked
// through the API before the first administrative write.
import crypto from "node:crypto";
import { performance } from "node:perf_hooks";
import pg from "pg";
import { verifyQaBuild } from "./admin-performance-qa-identity.mjs";

class QaError extends Error {}

const positive = (value) => /^[1-9]\d*$/.test(String(value || "")) &&
  Number.isSafeInteger(Number(value)) ? Number(value) : null;
const loopback = (host) => ["localhost", "127.0.0.1", "[::1]"].includes(host);

function config() {
  const { env } = process;
  let target;
  let database;
  try {
    target = new URL(env.PERF_ADMIN_TARGET_URL);
    database = new URL(env.PERF_ADMIN_QA_DATABASE_URL);
  } catch {
    throw new QaError("Configure as URLs da aplicação e do banco QA.");
  }
  const name = decodeURIComponent(database.pathname.slice(1));
  const samples = positive(env.PERF_ADMIN_SAMPLES || "30");
  const concurrency = positive(env.PERF_ADMIN_CONCURRENCY || "3");
  const minAttempts = positive(env.PERF_ADMIN_MIN_ATTEMPTS);
  const minReviews = positive(env.PERF_ADMIN_MIN_REVIEWS);
  if (env.NODE_ENV !== "test" || !env.PERF_ADMIN_TOKEN ||
      !/^[a-f0-9]{40}$/i.test(env.PERF_ADMIN_BUILD_SHA || "") ||
      !samples || samples < 10 || samples > 100 ||
      !concurrency || concurrency > 10 || !minAttempts || !minReviews ||
      !/^[a-z0-9_-]*(?:_test|_qa)$/i.test(name) ||
      env.PERF_ADMIN_QA_DATABASE_NAME !== name ||
      !["http:", "https:"].includes(target.protocol) ||
      !loopback(target.hostname) || target.username || target.password ||
      target.pathname !== "/" || target.search || target.hash ||
      !["postgres:", "postgresql:"].includes(database.protocol) ||
      !loopback(database.hostname) || database.search || database.hash) {
    throw new QaError("QA exige NODE_ENV=test, commit, limites de volume, token e URLs loopback; confirme o nome de banco *_test ou *_qa.");
  }
  return { target, databaseUrl: env.PERF_ADMIN_QA_DATABASE_URL, name,
    token: env.PERF_ADMIN_TOKEN, buildSha: env.PERF_ADMIN_BUILD_SHA,
    samples, concurrency, minAttempts, minReviews };
}

async function request(cfg, method, path, requestId, payload) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);
  const started = performance.now();
  try {
    const response = await fetch(new URL(path, cfg.target), {
      method,
      headers: {
        Authorization: `Bearer ${cfg.token}`,
        Accept: "application/json",
        "Cache-Control": "no-cache",
        ...(requestId ? { "X-Request-ID": requestId } : {}),
        ...(payload ? { "Content-Type": "application/json" } : {})
      },
      body: payload ? JSON.stringify(payload) : undefined,
      redirect: "error",
      signal: controller.signal
    });
    // Include response body transfer and parsing in the end-to-end API timing.
    const body = await response.json();
    return { status: response.status, body, ms: performance.now() - started };
  } finally {
    clearTimeout(timeout);
  }
}

async function measure(cfg, name, perform) {
  const run = async (index) => {
    const id = `qa_${cfg.runId}_${name}_${index}`;
    const result = await perform(index, id);
    if (result.status !== 201) throw new QaError(`Cenário ${name}: resposta HTTP inesperada.`);
    cfg.requestIds.push(crypto.createHash("sha256").update(id).digest("hex"));
    return result.ms;
  };
  for (let i = 0; i < 3; i += 1) await run(i);
  const timings = [];
  let next = 3;
  let aborted = false;
  const workers = await Promise.allSettled(Array.from({ length: cfg.concurrency }, async () => {
    while (!aborted && next < cfg.samples + 3) {
      const index = next++;
      try {
        timings.push(await run(index));
      } catch (error) {
        aborted = true;
        throw error;
      }
    }
  }));
  const failure = workers.find((worker) => worker.status === "rejected");
  if (failure) throw failure.reason;
  timings.sort((a, b) => a - b);
  const p95Ms = Number(timings[Math.ceil(cfg.samples * 0.95) - 1].toFixed(2));
  const result = { cenario: name, amostras: cfg.samples, aquecimentos: 3,
    concorrencia: cfg.concurrency, p95Ms, limiteMs: 2000,
    aprovado: p95Ms <= 2000 };
  process.stdout.write(`${JSON.stringify(result)}\n`);
  if (!result.aprovado) process.exitCode = 1;
}

async function verifyLedger(client, cfg) {
  // RESULTADO is written asynchronously after HTTP finish; wait only for
  // completion of this run, without including it in the response-time p95.
  for (let tries = 0; tries < 25; tries += 1) {
    const { rows } = await client.query(`
      SELECT request_id,
        COUNT(*) FILTER (WHERE fase = 'INICIADA')::INT AS started,
        COUNT(*) FILTER (WHERE fase = 'RESULTADO')::INT AS finished
      FROM admin_auditoria_eventos WHERE request_id = ANY($1::VARCHAR[])
      GROUP BY request_id
    `, [cfg.requestIds]);
    if (rows.length === cfg.requestIds.length &&
        rows.every((row) => row.started === 1 && row.finished === 1)) return;
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  throw new QaError("A trilha desta execução não contém todas as tentativas e resultados HTTP.");
}

async function seedAttempts(client, ids, actor) {
  await client.query(`
    INSERT INTO admin_auditoria_eventos (
      tentativa_id, fase, ator_usuario_id, papel_admin, acao, alvo_tipo, ocorrido_em
    ) SELECT item.tentativa_id, 'INICIADA', $2, 'superadmin', 'campanha_criar', 'campanha',
        NOW() - INTERVAL '15 minutes'
      FROM UNNEST($1::UUID[]) AS item(tentativa_id)
  `, [ids, actor]);
}

async function main() {
  const cfg = config();
  // A mismatched application must be rejected before connecting to, or
  // inserting fixtures in, the disposable QA database.
  await verifyQaBuild(cfg.target, cfg.buildSha);
  const client = new pg.Client({ connectionString: cfg.databaseUrl, connectionTimeoutMillis: 5000 });
  await client.connect();
  try {
    const { rows: [stats] } = await client.query(`
      SELECT current_database() AS database,
        (SELECT COUNT(*)::INT FROM admin_auditoria_eventos WHERE fase = 'INICIADA') AS attempts,
        (SELECT COUNT(*)::INT FROM admin_auditoria_revisoes) AS reviews
    `);
    if (stats.database !== cfg.name || stats.attempts < cfg.minAttempts ||
        stats.reviews < cfg.minReviews) {
      throw new QaError("Banco QA não corresponde à confirmação ou ao volume mínimo informado.");
    }
    cfg.runId = crypto.randomBytes(6).toString("hex");
    cfg.requestIds = [];
    const fixtureActor = crypto.randomInt(900000000000, 900999999999);
    const ids = Array.from({ length: cfg.samples + 4 }, () => crypto.randomUUID());
    await seedAttempts(client, [ids[0]], fixtureActor);
    // A wrong application/database pairing must stop before POST requests.
    const preflight = await request(cfg, "GET",
      `/admin/auditoria?atorId=${fixtureActor}&limite=25`);
    if (preflight.status !== 200 ||
        !preflight.body?.eventos?.some((row) => row.tentativaId === ids[0])) {
      throw new QaError("O alvo HTTP não consulta o banco QA com as fixtures desta execução.");
    }
    await seedAttempts(client, ids.slice(1), fixtureActor);
    process.stdout.write(`${JSON.stringify({ cenario: "perfil", buildSha: cfg.buildSha,
      banco: cfg.name, tentativasAntes: stats.attempts, revisoesAntes: stats.reviews,
      minimoTentativas: cfg.minAttempts, minimoRevisoes: cfg.minReviews })}\n`);

    await measure(cfg, "campanha_criar", async (index, requestId) => {
      const result = await request(cfg, "POST", "/admin/marketing/gestao-campanhas",
        requestId, { nome: `QA Performance ${cfg.runId} ${index}`, canal: "outro",
          objetivo: "profissional", utmSource: `qa_perf_${cfg.runId}`,
          utmMedium: "cpc", utmCampaign: `medicao_${index}`, destinoPath: "/" });
      if (result.status === 201 && !positive(result.body?.campanha?.id)) {
        throw new QaError("Campanha de QA não foi persistida.");
      }
      return result;
    });
    await measure(cfg, "auditoria_revisar", async (index, requestId) => {
      const tentativaId = ids[index + 1];
      const result = await request(cfg, "POST", `/admin/auditoria/${tentativaId}/revisao`,
        requestId, { avaliacao: "INDETERMINADO", evidenciaTipo: "TRILHA_DOMINIO",
          evidenciaReferencia: `qa_${cfg.runId}_${index}` });
      if (result.status === 201 && result.body?.revisao?.tentativaId !== tentativaId) {
        throw new QaError("Revisão de QA não corresponde à tentativa preparada.");
      }
      return result;
    });
    const { rows: [reviews] } = await client.query(`
      SELECT COUNT(*)::INT AS total FROM admin_auditoria_revisoes
      WHERE tentativa_id = ANY($1::UUID[])
    `, [ids.slice(1)]);
    if (reviews.total !== cfg.samples + 3) {
      throw new QaError("Parte das revisões de QA não foi persistida.");
    }
    await verifyLedger(client, cfg);
    process.stdout.write(`${JSON.stringify({ cenario: "integridade", revisoes: reviews.total,
      paresAuditoria: cfg.requestIds.length, aprovado: true })}\n`);
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  // Never print DATABASE_URL, token, request body or untrusted server responses.
  process.stderr.write(`${error instanceof QaError ? error.message : "Falha de conexão ou execução no QA administrativo."}\n`);
  process.exitCode = 1;
});
