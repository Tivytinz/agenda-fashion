const db = require("../db/db");

async function listarNotificacoes(usuarioId) {
  const result = await db.query(
    `
    SELECT *
    FROM notificacoes
    WHERE usuario_id = $1
    ORDER BY created_at DESC
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
    `,
    [id, usuarioId]
  );
}

module.exports = {
  listarNotificacoes,
  marcarComoLida
};