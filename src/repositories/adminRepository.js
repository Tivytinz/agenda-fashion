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

async function buscarIndicadoresGerais(periodo = "all") {
  const filtro = filtroPeriodo()[periodo] || "";

  const [negocios, clientes, profissionais, agendamentos] =
    await Promise.all([
      db.query(`SELECT COUNT(*)::int AS total FROM negocios WHERE 1=1 ${filtro}`),
      db.query(`SELECT COUNT(*)::int AS total FROM usuarios WHERE tipo = 'cliente' ${filtro}`),
      db.query(`SELECT COUNT(*)::int AS total FROM usuarios WHERE tipo IN ('profissional', 'dono') ${filtro}`),
      db.query(`SELECT COUNT(*)::int AS total FROM agendamentos WHERE 1=1 ${filtro}`)
    ]);

  return {
    totalNegocios: negocios.rows[0].total,
    totalClientes: clientes.rows[0].total,
    totalProfissionais: profissionais.rows[0].total,
    totalAgendamentos: agendamentos.rows[0].total
  };
}

async function buscarIndicadoresHoje() {
  const [usuariosHoje, negociosHoje, agendamentosHoje] =
    await Promise.all([
      db.query(`
        SELECT COUNT(*)::int AS total
        FROM usuarios
        WHERE created_at >= CURRENT_DATE
      `),

      db.query(`
        SELECT COUNT(*)::int AS total
        FROM negocios
        WHERE created_at >= CURRENT_DATE
      `),

      db.query(`
        SELECT COUNT(*)::int AS total
        FROM agendamentos
        WHERE created_at >= CURRENT_DATE
      `)
    ]);

  return {
    usuariosHoje: usuariosHoje.rows[0].total,
    negociosHoje: negociosHoje.rows[0].total,
    agendamentosHoje: agendamentosHoje.rows[0].total,
  };
}

async function buscarIndicadoresMarketing(periodo = "all") {
  const filtro = filtroPeriodo()[periodo] || "";

  const [visitas, favoritos, cidadeTop, setorTop] =
    await Promise.all([
      db.query(`
        SELECT COALESCE(SUM(visitas), 0)::int AS total
        FROM negocios
      `).catch(() => ({ rows: [{ total: 0 }] })),

      db.query(`
        SELECT COUNT(*)::int AS total
        FROM favoritos
        WHERE 1=1
        ${filtro}
      `).catch(() => ({ rows: [{ total: 0 }] })),

      db.query(`
        SELECT cidade, COUNT(*)::int AS total
        FROM negocios
        WHERE cidade IS NOT NULL
          AND cidade <> ''
        GROUP BY cidade
        ORDER BY total DESC
        LIMIT 1
      `).catch(() => ({ rows: [] })),

      db.query(`
        SELECT setor, COUNT(*)::int AS total
        FROM negocios
        WHERE setor IS NOT NULL
          AND setor <> ''
        GROUP BY setor
        ORDER BY total DESC
        LIMIT 1
      `).catch(() => ({ rows: [] }))
    ]);

  return {
    visitasPlataforma: visitas.rows[0].total,
    favoritosTotais: favoritos.rows[0].total,
    cidadeTop: cidadeTop.rows[0]?.cidade || "-",
    setorTop: setorTop.rows[0]?.setor || "-",
  };
}

async function buscarIndicadoresQualidade() {
  const [
    negociosSemServico,
    negociosSemMaps,
    negociosSemWhatsapp,
    negociosCompletos,
  ] = await Promise.all([
    db.query(`
      SELECT COUNT(*)::int AS total
      FROM negocios n
      WHERE NOT EXISTS (
        SELECT 1
        FROM servicos_negocio s
        WHERE s.negocio_id = n.id
      )
    `),

    db.query(`
      SELECT COUNT(*)::int AS total
      FROM negocios
      WHERE localizacao_url IS NULL
         OR localizacao_url = ''
    `),

    db.query(`
      SELECT COUNT(*)::int AS total
      FROM negocios
      WHERE whatsapp_negocio IS NULL
         OR whatsapp_negocio = ''
    `),

    db.query(`
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
    `),
  ]);

  return {
    negociosSemServico: negociosSemServico.rows[0].total,
    negociosSemMaps: negociosSemMaps.rows[0].total,
    negociosSemWhatsapp: negociosSemWhatsapp.rows[0].total,
    negociosCompletos: negociosCompletos.rows[0].total,
  };
}

module.exports = {
  listarNegocios,
  listarAgendamentosRecentes,
  listarNegociosMaisAgendados,
  listarNegociosMaisVistos,
  listarCidadesTop,
  listarUsuariosRecentes,
  buscarIndicadoresGerais,
  buscarIndicadoresHoje,
  buscarIndicadoresMarketing,
  buscarIndicadoresQualidade,
};