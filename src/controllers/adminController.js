const db = require("../db");

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
      WHERE tipo = 'profissional'
      ${filtro}
    `);

    const agendamentos = await db.query(`
      SELECT COUNT(*)::int AS total
      FROM agendamentos
      WHERE 1=1
      ${filtro}
    `);

    const visitas = await db.query(`
    SELECT COALESCE(SUM(visitas),0)::int AS total
    FROM negocios
    `);

    const usuariosHoje = await db.query(`
      SELECT COUNT(*)::int AS total
      FROM usuarios
      WHERE created_at >= CURRENT_DATE
    `);

    const negociosHoje = await db.query(`
      SELECT COUNT(*)::int AS total
      FROM negocios
      WHERE created_at >= CURRENT_DATE
    `);

    const agendamentosHoje = await db.query(`
      SELECT COUNT(*)::int AS total
      FROM agendamentos
      WHERE created_at >= CURRENT_DATE
    `);

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

    const taxaConversao =
      Number(negocios.rows[0].total) > 0
        ? Math.round(
            (Number(agendamentos.rows[0].total) /
              Number(negocios.rows[0].total)) *
              100
          )
        : 0;

    return res.json({
      periodo,

      totalNegocios: negocios.rows[0].total,
      totalClientes: clientes.rows[0].total,
      totalProfissionais: profissionais.rows[0].total,
      totalAgendamentos: agendamentos.rows[0].total,

      visitasPlataforma: visitas.rows[0].total,

      usuariosHoje: usuariosHoje.rows[0].total,
      negociosHoje: negociosHoje.rows[0].total,
      agendamentosHoje: agendamentosHoje.rows[0].total,
      taxaConversaoGeral: taxaConversao,

      visitasPlataforma: 0,
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

async function listarNegociosAdmin(req, res) {
  try {
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

async function buscarMarketingAdmin(req, res) {
  try {

    const negociosMaisVistos = await db.query(`
      SELECT
        nome,
        cidade,
        COALESCE(visitas, 0) AS visitas
      FROM negocios
      ORDER BY visitas DESC
      LIMIT 10
    `);

    const cidades = await db.query(`
      SELECT
        cidade,
        COUNT(*)::int AS total
      FROM negocios
      WHERE cidade IS NOT NULL
      GROUP BY cidade
      ORDER BY total DESC
      LIMIT 10
    `);

    return res.json({
      negociosMaisAgendados: [],
      negociosMaisVistos: negociosMaisVistos.rows,
      cidades: cidades.rows,
      usuariosRecentes: []
    });

  } catch (err) {
    console.error("Erro marketing admin:", err);

    return res.status(500).json({
      erro: "Erro ao carregar marketing."
    });
  }
}

module.exports = {
  buscarDashboardAdmin,
  listarNegociosAdmin,
  listarAgendamentosAdmin,
  buscarMarketingAdmin
};