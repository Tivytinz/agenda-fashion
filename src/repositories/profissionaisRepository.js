const db = require("../db/db");

async function buscarNegocioDono(usuarioId) {
  const result = await db.query(
    `
    SELECT negocio_id
    FROM usuarios_negocios
    WHERE usuario_id = $1
      AND papel = 'dono'
    LIMIT 1
    `,
    [usuarioId]
  );

  return result.rows[0] || null;
}

async function verificarProfissionalNoNegocio(usuarioId, negocioId) {
  const result = await db.query(
    `
    SELECT id
    FROM usuarios_negocios
    WHERE usuario_id = $1
      AND negocio_id = $2
    LIMIT 1
    `,
    [usuarioId, negocioId]
  );

  return result.rows[0] || null;
}

async function atualizarProfissional(id, nome, whatsapp) {
  const result = await db.query(
    `
    UPDATE usuarios
    SET
      nome = $1,
      whatsapp = $2
    WHERE id = $3
    RETURNING
      id,
      nome,
      email,
      whatsapp,
      tipo,
      foto_url
    `,
    [
      nome,
      whatsapp,
      id
    ]
  );

  return result.rows[0];
}

async function removerVinculo(usuarioId, negocioId) {
  const result = await db.query(
    `
    DELETE FROM usuarios_negocios
    WHERE usuario_id = $1
      AND negocio_id = $2
    RETURNING id
    `,
    [usuarioId, negocioId]
  );

  return result.rows[0] || null;
}

async function buscarProfissionalPorEmailWhatsapp(email, whatsapp) {
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
    WHERE tipo = 'profissional'
      AND (
        LOWER(email) = $1
        OR REGEXP_REPLACE(
             COALESCE(whatsapp,''),
             '\\D',
             '',
             'g'
           ) = $2
      )
    LIMIT 1
    `,
    [email, whatsapp]
  );

  return result.rows[0] || null;
}

async function verificarVinculo(usuarioId, negocioId) {
  const result = await db.query(
    `
    SELECT id
    FROM usuarios_negocios
    WHERE usuario_id = $1
      AND negocio_id = $2
    LIMIT 1
    `,
    [usuarioId, negocioId]
  );

  return result.rows[0] || null;
}

async function criarVinculo(usuarioId, negocioId) {
  await db.query(
    `
    INSERT INTO usuarios_negocios(
      usuario_id,
      negocio_id,
      papel
    )
    VALUES($1,$2,'profissional')
    `,
    [usuarioId, negocioId]
  );
}

module.exports = {
  buscarNegocioDono,
  verificarProfissionalNoNegocio,
  atualizarProfissional,
  removerVinculo,
  buscarProfissionalPorEmailWhatsapp,
  verificarVinculo,
  criarVinculo
};