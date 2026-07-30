const db = require("../db/db");

async function buscarEstadoDaSessao(
  usuarioId
) {
  const resultado =
    await db.query(
      `
      SELECT
        id,
        ativo,
        senha_alterada_em
      FROM usuarios
      WHERE id = $1
      LIMIT 1
      `,
      [usuarioId]
    );

  return resultado.rows[0] || null;
}

module.exports = {
  buscarEstadoDaSessao,
};
