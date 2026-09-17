const db = require("../db/db");

async function buscarEstadoDaSessao(
  usuarioId,
  tokenHash = null
) {
  const resultado =
    await db.query(
      `
      SELECT
        u.id,
        u.ativo,
        u.senha_alterada_em,
        CASE
          WHEN $2::text IS NULL
            THEN FALSE
          ELSE EXISTS (
            SELECT 1
            FROM sessoes_revogadas sr
            WHERE sr.token_hash = $2
              AND sr.usuario_id = u.id
              AND sr.expira_em > NOW()
          )
        END AS token_revogado
      FROM usuarios u
      WHERE u.id = $1
      LIMIT 1
      `,
      [
        usuarioId,
        tokenHash,
      ]
    );

  return resultado.rows[0] || null;
}

module.exports = {
  buscarEstadoDaSessao,
};
