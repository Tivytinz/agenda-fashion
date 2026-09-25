// Read-only aggregate profile. It never returns actor IDs, request IDs,
// evidence references, payloads or individual audit rows.
const { Client } = require("pg");

function validateConfig(env = process.env) {
  let url;
  try {
    url = new URL(env.PERF_ADMIN_PROFILE_DATABASE_URL);
  } catch {
    throw new Error("Configure a URL da leitura de perfil administrativo.");
  }
  const name = decodeURIComponent(url.pathname.slice(1));
  if (!["postgres:", "postgresql:"].includes(url.protocol) || !name ||
      env.PERF_ADMIN_PROFILE_CONFIRM_DATABASE !== name ||
      env.PERF_ADMIN_PROFILE_READ_ONLY !== "auditoria") {
    throw new Error("Confirme o nome do banco e o modo somente leitura da auditoria.");
  }
  return { url: env.PERF_ADMIN_PROFILE_DATABASE_URL, name };
}

async function profile(client, cfg) {
  await client.query("BEGIN READ ONLY");
  try {
    await client.query("SET LOCAL statement_timeout = '10s'");
    const { rows: [identity] } = await client.query("SELECT current_database() AS name");
    if (identity.name !== cfg.name) throw new Error("Banco consultado não corresponde ao nome confirmado.");
    const { rows: [row] } = await client.query(`
      SELECT COUNT(*)::BIGINT AS attempts,
        COUNT(*) FILTER (WHERE r.id IS NOT NULL)::BIGINT AS results,
        COUNT(*) FILTER (WHERE r.id IS NULL AND v.id IS NOT NULL)::BIGINT AS reviews,
        COUNT(*) FILTER (WHERE r.id IS NULL AND v.id IS NULL)::BIGINT AS pending,
        COUNT(*) FILTER (WHERE i.ocorrido_em >= NOW() - INTERVAL '30 days')::BIGINT AS last30days,
        COUNT(DISTINCT i.ator_usuario_id)::BIGINT AS actors
      FROM admin_auditoria_eventos i
      LEFT JOIN admin_auditoria_eventos r
        ON r.tentativa_id = i.tentativa_id AND r.fase = 'RESULTADO'
      LEFT JOIN admin_auditoria_revisoes v ON v.tentativa_id = i.tentativa_id
      WHERE i.fase = 'INICIADA'
    `);
    const { rows: actions } = await client.query(`
      SELECT acao, COUNT(*)::BIGINT AS total
      FROM admin_auditoria_eventos WHERE fase = 'INICIADA'
      GROUP BY acao ORDER BY acao
    `);
    const counts = Object.fromEntries(Object.entries(row)
      .map(([key, value]) => [key, Number(value)]));
    if (Object.values(counts).some((value) => !Number.isSafeInteger(value))) {
      throw new Error("Volume de auditoria excede a precisão segura do relatório.");
    }
    await client.query("COMMIT");
    return { cenario: "perfil_aggregate_auditoria", medidoEm: new Date().toISOString(),
      ...counts, acoes: actions.map(({ acao, total }) => ({ acao, total: Number(total) })) };
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    throw error;
  }
}

async function main() {
  const cfg = validateConfig();
  const client = new Client({ connectionString: cfg.url, connectionTimeoutMillis: 5000 });
  await client.connect();
  try {
    process.stdout.write(`${JSON.stringify(await profile(client, cfg))}\n`);
  } finally {
    await client.end();
  }
}

if (require.main === module) {
  main().catch(() => {
    // Never print DB connection details or raw SQL errors.
    process.stderr.write("Leitura agregada indisponível; confira permissão e banco informado.\n");
    process.exitCode = 1;
  });
}

module.exports = { validateConfig, profile };
