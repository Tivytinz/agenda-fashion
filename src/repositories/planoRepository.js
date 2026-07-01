const db = require("../db/db");

async function buscarPlanoGratis() {
  const result = await db.query(
    `
    SELECT
      id,
      nome,
      slug,
      valor,
      capacidade_agendamentos
    FROM planos
    WHERE slug = 'gratis'
      AND ativo = true
    LIMIT 1
    `
  );

  return result.rows[0] || null;
}

async function buscarPorSlug(slug) {
  const result = await db.query(
    `
    SELECT *
    FROM planos
    WHERE slug = $1
    LIMIT 1
    `,
    [slug]
  );

  return result.rows[0] || null;
}

async function buscarPorId(id) {
  const result = await db.query(
    `
    SELECT *
    FROM planos
    WHERE id = $1
    LIMIT 1
    `,
    [id]
  );

  return result.rows[0] || null;
}

module.exports = {
  buscarPlanoGratis,
  buscarPorSlug,
  buscarPorId
};