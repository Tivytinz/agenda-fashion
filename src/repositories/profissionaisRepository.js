const db = require("../db/db");

async function bloquearCadastroProfissional(client, negocioId) {
  await client.query(
    `
    SELECT pg_advisory_xact_lock(
      hashtext('agenda_fashion_limite_profissionais'),
      $1::integer
    )
    `,
    [Number(negocioId)]
  );
}

async function buscarPlanoDoNegocio(negocioId, executor = db) {
  const result = await executor.query(
    `
    SELECT
      p.id,
      p.nome,
      p.slug,
      p.limite_profissionais
    FROM negocios n
    INNER JOIN planos p
      ON p.id = n.plano_id
    WHERE n.id = $1
    LIMIT 1
    `,
    [negocioId]
  );

  return result.rows[0] || null;
}

async function contarProfissionaisAtivos(negocioId, executor = db) {
  const result = await executor.query(
    `
    SELECT COUNT(*)::int AS total
    FROM usuarios_negocios
    WHERE negocio_id = $1
      AND ativo = TRUE
      AND papel IN ('dono', 'profissional')
    `,
    [negocioId]
  );

  return Number(result.rows[0]?.total || 0);
}

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

async function verificarVinculo(usuarioId, negocioId, executor = db) {
  const result = await executor.query(
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

async function criarVinculo(usuarioId, negocioId, executor = db) {
  await executor.query(
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
  bloquearCadastroProfissional,
  buscarPlanoDoNegocio,
  contarProfissionaisAtivos,
  buscarNegocioDono,
  verificarProfissionalNoNegocio,
  atualizarProfissional,
  removerVinculo,
  buscarProfissionalPorEmailWhatsapp,
  verificarVinculo,
  criarVinculo
};
