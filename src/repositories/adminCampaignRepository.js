const db = require(
  "../db/db"
);

async function listar() {
  const resultado =
    await db.query(
      `
      SELECT
        id,
        nome,
        canal,
        utm_source,
        utm_medium,
        utm_campaign,
        utm_content,
        utm_term,
        destino_path,
        ativo,
        criado_por_usuario_id,
        created_at,
        updated_at
      FROM marketing_campanhas
      ORDER BY
        ativo DESC,
        created_at DESC,
        id DESC
      `
    );

  return resultado.rows;
}

async function buscarPorId(id) {
  const resultado =
    await db.query(
      `
      SELECT
        id,
        nome,
        canal,
        utm_source,
        utm_medium,
        utm_campaign,
        utm_content,
        utm_term,
        destino_path,
        ativo,
        criado_por_usuario_id,
        created_at,
        updated_at
      FROM marketing_campanhas
      WHERE id = $1
      LIMIT 1
      `,
      [id]
    );

  return resultado.rows[0] || null;
}

async function buscarPorIdentidade({
  utmSource,
  utmMedium,
  utmCampaign,
}) {
  const resultado =
    await db.query(
      `
      SELECT id
      FROM marketing_campanhas
      WHERE utm_source = $1
        AND utm_medium = $2
        AND utm_campaign = $3
      LIMIT 1
      `,
      [
        utmSource,
        utmMedium,
        utmCampaign,
      ]
    );

  return resultado.rows[0] || null;
}

async function criar(campanha) {
  const resultado =
    await db.query(
      `
      INSERT INTO marketing_campanhas (
        nome,
        canal,
        utm_source,
        utm_medium,
        utm_campaign,
        utm_content,
        utm_term,
        destino_path,
        ativo,
        criado_por_usuario_id
      )
      VALUES (
        $1,
        $2,
        $3,
        $4,
        $5,
        $6,
        $7,
        $8,
        $9,
        $10
      )
      RETURNING
        id,
        nome,
        canal,
        utm_source,
        utm_medium,
        utm_campaign,
        utm_content,
        utm_term,
        destino_path,
        ativo,
        criado_por_usuario_id,
        created_at,
        updated_at
      `,
      [
        campanha.nome,
        campanha.canal,
        campanha.utmSource,
        campanha.utmMedium,
        campanha.utmCampaign,
        campanha.utmContent,
        campanha.utmTerm,
        campanha.destinoPath,
        campanha.ativo,
        campanha.criadoPorUsuarioId,
      ]
    );

  return resultado.rows[0];
}

async function atualizar(id, campanha) {
  const resultado =
    await db.query(
      `
      UPDATE marketing_campanhas
      SET
        nome = $2,
        utm_content = $3,
        utm_term = $4,
        destino_path = $5,
        ativo = $6,
        updated_at = NOW()
      WHERE id = $1
      RETURNING
        id,
        nome,
        canal,
        utm_source,
        utm_medium,
        utm_campaign,
        utm_content,
        utm_term,
        destino_path,
        ativo,
        criado_por_usuario_id,
        created_at,
        updated_at
      `,
      [
        id,
        campanha.nome,
        campanha.utmContent,
        campanha.utmTerm,
        campanha.destinoPath,
        campanha.ativo,
      ]
    );

  return resultado.rows[0] || null;
}

module.exports = {
  listar,
  buscarPorId,
  buscarPorIdentidade,
  criar,
  atualizar,
};
