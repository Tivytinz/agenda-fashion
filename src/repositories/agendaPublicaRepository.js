const db = require("../db/db");

async function buscarNegocioPorSlug(slug) {
  const result = await db.query(
    `
    SELECT id, nome, slug
    FROM negocios
    WHERE slug = $1
    LIMIT 1
    `,
    [slug]
  );

  return result.rows[0] || null;
}

async function buscarServicoDoNegocio(servicoId, negocioId) {
  const result = await db.query(
    `
    SELECT id, nome, valor, duracao_minutos
    FROM servicos_negocio
    WHERE id = $1
      AND negocio_id = $2
    LIMIT 1
    `,
    [servicoId, negocioId]
  );

  return result.rows[0] || null;
}

async function buscarProfissionalDoNegocio(profissionalId, negocioId) {
  const result = await db.query(
    `
    SELECT
      u.id,
      u.nome,
      un.papel
    FROM usuarios_negocios un
    INNER JOIN usuarios u
      ON u.id = un.usuario_id
    WHERE un.usuario_id = $1
      AND un.negocio_id = $2
    LIMIT 1
    `,
    [profissionalId, negocioId]
  );

  return result.rows[0] || null;
}

module.exports = {
  buscarNegocioPorSlug,
  buscarServicoDoNegocio,
  buscarProfissionalDoNegocio,
};