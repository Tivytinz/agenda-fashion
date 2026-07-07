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

async function listarNegociosMaisAgendados() {
  const result = await db.query(`
    SELECT
      n.nome,
      n.cidade,
      COUNT(a.id)::int AS total,
      COALESCE(SUM(s.valor), 0) AS faturamento
    FROM negocios n
    LEFT JOIN agendamentos a ON a.negocio_id = n.id
    LEFT JOIN servicos_negocio s ON s.id = a.servico_id
    WHERE a.status IS NULL OR a.status != 'cancelado'
    GROUP BY n.id, n.nome, n.cidade
    ORDER BY total DESC
    LIMIT 10
  `).catch(() => ({ rows: [] }));

  return result.rows;
}

async function listarNegociosMaisVistos() {
  const result = await db.query(`
    SELECT nome, cidade,
      COALESCE(visitas, 0)::int AS visitas,
      COALESCE(cliques_whatsapp, 0)::int AS cliques_whatsapp
    FROM negocios
    ORDER BY visitas DESC
    LIMIT 10
  `).catch(() => ({ rows: [] }));

  return result.rows;
}

async function listarCidadesTop() {
  const result = await db.query(`
    SELECT cidade, COUNT(*)::int AS total
    FROM negocios
    WHERE cidade IS NOT NULL AND cidade <> ''
    GROUP BY cidade
    ORDER BY total DESC
    LIMIT 10
  `).catch(() => ({ rows: [] }));

  return result.rows;
}

async function listarUsuariosRecentes() {
  const result = await db.query(`
    SELECT nome, email, tipo, created_at
    FROM usuarios
    ORDER BY created_at DESC
    LIMIT 10
  `).catch(() => ({ rows: [] }));

  return result.rows;
}

module.exports = {
  listarNegocios,
  listarAgendamentosRecentes,
  listarNegociosMaisAgendados,
  listarNegociosMaisVistos,
  listarCidadesTop,
};