const db = require("../db/db");

async function executarComLock(provedor, callback) {
  if (typeof callback !== "function") {
    throw new TypeError(
      "A reconciliação de campanhas precisa receber uma função."
    );
  }

  const client = await db.connect();
  const chave = `agenda-fashion:marketing-campaign-sync:${provedor}`;
  let bloqueado = false;

  try {
    const resultado = await client.query(
      "SELECT pg_try_advisory_lock(hashtext($1)) AS bloqueado",
      [chave]
    );
    bloqueado = resultado.rows[0]?.bloqueado === true;

    if (!bloqueado) {
      return {
        executado: false,
        resultado: null
      };
    }

    return {
      executado: true,
      resultado: await callback()
    };
  } finally {
    if (bloqueado) {
      try {
        await client.query(
          "SELECT pg_advisory_unlock(hashtext($1))",
          [chave]
        );
      } catch (erro) {
        client.release(erro);
        throw erro;
      }
    }

    client.release();
  }
}

module.exports = {
  executarComLock
};
