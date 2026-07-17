const {
  Pool,
} = require("pg");

const isProduction =
  process.env.NODE_ENV ===
  "production";

const pool =
  new Pool({
    connectionString:
      process.env.DATABASE_URL,

    ssl:
      isProduction
        ? {
            rejectUnauthorized:
              false,
          }
        : false,

    /*
     * Nos testes, permite que o Node
     * finalize mesmo com conexões
     * ociosas no pool.
     */
    allowExitOnIdle:
      process.env.NODE_ENV ===
      "test",
  });

pool.on(
  "error",
  (erro) => {
    console.error(
      "Erro inesperado no pool do PostgreSQL:",
      erro
    );
  }
);

/*
 * Executa uma consulta comum.
 */
function query(
  texto,
  parametros
) {
  return pool.query(
    texto,
    parametros
  );
}

/*
 * Obtém uma conexão exclusiva.
 *
 * Quem utilizar essa função deve
 * chamar client.release() ao terminar.
 */
function connect() {
  return pool.connect();
}

/*
 * Executa várias operações dentro
 * da mesma transação.
 *
 * Em caso de erro:
 * - executa ROLLBACK;
 * - relança o erro;
 * - libera a conexão.
 */
async function executarTransacao(
  callback
) {
  if (
    typeof callback !==
    "function"
  ) {
    throw new TypeError(
      "A transação precisa receber uma função."
    );
  }

  const client =
    await pool.connect();

  try {
    await client.query(
      "BEGIN"
    );

    const resultado =
      await callback(client);

    await client.query(
      "COMMIT"
    );

    return resultado;
  } catch (erro) {
    try {
      await client.query(
        "ROLLBACK"
      );
    } catch (
      erroRollback
    ) {
      console.error(
        "Erro ao executar ROLLBACK:",
        erroRollback
      );
    }

    throw erro;
  } finally {
    client.release();
  }
}

/*
 * Encerra todas as conexões.
 *
 * Usado principalmente nos testes
 * e no encerramento controlado.
 */
function end() {
  return pool.end();
}

module.exports = {
  query,
  connect,
  executarTransacao,
  end,
};