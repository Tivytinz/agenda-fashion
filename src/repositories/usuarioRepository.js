const db = require("../db/db");

async function buscarPorId(id) {
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

async function buscarPorEmail(email) {
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

module.exports = {
  buscarPorId,
  buscarPorEmail
};