const db = require("../db/db");

async function buscarUsuarioPorId(usuarioId) {
  const result = await db.query(
    `
    SELECT
      id,
      nome,
      email,
      whatsapp,
      tipo,
      foto_url
    FROM usuarios
    WHERE id = $1
    LIMIT 1
    `,
    [usuarioId]
  );

  return result.rows[0] || null;
}

async function buscarSenhaUsuario(usuarioId) {
  const result = await db.query(
    `
    SELECT id, senha
    FROM usuarios
    WHERE id = $1
    LIMIT 1
    `,
    [usuarioId]
  );

  return result.rows[0] || null;
}

async function atualizarUsuario({ usuarioId, nome, whatsapp }) {
  const result = await db.query(
    `
    UPDATE usuarios
    SET
      nome = $1,
      whatsapp = $2
    WHERE id = $3
    RETURNING id, nome, email, whatsapp, tipo, foto_url
    `,
    [nome, whatsapp, usuarioId]
  );

  return result.rows[0] || null;
}

async function atualizarSenha({ usuarioId, senhaHash }) {
  await db.query(
    `
    UPDATE usuarios
    SET senha = $1
    WHERE id = $2
    `,
    [senhaHash, usuarioId]
  );
}

async function atualizarFotoUsuario({ usuarioId, fotoUrl, fotoPublicId }) {
  await db.query(
    `
    UPDATE usuarios
    SET
      foto_url = $1,
      foto_public_id = $2
    WHERE id = $3
    `,
    [fotoUrl, fotoPublicId, usuarioId]
  );
}

module.exports = {
  buscarUsuarioPorId,
  buscarSenhaUsuario,
  atualizarUsuario,
  atualizarSenha,
  atualizarFotoUsuario,
};