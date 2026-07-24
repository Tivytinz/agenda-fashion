const fs = require("fs");
const path = require("path");
const dotenv = require("dotenv");
const { Client } = require("pg");

dotenv.config({
  path: path.resolve(__dirname, "../.env.test"),
  override: true,
  quiet: true
});

if (process.env.NODE_ENV !== "test") {
  throw new Error("Migration bloqueada: NODE_ENV não é test.");
}

const banco = new URL(process.env.DATABASE_URL);

if (banco.hostname === "acela.proxy.rlwy.net") {
  throw new Error("Migration bloqueada: banco de produção detectado.");
}

async function executar() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: {
      rejectUnauthorized: false
    }
  });

  await client.connect();

  const pasta = path.resolve(
    __dirname,
    "../database/migrations"
  );

  const migrations = fs
    .readdirSync(pasta)
    .filter((arquivo) => arquivo.endsWith(".sql"))
    .sort();

  try {
    for (const migration of migrations) {
      const sql = fs.readFileSync(
        path.join(pasta, migration),
        "utf8"
      );

      console.log(`Aplicando ${migration}...`);

      await client.query("BEGIN");

      try {
        await client.query(sql);
        await client.query("COMMIT");
      } catch (erro) {
        await client.query("ROLLBACK");
        throw new Error(`${migration}: ${erro.message}`);
      }
    }

    console.log("Todas as migrations foram aplicadas no banco de teste.");
  } finally {
    await client.end();
  }
}

executar().catch((erro) => {
  console.error("ERRO:", erro.message);
  process.exit(1);
});