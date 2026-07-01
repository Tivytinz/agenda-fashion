const db = require("../db/db");

async function listarNotificacoes(req, res) {
  try {
    const usuarioId = req.user.id;

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

    return res.json({
      notificacoes: result.rows
    });

  } catch (err) {
    console.error(err);

    return res.status(500).json({
      erro: "Erro ao carregar notificações."
    });
  }
}

async function marcarComoLida(req, res) {
  try {
    const usuarioId = req.user.id;
    const { id } = req.params;

    await db.query(
      `
      UPDATE notificacoes
      SET lida = TRUE
      WHERE id = $1
        AND usuario_id = $2
      `,
      [id, usuarioId]
    );

    return res.json({
      sucesso: true
    });

  } catch (err) {
    console.error(err);

    return res.status(500).json({
      erro: "Erro ao atualizar notificação."
    });
  }
}

module.exports = {
  listarNotificacoes,
  marcarComoLida
};