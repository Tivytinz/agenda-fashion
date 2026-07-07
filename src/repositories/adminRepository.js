const db = require("../db/db");

async function listarNegocios() {
  const result = await db.query(`
    SELECT
      n.id,
      n.nome,
      n.slug,
      n.cidade,
      n.whatsapp_negocio,
      COALESCE(n.ativo, true) AS ativo
    FROM negocios n
    ORDER BY n.id DESC
    LIMIT 50
  `);

  return result.rows;
}

module.exports = {
  listarNegocios,
};