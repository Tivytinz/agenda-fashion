const db = require("../db/db");

async function listarNotificacoes(usuarioId) {
  const result = await db.query(
    `
    SELECT notificacoes.*
    FROM notificacoes
    INNER JOIN usuarios u
      ON u.id = notificacoes.usuario_id
    WHERE notificacoes.usuario_id = $1
      AND u.ativo = TRUE
    ORDER BY notificacoes.created_at DESC
    LIMIT 50
    `,
    [usuarioId]
  );

  return result.rows;
}

async function marcarComoLida(id, usuarioId) {
  await db.query(
    `
    UPDATE notificacoes
    SET lida = TRUE
    WHERE id = $1
      AND usuario_id = $2
      AND EXISTS (
        SELECT 1
        FROM usuarios u
        WHERE u.id = $2
          AND u.ativo = TRUE
      )
    `,
    [id, usuarioId]
  );
}

module.exports = {
  listarNotificacoes,
  marcarComoLida
};
