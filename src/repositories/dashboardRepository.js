// repositories/dashboardRepository.js

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

async function buscarResumoProfissional(negocioId, usuarioId) {
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
    [negocioId, usuarioId]
  );

  return result.rows[0];
}

async function buscarServicosMaisVendidosProfissional(negocioId, usuarioId) {
  const result = await db.query(
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
    [negocioId, usuarioId]
  );

  return result.rows;
}

async function buscarResumoDono(negocioId, filtro) {
  const result = await db.query(
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

  return result.rows[0] || {};
}

async function buscarClientesRecorrentes(negocioId) {
  const result = await db.query(
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

  return result.rows[0]?.total || 0;
}

async function buscarPerformanceNegocio(negocioId) {
  try {
    const result = await db.query(
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
    );

    return result.rows[0] || {
      visitas_perfil: 0,
      cliques_whatsapp: 0,
      cliques_maps: 0
    };
  } catch {
    return {
      visitas_perfil: 0,
      cliques_whatsapp: 0,
      cliques_maps: 0
    };
  }
}

async function buscarFavoritosRecebidos(negocioId) {
  try {
    const result = await db.query(
      `
      SELECT COUNT(*)::int AS total
      FROM favoritos
      WHERE negocio_id = $1
      `,
      [negocioId]
    );

    return result.rows[0]?.total || 0;
  } catch {
    return 0;
  }
}

async function buscarResumoDias(negocioId, filtro) {
  const result = await db.query(
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

  return result.rows;
}

async function buscarRankingProfissionais(negocioId, filtro) {
  const result = await db.query(
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

  return result.rows;
}

async function buscarRankingServicos(negocioId, filtro) {
  const result = await db.query(
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

  return result.rows;
}

async function buscarRankingClientes(negocioId, filtro) {
  const result = await db.query(
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

  return result.rows;
}

module.exports = {
  buscarNegocioDoUsuario,
  buscarResumoProfissional,
  buscarServicosMaisVendidosProfissional,
  buscarResumoDono,
  buscarClientesRecorrentes,
  buscarPerformanceNegocio,
  buscarFavoritosRecebidos,
  buscarResumoDias,
  buscarRankingProfissionais,
  buscarRankingServicos,
  buscarRankingClientes
};