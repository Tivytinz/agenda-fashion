const db = require("../db/db");

async function buscarNegocioDoUsuario(usuarioId) {
  const result = await db.query(
    `
    SELECT
      un.negocio_id,
      un.papel
    FROM usuarios_negocios un
    WHERE un.usuario_id = $1
    LIMIT 1
    `,
    [usuarioId]
  );

  return result.rows[0] || null;
}

async function buscarNegocioPorId(negocioId) {
  const result = await db.query(
    `
    SELECT
      id,
      id AS negocio_id,
      nome,
      nome AS nome_negocio,
      slug,
      foto_url,
      foto_public_id,
      descricao,
      setor,
      cidade,
      bairro,
      localizacao_url,
      whatsapp_negocio,
      areas
    FROM negocios
    WHERE id = $1
    LIMIT 1
    `,
    [negocioId]
  );

  return result.rows[0] || null;
}

async function atualizarNegocio(negocioId, dados) {
  const result = await db.query(
    `
    UPDATE negocios
    SET
      nome = $1,
      foto_url = $2,
      descricao = $3,
      setor = $4,
      cidade = $5,
      bairro = $6,
      localizacao_url = $7,
      whatsapp_negocio = $8,
      areas = $9
    WHERE id = $10
    RETURNING
      id,
      nome,
      slug,
      foto_url,
      foto_public_id,
      descricao,
      setor,
      cidade,
      bairro,
      localizacao_url,
      whatsapp_negocio,
      areas
    `,
    [
      dados.nome,
      dados.foto_url,
      dados.descricao,
      dados.setor,
      dados.cidade,
      dados.bairro,
      dados.localizacao_url,
      dados.whatsapp_negocio,
      dados.areas,
      negocioId
    ]
  );

  return result.rows[0];
}

module.exports = {
  buscarNegocioDoUsuario,
  buscarNegocioPorId,
  atualizarNegocio
};