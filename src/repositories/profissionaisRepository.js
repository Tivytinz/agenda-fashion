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
    SELECT un.negocio_id
    FROM usuarios_negocios un
    INNER JOIN usuarios u
      ON u.id = un.usuario_id
    INNER JOIN negocios n
      ON n.id = un.negocio_id
    WHERE un.usuario_id = $1
      AND un.papel = 'dono'
      AND un.ativo = TRUE
      AND u.ativo = TRUE
      AND n.ativo = TRUE
    LIMIT 1
    `,
    [usuarioId]
  );

  return result.rows[0] || null;
}

async function listarProfissionaisDoNegocio(negocioId) {
  const result = await db.query(
    `
    SELECT
      u.id,
      COALESCE(un.nome_exibicao, u.nome) AS nome,
      COALESCE(un.whatsapp_exibicao, u.whatsapp) AS whatsapp,
      u.foto_url,
      un.papel
    FROM usuarios_negocios un
    INNER JOIN usuarios u
      ON u.id = un.usuario_id
    WHERE un.negocio_id = $1
      AND un.ativo = TRUE
      AND u.ativo = TRUE
      AND un.papel IN ('dono', 'profissional')
    ORDER BY
      CASE WHEN un.papel = 'dono' THEN 0 ELSE 1 END,
      COALESCE(un.nome_exibicao, u.nome) ASC
    `,
    [negocioId]
  );

  return result.rows;
}

async function verificarProfissionalNoNegocio(usuarioId, negocioId) {
  const result = await db.query(
    `
    SELECT un.id
    FROM usuarios_negocios un
    INNER JOIN usuarios u
      ON u.id = un.usuario_id
    WHERE un.usuario_id = $1
      AND un.negocio_id = $2
      AND un.ativo = TRUE
      AND u.ativo = TRUE
    LIMIT 1
    `,
    [usuarioId, negocioId]
  );

  return result.rows[0] || null;
}

async function atualizarProfissional(
  id,
  negocioId,
  nome,
  whatsapp
) {
  const result = await db.query(
    `
    UPDATE usuarios_negocios un
    SET
      nome_exibicao = $1,
      whatsapp_exibicao = $2
    FROM usuarios u
    WHERE un.usuario_id = $3
      AND un.negocio_id = $4
      AND un.ativo = TRUE
      AND u.id = un.usuario_id
      AND u.ativo = TRUE
    RETURNING
      u.id,
      COALESCE(un.nome_exibicao, u.nome) AS nome,
      u.email,
      COALESCE(un.whatsapp_exibicao, u.whatsapp) AS whatsapp,
      u.foto_url,
      un.ativo
    `,
    [
      nome,
      whatsapp,
      id,
      negocioId
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
      u.id,
      u.nome,
      u.email,
      u.whatsapp,
      u.foto_url,
      u.ativo
    FROM usuarios u
    WHERE u.ativo = TRUE
      AND (
        (
          $1 <> ''
          AND LOWER(u.email) = $1
        )
        OR REGEXP_REPLACE(
          COALESCE(u.whatsapp, ''),
          '\\D',
          '',
          'g'
        ) = NULLIF($2, '')
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
  listarProfissionaisDoNegocio,
  verificarProfissionalNoNegocio,
  atualizarProfissional,
  removerVinculo,
  buscarProfissionalPorEmailWhatsapp,
  verificarVinculo,
  criarVinculo
};
