require("dotenv").config();

const fs = require("fs");
const path = require("path");

const db = require(
  "../src/db/db"
);

async function encerrarConexao() {
  try {
    if (
      typeof db.end ===
      "function"
    ) {
      await db.end();
      return;
    }

    if (
      db.pool &&
      typeof db.pool.end ===
        "function"
    ) {
      await db.pool.end();
    }
  } catch (erro) {
    console.error(
      "Erro ao encerrar conexão:",
      erro.message
    );
  }
}

async function executar() {
  const caminhoInformado =
    process.argv[2];

  if (!caminhoInformado) {
    throw new Error(
      "Informe o caminho da migration."
    );
  }

  const caminhoCompleto =
    path.resolve(
      process.cwd(),
      caminhoInformado
    );

  if (
    !fs.existsSync(
      caminhoCompleto
    )
  ) {
    throw new Error(
      `Migration não encontrada: ${caminhoCompleto}`
    );
  }

  const sql =
    fs.readFileSync(
      caminhoCompleto,
      "utf8"
    );

  if (!sql.trim()) {
    throw new Error(
      "O arquivo SQL está vazio."
    );
  }

  console.log(
    `Executando migration: ${caminhoInformado}`
  );

  await db.query(sql);

  console.log(
    "Migration executada com sucesso."
  );
}

executar()
  .catch((erro) => {
    console.error(
      "Erro ao executar migration:"
    );

    console.error(
      erro.message
    );

    process.exitCode = 1;
  })
  .finally(
    encerrarConexao
  );