require("../tests/setup-env");

const db = require("../src/db/db");

const tabelasPrincipais = [
  "usuarios",
  "negocios",
  "usuarios_negocios",
  "servicos_negocio",
  "planos"
];

async function executar() {
  try {
    const resultado = await db.query(
      `
      SELECT
        table_name,
        column_name,
        data_type,
        is_nullable,
        column_default
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND (
          table_name = ANY($1::text[])
          OR table_name LIKE '%agenda%'
          OR table_name LIKE '%horario%'
        )
      ORDER BY table_name, ordinal_position
      `,
      [tabelasPrincipais]
    );

    console.table(resultado.rows);
  } finally {
    await db.end();
  }
}

executar().catch((erro) => {
  console.error("ERRO:", erro.message);
  process.exit(1);
});