const db = require("../db");

async function buscarDashboardAdmin(req, res) {
  try {
    const negocios = await db.query(`
      SELECT COUNT(*)::int AS total
      FROM negocios
    `);

    const clientes = await db.query(`
      SELECT COUNT(*)::int AS total
      FROM usuarios
      WHERE tipo = 'cliente'
    `);

    const profissionais = await db.query(`
      SELECT COUNT(*)::int AS total
      FROM usuarios
      WHERE tipo = 'profissional'
    `);

    const agendamentos = await db.query(`
      SELECT COUNT(*)::int AS total
      FROM agendamentos
    `);

    return res.json({
      totalNegocios: negocios.rows[0].total,
      totalClientes: clientes.rows[0].total,
      totalProfissionais: profissionais.rows[0].total,
      totalAgendamentos: agendamentos.rows[0].total
    });

  } catch (err) {
    console.error("Erro dashboard admin:", err);

    return res.status(500).json({
      erro: "Erro ao carregar dashboard admin."
    });
  }
}

async function listarNegociosAdmin(req, res) {
  try {
    const result = await db.query(`
      SELECT
        n.id,
        n.nome,
        n.slug,
        c.cidade,
        c.whatsapp_negocio,
        COALESCE(n.ativo, true) AS ativo
      FROM negocios n
      LEFT JOIN configuracoes_negocio c
        ON c.negocio_id = n.id
      ORDER BY n.id DESC
      LIMIT 50
    `);

    return res.json({
      negocios: result.rows
    });

  } catch (err) {
    console.error("Erro listar negócios admin:", err);

    return res.status(500).json({
      erro: "Erro ao listar negócios."
    });
  }
}

async function listarAgendamentosAdmin(req, res) {
  try {
    const result = await db.query(`
  SELECT *
  FROM agendamentos
  ORDER BY id DESC
  LIMIT 20
`);
    return res.json({
      agendamentos: result.rows
    });

  } catch (err) {
    console.error("Erro listar agendamentos admin:", err);

    return res.status(500).json({
      erro: "Erro ao listar agendamentos."
    });
  }
}

module.exports = {
  buscarDashboardAdmin,
  listarNegociosAdmin,
  listarAgendamentosAdmin
};