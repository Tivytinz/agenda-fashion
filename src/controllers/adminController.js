const db = require("../db/db");

const adminService = require("../services/adminService");

function filtroPeriodo(alias = "") {
  const prefixo = alias ? `${alias}.` : "";

  return {
    today: `AND ${prefixo}created_at >= CURRENT_DATE`,
    "7": `AND ${prefixo}created_at >= NOW() - INTERVAL '7 days'`,
    "30": `AND ${prefixo}created_at >= NOW() - INTERVAL '30 days'`,
    month: `AND date_trunc('month', ${prefixo}created_at) = date_trunc('month', NOW())`,
    all: ""
  };
}

async function buscarDashboardAdmin(req, res) {
  try {
    const periodo = req.query.periodo || "all";
    const filtros = filtroPeriodo();
    const filtro = filtros[periodo] || "";

    const negocios = await db.query(`
      SELECT COUNT(*)::int AS total
      FROM negocios
      WHERE 1=1
      ${filtro}
    `);

    const clientes = await db.query(`
      SELECT COUNT(*)::int AS total
      FROM usuarios
      WHERE tipo = 'cliente'
      ${filtro}
    `);

    const profissionais = await db.query(`
      SELECT COUNT(*)::int AS total
      FROM usuarios
      WHERE tipo IN ('profissional', 'dono')
      ${filtro}
    `);

    const agendamentos = await db.query(`
      SELECT COUNT(*)::int AS total
      FROM agendamentos
      WHERE 1=1
      ${filtro}
    `);

    const visitas = await db.query(`
      SELECT COALESCE(SUM(visitas), 0)::int AS total
      FROM negocios
    `).catch(() => ({ rows: [{ total: 0 }] }));

    const usuariosHoje = await db.query(`
      SELECT COUNT(*)::int AS total
      FROM usuarios
      WHERE created_at >= CURRENT_DATE
    `).catch(() => ({ rows: [{ total: 0 }] }));

    const negociosHoje = await db.query(`
      SELECT COUNT(*)::int AS total
      FROM negocios
      WHERE created_at >= CURRENT_DATE
    `).catch(() => ({ rows: [{ total: 0 }] }));

    const agendamentosHoje = await db.query(`
      SELECT COUNT(*)::int AS total
      FROM agendamentos
      WHERE created_at >= CURRENT_DATE
    `).catch(() => ({ rows: [{ total: 0 }] }));

    const favoritos = await db.query(`
      SELECT COUNT(*)::int AS total
      FROM favoritos
      WHERE 1=1
      ${filtro}
    `).catch(() => ({ rows: [{ total: 0 }] }));

    const cidadeTop = await db.query(`
      SELECT cidade, COUNT(*)::int AS total
      FROM negocios
      WHERE cidade IS NOT NULL
        AND cidade <> ''
      GROUP BY cidade
      ORDER BY total DESC
      LIMIT 1
    `).catch(() => ({ rows: [] }));

    const setorTop = await db.query(`
      SELECT setor, COUNT(*)::int AS total
      FROM negocios
      WHERE setor IS NOT NULL
        AND setor <> ''
      GROUP BY setor
      ORDER BY total DESC
      LIMIT 1
    `).catch(() => ({ rows: [] }));

    const negociosSemServico = await db.query(`
      SELECT COUNT(*)::int AS total
      FROM negocios n
      WHERE NOT EXISTS (
        SELECT 1
        FROM servicos_negocio s
        WHERE s.negocio_id = n.id
      )
    `);

    const negociosSemMaps = await db.query(`
      SELECT COUNT(*)::int AS total
      FROM negocios
      WHERE localizacao_url IS NULL
         OR localizacao_url = ''
    `);

    const negociosSemWhatsapp = await db.query(`
      SELECT COUNT(*)::int AS total
      FROM negocios
      WHERE whatsapp_negocio IS NULL
         OR whatsapp_negocio = ''
    `);

    const negociosCompletos = await db.query(`
      SELECT COUNT(*)::int AS total
      FROM negocios n
      WHERE n.whatsapp_negocio IS NOT NULL
        AND n.whatsapp_negocio <> ''
        AND n.localizacao_url IS NOT NULL
        AND n.localizacao_url <> ''
        AND EXISTS (
          SELECT 1
          FROM servicos_negocio s
          WHERE s.negocio_id = n.id
        )
    `);

    const totalNegocios = Number(negocios.rows[0].total || 0);
    const totalAgendamentos = Number(agendamentos.rows[0].total || 0);

    const taxaConversao =
      totalNegocios > 0
        ? Math.round((totalAgendamentos / totalNegocios) * 100)
        : 0;

    return res.json({
      periodo,

      totalNegocios,
      totalClientes: clientes.rows[0].total,
      totalProfissionais: profissionais.rows[0].total,
      totalAgendamentos,

      usuariosHoje: usuariosHoje.rows[0].total,
      negociosHoje: negociosHoje.rows[0].total,
      agendamentosHoje: agendamentosHoje.rows[0].total,
      taxaConversaoGeral: taxaConversao,

      visitasPlataforma: visitas.rows[0].total,
      cliquesWhatsapp: 0,
      cliquesMaps: 0,
      favoritosTotais: favoritos.rows[0].total,

      cidadeTop: cidadeTop.rows[0]?.cidade || "-",
      setorTop: setorTop.rows[0]?.setor || "-",

      negociosSemServico: negociosSemServico.rows[0].total,
      negociosSemMaps: negociosSemMaps.rows[0].total,
      negociosSemWhatsapp: negociosSemWhatsapp.rows[0].total,
      negociosCompletos: negociosCompletos.rows[0].total
    });

  } catch (err) {
    console.error("Erro dashboard admin:", err);

    return res.status(500).json({
      erro: "Erro ao carregar dashboard admin."
    });
  }
}

async function listarNegociosAdmin(req, res, next) {
  try {
    const resultado = await adminService.listarNegociosAdmin();

    return res.json(resultado);
  } catch (err) {
    next(err);
  }
}

async function listarAgendamentosAdmin(req, res, next) {
  try {
    const resultado = await adminService.listarAgendamentosAdmin();

    return res.json(resultado);
  } catch (err) {
    next(err);
  }
}

async function buscarMarketingAdmin(req, res, next) {
  try {
    const resultado = await adminService.buscarMarketingAdmin();

    return res.json(resultado);
  } catch (err) {
    next(err);
  }
}

module.exports = {
  buscarDashboardAdmin,
  listarNegociosAdmin,
  listarAgendamentosAdmin,
  buscarMarketingAdmin
};