// Creates a throwaway superadmin only inside the disposable local QA database.
// The token is written to GitHub Actions' private environment file, not stdout.
const { appendFile } = require("node:fs/promises");
const crypto = require("node:crypto");
const { Client } = require("pg");
const jwt = require("jsonwebtoken");

function config(env = process.env) {
  let url;
  try { url = new URL(env.PERF_ADMIN_QA_DATABASE_URL); } catch {
    throw new Error("Configure o banco QA descartável.");
  }
  const name = decodeURIComponent(url.pathname.slice(1));
  if (env.NODE_ENV !== "test" ||
      !["postgres:", "postgresql:"].includes(url.protocol) ||
      !["127.0.0.1", "localhost", "[::1]"].includes(url.hostname) ||
      url.search || url.hash ||
      !/^[a-z0-9_-]*(?:_qa|_test)$/i.test(name) ||
      name !== env.PERF_ADMIN_QA_DATABASE_NAME ||
      name !== env.PERF_ADMIN_QA_ACTOR_CONFIRM ||
      env.DATABASE_URL !== env.PERF_ADMIN_QA_DATABASE_URL ||
      !env.JWT_SECRET || env.JWT_SECRET.length < 32 ||
      !env.GITHUB_ENV) {
    throw new Error("Ator QA exige banco local confirmado, JWT de teste e GITHUB_ENV.");
  }
  return { name, url: env.PERF_ADMIN_QA_DATABASE_URL,
    secret: env.JWT_SECRET, envFile: env.GITHUB_ENV };
}

async function createActor(client, cfg) {
  await client.query("BEGIN");
  try {
    const { rows: [db] } = await client.query("SELECT current_database() AS name");
    if (db.name !== cfg.name) throw new Error("Banco QA não corresponde ao confirmado.");
    const email = `qa-auditoria-${crypto.randomUUID()}@example.invalid`;
    const { rows: [user] } = await client.query(`
      INSERT INTO usuarios (nome, email, senha, whatsapp)
      VALUES ('Ator QA Auditoria', $1, $2, '11000000000') RETURNING id
    `, [email, crypto.randomBytes(32).toString("hex")]);
    await client.query(`
      INSERT INTO usuarios_administradores (usuario_id, papel)
      VALUES ($1, 'superadmin')
    `, [user.id]);
    await client.query("COMMIT");
    return jwt.sign({ id: Number(user.id) }, cfg.secret,
      { algorithm: "HS256", expiresIn: "1h" });
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    throw error;
  }
}

async function main() {
  const cfg = config();
  const client = new Client({ connectionString: cfg.url, connectionTimeoutMillis: 5000 });
  await client.connect();
  let token;
  try { token = await createActor(client, cfg); } finally { await client.end(); }
  // GITHUB_ENV is provided by Actions; never write this token to an artifact.
  await appendFile(cfg.envFile, `PERF_ADMIN_TOKEN=${token}\n`, { mode: 0o600 });
  process.stdout.write("Ator sintético de auditoria criado no banco QA.\n");
}

if (require.main === module) main().catch(() => {
  process.stderr.write("Não foi possível preparar o ator QA.\n");
  process.exitCode = 1;
});

module.exports = { config, createActor };
