const db = require("../db/db");

async function listarNegociosPublicos() {
  const result = await db.query(`
    SELECT
      id,
      nome,
      slug,
      foto_url,
      descricao,
      setor,
      cidade,
      bairro,
      whatsapp_negocio,
      localizacao_url,
      areas,
      latitude,
      longitude
    FROM negocios
    ORDER BY nome ASC
  `);

  return result.rows;
}

async function buscarNegocioPorSlug(slug) {
  const result = await db.query(
    `
    SELECT
      n.id,
      n.nome,
      n.slug,

      (
        SELECT un.usuario_id
        FROM usuarios_negocios un
        WHERE un.negocio_id = n.id
          AND un.papel = 'dono'
        LIMIT 1
      ) AS dono_usuario_id,

      n.foto_url,
      n.foto_public_id,
      n.descricao,
      n.setor,
      n.cidade,
      n.bairro,
      n.localizacao_url,
      n.whatsapp_negocio,
      n.areas,
      n.latitude,
      n.longitude,
      COALESCE(AVG(a.avaliacao), 0)::numeric(2,1) AS media_avaliacoes,
      COUNT(a.avaliacao)::int AS total_avaliacoes
    FROM negocios n
    LEFT JOIN agendamentos a
      ON a.negocio_id = n.id
      AND a.avaliacao IS NOT NULL
    WHERE n.slug = $1
    GROUP BY n.id
    LIMIT 1
    `,
    [slug]
  );

  return result.rows[0] || null;
}

async function incrementarVisita(id) {
  await db.query(
    `
    UPDATE negocios
    SET visitas = COALESCE(visitas, 0) + 1
    WHERE id = $1
    `,
    [id]
  );
}

async function buscarServicos(negocioId) {
  const result = await db.query(
    `
    SELECT
      id,
      nome,
      valor,
      duracao_minutos,
      foto_url
    FROM servicos_negocio
    WHERE negocio_id = $1
    ORDER BY nome
    `,
    [negocioId]
  );

  return result.rows;
}

async function buscarProfissionais(negocioId) {
  const result = await db.query(
    `
    SELECT
      u.id,
      u.nome,
      u.whatsapp
    FROM usuarios u
    INNER JOIN usuarios_negocios un
      ON un.usuario_id = u.id
    WHERE un.negocio_id = $1
    ORDER BY u.nome
    `,
    [negocioId]
  );

  return result.rows;
}

module.exports = {
  listarNegociosPublicos,
  buscarNegocioPorSlug,
  incrementarVisita,
  buscarServicos,
  buscarProfissionais,
};