const db = require("../db/db");

async function buscarNegocioDoUsuario(usuarioId) {
  const result = await db.query(
    `
    SELECT un.negocio_id, un.papel, n.nome, n.slug
    FROM usuarios_negocios un
    INNER JOIN negocios n ON n.id = un.negocio_id
    WHERE un.usuario_id = $1
    LIMIT 1
    `,
    [usuarioId]
  );

  return result.rows[0] || null;
}

function filtroPeriodo(periodo) {
  if (periodo === "hoje") {
    return "AND a.data = CURRENT_DATE";
  }

  if (periodo === "7dias" || periodo === "7") {
    return "AND a.data >= CURRENT_DATE - INTERVAL '7 days'";
  }

  if (periodo === "30dias" || periodo === "30") {
    return "AND a.data >= CURRENT_DATE - INTERVAL '30 days'";
  }

  if (periodo === "mes" || periodo === "month") {
    return "AND date_trunc('month', a.data) = date_trunc('month', CURRENT_DATE)";
  }

  return "AND a.data >= CURRENT_DATE - INTERVAL '7 days'";
}

async function buscarDashboardProfissional(req, res) {
  try {
    const usuarioId = req.user?.id;

    if (!usuarioId) {
      return res.status(401).json({ erro: "Usuário não autenticado." });
    }

    const negocio = await buscarNegocioDoUsuario(usuarioId);

    if (!negocio) {
      return res.status(404).json({
        erro: "Usuário não está vinculado a nenhum negócio."
      });
    }

    const result = await db.query(
      `
      SELECT
        COUNT(*) FILTER (WHERE a.status != 'cancelado') AS total_agendados,
        COUNT(*) FILTER (
          WHERE a.status != 'cancelado'
          AND a.data = CURRENT_DATE
        ) AS agendados_hoje,
        COUNT(DISTINCT a.cliente_id) AS clientes_unicos,
        COALESCE(SUM(s.valor) FILTER (WHERE a.status != 'cancelado'), 0) AS faturamento_estimado
      FROM agendamentos a
      LEFT JOIN servicos_negocio s ON s.id = a.servico_id
      WHERE s.negocio_id = $1
        AND a.profissional_id = $2
      `,
      [negocio.negocio_id, usuarioId]
    );

    const servicosMaisVendidos = await db.query(
      `
      SELECT
        s.nome,
        COUNT(a.id)::int AS total
      FROM agendamentos a
      LEFT JOIN servicos_negocio s ON s.id = a.servico_id
      WHERE s.negocio_id = $1
        AND a.profissional_id = $2
        AND a.status != 'cancelado'
      GROUP BY s.nome
      ORDER BY total DESC
      LIMIT 5
      `,
      [negocio.negocio_id, usuarioId]
    );

    return res.json({
      negocio,
      resumo: result.rows[0],
      servicosMaisVendidos: servicosMaisVendidos.rows
    });

  } catch (err) {
    console.error("Erro ao buscar dashboard:", err);
    return res.status(500).json({ erro: "Erro ao carregar dashboard." });
  }
}

async function buscarDashboardDono(req, res) {
  try {
    const usuarioId = req.user?.id;
    const periodo = req.query.periodo || "7dias";
    const filtro = filtroPeriodo(periodo);

    if (!usuarioId) {
      return res.status(401).json({
        erro: "Usuário não autenticado."
      });
    }

    const negocio = await buscarNegocioDoUsuario(usuarioId);

    if (!negocio) {
      return res.status(404).json({
        erro: "Usuário não está vinculado a nenhum negócio."
      });
    }

    if (negocio.papel !== "dono") {
      return res.status(403).json({
        erro: "Apenas o dono pode acessar este dashboard."
      });
    }

    const negocioId = negocio.negocio_id;

    const resumoResult = await db.query(
      `
      SELECT
        COUNT(*) FILTER (
          WHERE a.status != 'cancelado'
          AND a.data = CURRENT_DATE
        )::int AS agendamentos_hoje,

        COUNT(*) FILTER (
          WHERE a.status != 'cancelado'
          ${filtro}
        )::int AS agendamentos_periodo,

        COALESCE(SUM(s.valor) FILTER (
          WHERE a.status != 'cancelado'
          AND a.data = CURRENT_DATE
        ), 0)::numeric AS faturamento_hoje,

        COALESCE(SUM(s.valor) FILTER (
          WHERE a.status != 'cancelado'
          ${filtro}
        ), 0)::numeric AS faturamento_periodo,

        COUNT(DISTINCT a.cliente_id) FILTER (
          WHERE a.status != 'cancelado'
          ${filtro}
        )::int AS clientes_novos,

        COUNT(a.id) FILTER (
          WHERE a.status != 'cancelado'
          ${filtro}
        )::int AS servicos_vendidos

      FROM agendamentos a
      LEFT JOIN servicos_negocio s ON s.id = a.servico_id
      WHERE a.negocio_id = $1
      `,
      [negocioId]
    );

    const resumo = resumoResult.rows[0] || {};

    const clientesRecorrentesResult = await db.query(
      `
      SELECT COUNT(*)::int AS total
      FROM (
        SELECT cliente_id
        FROM agendamentos
        WHERE negocio_id = $1
          AND status != 'cancelado'
          AND cliente_id IS NOT NULL
        GROUP BY cliente_id
        HAVING COUNT(*) > 1
      ) recorrentes
      `,
      [negocioId]
    );

    const performanceResult = await db.query(
      `
      SELECT
        COALESCE(visitas, 0)::int AS visitas_perfil,
        COALESCE(cliques_whatsapp, 0)::int AS cliques_whatsapp,
        COALESCE(cliques_maps, 0)::int AS cliques_maps
      FROM negocios
      WHERE id = $1
      LIMIT 1
      `,
      [negocioId]
    ).catch(() => ({
      rows: [{
        visitas_perfil: 0,
        cliques_whatsapp: 0,
        cliques_maps: 0
      }]
    }));

    const favoritosResult = await db.query(
      `
      SELECT COUNT(*)::int AS total
      FROM favoritos
      WHERE negocio_id = $1
      `,
      [negocioId]
    ).catch(() => ({
      rows: [{ total: 0 }]
    }));

    const totalVisitas = Number(performanceResult.rows[0]?.visitas_perfil || 0);
    const totalAgendamentosPeriodo = Number(resumo.agendamentos_periodo || 0);

    const taxaConversao =
      totalVisitas > 0
        ? Math.round((totalAgendamentosPeriodo / totalVisitas) * 100)
        : 0;

    const ticketMedio =
      totalAgendamentosPeriodo > 0
        ? Number(resumo.faturamento_periodo || 0) / totalAgendamentosPeriodo
        : 0;

    const resumoDias = await db.query(
      `
      SELECT
        TO_CHAR(a.data, 'DD/MM') AS data,
        COUNT(a.id)::int AS agendamentos,
        COALESCE(SUM(s.valor), 0)::numeric AS faturamento
      FROM agendamentos a
      LEFT JOIN servicos_negocio s ON s.id = a.servico_id
      WHERE a.negocio_id = $1
        AND a.status != 'cancelado'
        ${filtro}
      GROUP BY a.data
      ORDER BY a.data ASC
      `,
      [negocioId]
    );

    const rankingProfissionais = await db.query(
      `
      SELECT
        u.nome,
        COUNT(a.id)::int AS total,
        COALESCE(SUM(s.valor), 0)::numeric AS faturamento
      FROM agendamentos a
      LEFT JOIN usuarios u ON u.id = a.profissional_id
      LEFT JOIN servicos_negocio s ON s.id = a.servico_id
      WHERE a.negocio_id = $1
        AND a.status != 'cancelado'
        ${filtro}
      GROUP BY u.id, u.nome
      ORDER BY total DESC
      LIMIT 5
      `,
      [negocioId]
    );

    const rankingServicos = await db.query(
      `
      SELECT
        s.nome,
        COUNT(a.id)::int AS total,
        COALESCE(SUM(s.valor), 0)::numeric AS faturamento
      FROM agendamentos a
      LEFT JOIN servicos_negocio s ON s.id = a.servico_id
      WHERE a.negocio_id = $1
        AND a.status != 'cancelado'
        ${filtro}
      GROUP BY s.id, s.nome
      ORDER BY total DESC
      LIMIT 5
      `,
      [negocioId]
    );

    const rankingClientes = await db.query(
      `
      SELECT
        u.nome,
        COUNT(a.id)::int AS total,
        COALESCE(SUM(s.valor), 0)::numeric AS faturamento
      FROM agendamentos a
      LEFT JOIN usuarios u ON u.id = a.cliente_id
      LEFT JOIN servicos_negocio s ON s.id = a.servico_id
      WHERE a.negocio_id = $1
        AND a.status != 'cancelado'
        ${filtro}
      GROUP BY u.id, u.nome
      ORDER BY total DESC
      LIMIT 6
      `,
      [negocioId]
    );

    return res.json({
      periodo,
      negocio,

      resumo: {
        agendamentos_hoje: Number(resumo.agendamentos_hoje || 0),
        agendamentos_periodo: totalAgendamentosPeriodo,
        faturamento_hoje: Number(resumo.faturamento_hoje || 0),
        faturamento_periodo: Number(resumo.faturamento_periodo || 0),
        clientes_novos: Number(resumo.clientes_novos || 0),
        clientes_recorrentes: Number(clientesRecorrentesResult.rows[0]?.total || 0),
        servicos_vendidos: Number(resumo.servicos_vendidos || 0),
        ticket_medio: ticketMedio
      },

      performance: {
        visitas_perfil: totalVisitas,
        cliques_whatsapp: Number(performanceResult.rows[0]?.cliques_whatsapp || 0),
        cliques_maps: Number(performanceResult.rows[0]?.cliques_maps || 0),
        favoritos_recebidos: Number(favoritosResult.rows[0]?.total || 0),
        taxa_conversao: taxaConversao
      },

      resumo_dias: resumoDias.rows,
      ranking_profissionais: rankingProfissionais.rows,
      ranking_servicos: rankingServicos.rows,
      ranking_clientes: rankingClientes.rows
    });

  } catch (err) {
    console.error("Erro dashboard dono:", err);

    return res.status(500).json({
      erro: "Erro ao carregar dashboard do dono."
    });
  }
}

module.exports = {
  buscarDashboardProfissional,
  buscarDashboardDono
};