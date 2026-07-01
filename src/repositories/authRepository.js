const db = require("../db/db");

async function buscarUsuarioPorEmail(email) {
  const result = await db.query(
    `
    SELECT *
    FROM usuarios
    WHERE email = $1
    LIMIT 1
    `,
    [email]
  );

  return result.rows[0] || null;
}

async function buscarUsuarioPorId(id) {
  const result = await db.query(
    `
    SELECT
      id,
      nome,
      email,
      whatsapp,
      tipo
    FROM usuarios
    WHERE id = $1
    LIMIT 1
    `,
    [id]
  );

  return result.rows[0] || null;
}

async function emailExiste(email) {
  const result = await db.query(
    `
    SELECT id
    FROM usuarios
    WHERE email = $1
    LIMIT 1
    `,
    [email]
  );

  return result.rows.length > 0;
}

async function criarUsuario({ nome, email, senhaHash, whatsapp, tipo }) {
  const result = await db.query(
    `
    INSERT INTO usuarios (
      nome,
      email,
      senha,
      whatsapp,
      tipo
    )
    VALUES ($1, $2, $3, $4, $5)
    RETURNING
      id,
      nome,
      email,
      whatsapp,
      tipo
    `,
    [
      nome,
      email,
      senhaHash,
      whatsapp,
      tipo
    ]
  );

  return result.rows[0];
}

async function buscarNegocioDoUsuario(usuarioId) {
  const result = await db.query(
    `
    SELECT
      n.id,
      n.nome,
      n.slug,
      n.dono_usuario_id,
      un.papel,
      un.negocio_id
    FROM usuarios_negocios un
    INNER JOIN negocios n
      ON n.id = un.negocio_id
    WHERE un.usuario_id = $1
    LIMIT 1
    `,
    [usuarioId]
  );

  return result.rows[0] || null;
}

module.exports = {
  buscarUsuarioPorEmail,
  buscarUsuarioPorId,
  emailExiste,
  criarUsuario,
  buscarNegocioDoUsuario
};