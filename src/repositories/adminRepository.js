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

async function listarAgendamentosRecentes() {
  const result = await db.query(`
    SELECT
      a.id,
      a.data,
      a.horario,
      a.status,
      c.nome AS cliente_nome,
      n.nome AS negocio,
      s.nome AS servico,
      p.nome AS profissional
    FROM agendamentos a
    LEFT JOIN usuarios c ON c.id = a.cliente_id
    LEFT JOIN usuarios p ON p.id = a.profissional_id
    LEFT JOIN servicos_negocio s ON s.id = a.servico_id
    LEFT JOIN negocios n ON n.id = COALESCE(a.negocio_id, s.negocio_id)
    ORDER BY a.id DESC
    LIMIT 20
  `);

  return result.rows;
}

module.exports = {
  listarNegocios,
  listarAgendamentosRecentes,
};