const fs = require("fs");
const path = require("path");

const PADRAO_MIGRATION =
  /^(\d{3})_[a-z0-9_]+\.sql$/;

function obterVersaoEsperada(
  pasta = path.resolve(
    __dirname,
    "../../database/migrations"
  )
) {
  const versoes = fs
    .readdirSync(pasta)
    .map((arquivo) =>
      arquivo.match(PADRAO_MIGRATION)
    )
    .filter(Boolean)
    .map((resultado) =>
      Number(resultado[1])
    );

  if (!versoes.length) {
    throw new Error(
      "Nenhuma migration válida foi encontrada."
    );
  }

  return Math.max(...versoes);
}

async function verificarBanco(
  db,
  versaoEsperada = obterVersaoEsperada()
) {
  const resultado = await db.query(`
    SELECT
      COALESCE(
        MAX(versao),
        0
      )::int AS migration_atual
    FROM schema_migrations
  `);

  const migrationAtual = Number(
    resultado.rows[0]
      ?.migration_atual || 0
  );

  return {
    pronto:
      migrationAtual >=
      versaoEsperada,
    migrationAtual,
    versaoEsperada,
  };
}

module.exports = {
  obterVersaoEsperada,
  verificarBanco,
};
