require("dotenv").config();

const db = require(
  "../src/db/db"
);

async function verificar() {
  try {
    const resultado =
      await db.query(`
        SELECT
          table_name
        FROM information_schema.tables
        WHERE table_schema = 'public'
        ORDER BY table_name
      `);

    console.table(
      resultado.rows
    );
  } catch (erro) {
    console.error(
      "Erro:",
      erro.message
    );
  } finally {
    if (
      typeof db.end ===
      "function"
    ) {
      await db.end();
    }
  }
}

verificar();