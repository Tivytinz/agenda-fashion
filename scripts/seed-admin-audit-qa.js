// Synthetic audit load for a new, disposable local database only. Never copy
// production rows or use this script against a shared or persistent database.
const { Client } = require("pg");

function positive(value) {
  return /^[1-9]\d*$/.test(String(value || "")) &&
    Number.isSafeInteger(Number(value)) ? Number(value) : null;
}

function validateConfig(env = process.env) {
  let url;
  try {
    url = new URL(env.PERF_ADMIN_QA_DATABASE_URL);
  } catch {
    throw new Error("Configure a URL do banco QA descartável.");
  }
  const name = decodeURIComponent(url.pathname.slice(1));
  const attempts = positive(env.PERF_ADMIN_SEED_ATTEMPTS);
  const results = positive(env.PERF_ADMIN_SEED_RESULTS);
  const reviews = positive(env.PERF_ADMIN_SEED_REVIEWS);
  const pending = positive(env.PERF_ADMIN_SEED_PENDING);
  if (env.NODE_ENV !== "test" ||
      !["postgres:", "postgresql:"].includes(url.protocol) ||
      !["localhost", "127.0.0.1", "[::1]"].includes(url.hostname) ||
      url.search || url.hash ||
      !/^[a-z0-9_-]*(?:_test|_qa)$/i.test(name) ||
      env.PERF_ADMIN_QA_DATABASE_NAME !== name ||
      env.PERF_ADMIN_SEED_CONFIRM !== name ||
      !attempts || attempts < 100 || attempts > 200000 ||
      !results || !reviews || !pending ||
      results + reviews + pending !== attempts) {
    throw new Error("Carga QA exige NODE_ENV=test, banco local *_qa/*_test vazio, confirmação do nome e contagens válidas.");
  }
  return { url: env.PERF_ADMIN_QA_DATABASE_URL, name,
    attempts, results, reviews, pending };
}

async function seed(client, cfg) {
  await client.query("BEGIN");
  try {
    await client.query("SET LOCAL statement_timeout = '60s'");
    const { rows: [before] } = await client.query(`
      SELECT current_database() AS name,
        (SELECT COUNT(*)::INT FROM admin_auditoria_eventos) AS events,
        (SELECT COUNT(*)::INT FROM admin_auditoria_revisoes) AS reviews
    `);
    if (before.name !== cfg.name || before.events !== 0 || before.reviews !== 0) {
      throw new Error("Banco QA não está vazio ou não corresponde ao nome confirmado.");
    }

    await client.query(`
      CREATE TEMP TABLE af_qa_seed_keys ON COMMIT DROP AS
      SELECT n, gen_random_uuid() AS tentativa_id,
        CASE WHEN n % 5 = 0 THEN 'contribuicao_integracao_atualizar'
             WHEN n % 5 = 1 THEN 'gasto_registrar'
             ELSE 'campanha_criar' END AS acao,
        CASE WHEN n % 5 = 0 THEN 'integracao'
             WHEN n % 5 = 1 THEN 'gasto'
             ELSE 'campanha' END AS alvo_tipo
      FROM generate_series(1, $1::INT) AS n
    `, [cfg.attempts]);
    const started = await client.query(`
      INSERT INTO admin_auditoria_eventos
        (tentativa_id, fase, ator_usuario_id, papel_admin, acao, alvo_tipo, ocorrido_em)
      SELECT tentativa_id, 'INICIADA', 900000000000::BIGINT + (n % 50),
        'superadmin', acao, alvo_tipo,
        NOW() - INTERVAL '15 minutes' - (n % 30) * INTERVAL '1 day'
      FROM af_qa_seed_keys
    `);
    const finished = await client.query(`
      INSERT INTO admin_auditoria_eventos
        (tentativa_id, fase, ator_usuario_id, papel_admin, acao,
         alvo_tipo, resultado, http_status, ocorrido_em)
      SELECT tentativa_id, 'RESULTADO', 900000000000::BIGINT + (n % 50),
        'superadmin', acao, alvo_tipo,
        CASE WHEN n % 10 = 0 THEN 'HTTP_ERRO' ELSE 'HTTP_OK' END,
        CASE WHEN n % 10 = 0 THEN 503 ELSE 201 END,
        NOW() - INTERVAL '15 minutes' - (n % 30) * INTERVAL '1 day'
      FROM af_qa_seed_keys WHERE n <= $1
    `, [cfg.results]);
    const reviewed = await client.query(`
      INSERT INTO admin_auditoria_revisoes
        (tentativa_id, revisor_usuario_id, avaliacao, evidencia_tipo,
         evidencia_referencia_sha256)
      SELECT tentativa_id, 900000000001::BIGINT, 'INDETERMINADO',
        'TRILHA_DOMINIO', repeat('a', 64)
      FROM af_qa_seed_keys WHERE n > $1 AND n <= $2
    `, [cfg.results, cfg.results + cfg.reviews]);
    if (started.rowCount !== cfg.attempts || finished.rowCount !== cfg.results ||
        reviewed.rowCount !== cfg.reviews) {
      throw new Error("Contagens da carga QA não correspondem ao perfil solicitado.");
    }
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  }
  return { cenario: "carga_sintetica_qa", banco: cfg.name,
    tentativas: cfg.attempts, resultados: cfg.results,
    revisoes: cfg.reviews, pendentes: cfg.pending };
}

async function main() {
  const cfg = validateConfig();
  const client = new Client({ connectionString: cfg.url, connectionTimeoutMillis: 5000 });
  await client.connect();
  try {
    process.stdout.write(`${JSON.stringify(await seed(client, cfg))}\n`);
  } finally {
    await client.end();
  }
}

if (require.main === module) {
  main().catch(() => {
    // Do not print connection strings, credentials or database error details.
    process.stderr.write("Carga QA rejeitada ou falhou; confira banco descartável e parâmetros.\n");
    process.exitCode = 1;
  });
}

module.exports = { validateConfig, seed };
