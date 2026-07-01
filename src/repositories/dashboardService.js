const dashboardRepository = require("../repositories/dashboardRepository");

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

async function buscarDashboardProfissional({ usuarioId }) {
  if (!usuarioId) {
    throw new Error("Usuário não autenticado.");
  }

  const negocio =
    await dashboardRepository.buscarNegocioDoUsuario(usuarioId);

  if (!negocio) {
    throw new Error("Usuário não está vinculado a nenhum negócio.");
  }

  const resumo =
    await dashboardRepository.buscarResumoProfissional(
      negocio.negocio_id,
      usuarioId
    );

  const servicosMaisVendidos =
    await dashboardRepository.buscarServicosMaisVendidosProfissional(
      negocio.negocio_id,
      usuarioId
    );

  return {
    negocio,
    resumo,
    servicosMaisVendidos
  };
}

async function buscarDashboardDono({
  usuarioId,
  periodo = "7dias"
}) {

  if (!usuarioId) {
    throw new Error("Usuário não autenticado.");
  }

  const negocio =
    await dashboardRepository.buscarNegocioDoUsuario(usuarioId);

  if (!negocio) {
    throw new Error("Usuário não está vinculado a nenhum negócio.");
  }

  if (negocio.papel !== "dono") {
    throw new Error("Apenas o dono pode acessar este dashboard.");
  }

  const filtro = filtroPeriodo(periodo);

  const resumo =
    await dashboardRepository.buscarResumoDono(
      negocio.negocio_id,
      filtro
    );

  const clientesRecorrentes =
    await dashboardRepository.buscarClientesRecorrentes(
      negocio.negocio_id
    );

  const performance =
    await dashboardRepository.buscarPerformanceNegocio(
      negocio.negocio_id
    );

  const favoritos =
    await dashboardRepository.buscarFavoritosRecebidos(
      negocio.negocio_id
    );

  const resumoDias =
    await dashboardRepository.buscarResumoDias(
      negocio.negocio_id,
      filtro
    );

  const rankingProfissionais =
    await dashboardRepository.buscarRankingProfissionais(
      negocio.negocio_id,
      filtro
    );

  const rankingServicos =
    await dashboardRepository.buscarRankingServicos(
      negocio.negocio_id,
      filtro
    );

  const rankingClientes =
    await dashboardRepository.buscarRankingClientes(
      negocio.negocio_id,
      filtro
    );

  const totalVisitas =
    Number(performance.visitas_perfil || 0);

  const agendamentosPeriodo =
    Number(resumo.agendamentos_periodo || 0);

  const taxaConversao =
    totalVisitas > 0
      ? Math.round((agendamentosPeriodo / totalVisitas) * 100)
      : 0;

  const ticketMedio =
    agendamentosPeriodo > 0
      ? Number(resumo.faturamento_periodo || 0) /
        agendamentosPeriodo
      : 0;

  return {
    periodo,

    negocio,

    resumo: {
      agendamentos_hoje: Number(resumo.agendamentos_hoje || 0),
      agendamentos_periodo: agendamentosPeriodo,
      faturamento_hoje: Number(resumo.faturamento_hoje || 0),
      faturamento_periodo: Number(resumo.faturamento_periodo || 0),
      clientes_novos: Number(resumo.clientes_novos || 0),
      clientes_recorrentes: Number(clientesRecorrentes),
      servicos_vendidos: Number(resumo.servicos_vendidos || 0),
      ticket_medio: ticketMedio
    },

    performance: {
      visitas_perfil: totalVisitas,
      cliques_whatsapp: Number(performance.cliques_whatsapp || 0),
      cliques_maps: Number(performance.cliques_maps || 0),
      favoritos_recebidos: Number(favoritos),
      taxa_conversao: taxaConversao
    },

    resumo_dias: resumoDias,
    ranking_profissionais: rankingProfissionais,
    ranking_servicos: rankingServicos,
    ranking_clientes: rankingClientes
  };
}

module.exports = {
  buscarDashboardProfissional,
  buscarDashboardDono
};