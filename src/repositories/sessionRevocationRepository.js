const db = require(
  "../db/db"
);

async function revogarToken({
  usuarioId,
  tokenHash,
  expiraEm,
}) {
  const resultado =
    await db.query(
      `
      WITH limpeza AS (
        DELETE FROM sessoes_revogadas
        WHERE expira_em <= NOW()
      )
      INSERT INTO sessoes_revogadas (
        usuario_id,
        token_hash,
        expira_em
      )
      SELECT
        u.id,
        $2,
        $3
      FROM usuarios u
      WHERE u.id = $1
        AND $3 > NOW()
      ON CONFLICT (token_hash)
      DO NOTHING
      RETURNING
        id,
        usuario_id,
        token_hash,
        expira_em,
        revogado_em
      `,
      [
        usuarioId,
        tokenHash,
        expiraEm,
      ]
    );

  return resultado.rows[0] || null;
}

module.exports = {
  revogarToken,
};
