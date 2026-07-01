const db = require("../db/db");

async function listarFavoritos(clienteId) {
  const result = await db.query(
    `
    SELECT
      n.id,
      n.nome,
      n.slug,
      n.foto_url,
      n.cidade,
      n.setor,
      n.descricao
    FROM favoritos f
    INNER JOIN negocios n
      ON n.id = f.negocio_id
    WHERE f.cliente_id = $1
    ORDER BY f.created_at DESC
    `,
    [clienteId]
  );

  return result.rows;
}

async function buscarNegocio(negocioId) {
  const result = await db.query(
    `
    SELECT id
    FROM negocios
    WHERE id = $1
    LIMIT 1
    `,
    [negocioId]
  );

  return result.rows[0] || null;
}

async function adicionarFavorito(clienteId, negocioId) {
  await db.query(
    `
    INSERT INTO favoritos (
      cliente_id,
      negocio_id
    )
    VALUES ($1, $2)
    ON CONFLICT (cliente_id, negocio_id)
    DO NOTHING
    `,
    [clienteId, negocioId]
  );
}

async function removerFavorito(clienteId, negocioId) {
  await db.query(
    `
    DELETE FROM favoritos
    WHERE cliente_id = $1
      AND negocio_id = $2
    `,
    [clienteId, negocioId]
  );
}

async function verificarFavorito(clienteId, negocioId) {
  const result = await db.query(
    `
    SELECT id
    FROM favoritos
    WHERE cliente_id = $1
      AND negocio_id = $2
    LIMIT 1
    `,
    [clienteId, negocioId]
  );

  return !!result.rows[0];
}

module.exports = {
  listarFavoritos,
  buscarNegocio,
  adicionarFavorito,
  removerFavorito,
  verificarFavorito
};