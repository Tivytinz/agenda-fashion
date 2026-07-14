const { Pool } = require("pg");

const isProduction =
  process.env.NODE_ENV === "production";

const pool = new Pool({
  connectionString:
    process.env.DATABASE_URL,

  ssl: isProduction
    ? {
        rejectUnauthorized: false,
      }
    : false,
});

async function query(text, params) {
  return pool.query(text, params);
}

async function conectar() {
  return pool.connect();
}

async function executarTransacao(callback) {
  const client =
    await pool.connect();

  try {
    await client.query("BEGIN");

    const resultado =
      await callback(client);

    await client.query("COMMIT");

    return resultado;
  } catch (erro) {
    try {
      await client.query("ROLLBACK");
    } catch (erroRollback) {
      console.error(
        "Erro ao desfazer transação no PostgreSQL:",
        erroRollback
      );
    }

    throw erro;
  } finally {
    client.release();
  }
}

async function encerrarConexoes() {
  await pool.end();
}

module.exports = {
  query,
  conectar,
  executarTransacao,
  encerrarConexoes,
};