const db = require("../db");

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

async function buscarDashboardProfissional(req, res) {
  try {
    const usuarioId = req.user?.id;

    if (!usuarioId) {
      return res.status(401).json({ erro: "Usuário não autenticado." });
    }

    const negocio = await buscarNegocioDoUsuario(usuarioId);

    if (!negocio) {
      return res.status(404).json({ erro: "Usuário não está vinculado a nenhum negócio." });
    }

    const result = await db.query(
      `
      SELECT
        COUNT(*) FILTER (
          WHERE a.status != 'cancelado'
        ) AS total_agendados,

        COUNT(*) FILTER (
          WHERE a.status != 'cancelado'
          AND a.data = CURRENT_DATE
        ) AS agendados_hoje,

        COUNT(DISTINCT a.cliente_id) AS clientes_unicos,

        COALESCE(SUM(s.valor) FILTER (
          WHERE a.status != 'cancelado'
        ), 0) AS faturamento_estimado

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
        COUNT(a.id) AS total
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
  return res.json({
    resumo: {
      agendamentos_hoje: 0,
      agendamentos_periodo: 0,
      faturamento_hoje: 0,
      faturamento_periodo: 0,
      clientes_novos: 0,
      clientes_recorrentes: 0,
      servicos_vendidos: 0,
      ticket_medio: 0
    },
    performance: {
      visitas_perfil: 0,
      cliques_whatsapp: 0,
      cliques_maps: 0,
      favoritos_recebidos: 0,
      taxa_conversao: 0
    },
    resumo_dias: [],
    ranking_profissionais: [],
    ranking_servicos: [],
    ranking_clientes: []
  });
}

module.exports = {
  buscarDashboardProfissional,
  buscarDashboardDono
};