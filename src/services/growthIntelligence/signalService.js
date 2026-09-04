const MIN_PROFILE_VISITS_FOR_CONVERSION = 20;
const MIN_BOOKINGS_FOR_SERVICE_SIGNAL = 8;

function nonNegativeNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : 0;
}

function nonNegativeInteger(value) {
  return Math.trunc(nonNegativeNumber(value));
}

function clampPercent(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return 0;
  return Math.min(Math.max(number, 0), 100);
}

function normalizeServiceRanking(items) {
  if (!Array.isArray(items)) return [];

  return items
    .map((item) => ({
      id: item?.id ?? null,
      nome: String(item?.nome || "").trim(),
      total: nonNegativeInteger(item?.total),
    }))
    .filter((item) => item.nome && item.total > 0)
    .sort((left, right) => right.total - left.total);
}

function buildGrowthSignals(dashboard = {}) {
  const summary = dashboard?.resumo || {};
  const performance = dashboard?.performance || {};
  const rankingServicos = normalizeServiceRanking(
    dashboard?.ranking_servicos
  );

  const visitasPerfil = nonNegativeInteger(
    performance.visitas_perfil
  );
  const agendamentosConcluidos = nonNegativeInteger(
    performance.agendamentos_concluidos
  );
  const cliquesWhatsapp = nonNegativeInteger(
    performance.cliques_whatsapp
  );
  const cliquesMaps = nonNegativeInteger(
    performance.cliques_maps
  );
  const favoritosRecebidos = nonNegativeInteger(
    performance.favoritos_recebidos
  );
  const taxaConversao = clampPercent(
    performance.taxa_conversao
  );
  const agendamentosPeriodo = nonNegativeInteger(
    summary.servicos_vendidos
  );

  const acoesInteresse =
    cliquesWhatsapp +
    cliquesMaps +
    favoritosRecebidos;

  const servicoDestaque = rankingServicos[0] || null;
  const participacaoServicoDestaque =
    servicoDestaque && agendamentosPeriodo > 0
      ? Math.min(
          (servicoDestaque.total / agendamentosPeriodo) * 100,
          100
        )
      : 0;

  return {
    periodo: String(dashboard?.periodo || ""),
    visitas_perfil: visitasPerfil,
    agendamentos_concluidos: agendamentosConcluidos,
    taxa_conversao: taxaConversao,
    cliques_whatsapp: cliquesWhatsapp,
    cliques_maps: cliquesMaps,
    favoritos_recebidos: favoritosRecebidos,
    acoes_interesse: acoesInteresse,
    agendamentos_periodo: agendamentosPeriodo,
    ranking_servicos: rankingServicos,
    servico_destaque: servicoDestaque,
    participacao_servico_destaque:
      participacaoServicoDestaque,
    amostra_conversao_suficiente:
      visitasPerfil >= MIN_PROFILE_VISITS_FOR_CONVERSION,
    amostra_servicos_suficiente:
      agendamentosPeriodo >= MIN_BOOKINGS_FOR_SERVICE_SIGNAL,
  };
}

module.exports = {
  MIN_PROFILE_VISITS_FOR_CONVERSION,
  MIN_BOOKINGS_FOR_SERVICE_SIGNAL,
  buildGrowthSignals,
};
