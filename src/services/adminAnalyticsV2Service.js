const repository = require(
  "../repositories/adminAnalyticsV2Repository"
);
const professionalFunnelService = require(
  "./adminProfessionalFunnelService"
);
const professionalRecurrenceService = require(
  "./adminProfessionalRecurrenceService"
);

const SECOES = new Set([
  "overview",
  "acquisition",
  "journey",
  "retention",
  "revenue",
]);

function criarErro(mensagem, statusCode = 400) {
  const erro = new Error(mensagem);
  erro.status = statusCode;
  erro.statusCode = statusCode;
  return erro;
}

function numero(valor) {
  const convertido = Number(valor);
  return Number.isFinite(convertido) ? convertido : 0;
}

function percentual(parte, total) {
  const denominator = numero(total);
  if (denominator <= 0) return null;
  return Number(((numero(parte) / denominator) * 100).toFixed(2));
}

function mapearVisaoGeral(bruto) {
  const sessoes = numero(bruto.sessoes);
  const cadastros = numero(bruto.cadastros_profissionais);
  const negocios = numero(bruto.negocios_criados);
  const publicados = numero(bruto.negocios_publicados);
  const primeirosAgendamentos = numero(bruto.primeiros_agendamentos);
  const negociosComPagamento = numero(bruto.negocios_com_pagamento);

  return {
    periodo: bruto.periodo,
    audiencia: {
      usuariosAtivos: numero(bruto.usuarios_ativos),
      sessoes,
      visualizacoes: numero(bruto.visualizacoes),
      tempoMedioSessaoSegundos:
        sessoes > 0
          ? Number((numero(bruto.tempo_engajado_ms) / sessoes / 1000).toFixed(2))
          : null,
    },
    aquisicao: {
      cadastrosProfissionais: cadastros,
    },
    ativacao: {
      negociosCriados: negocios,
      negociosPublicados: publicados,
      primeirosAgendamentos,
      taxaNegocioSobreCadastro: percentual(negocios, cadastros),
      taxaPublicacaoSobreCadastro: percentual(publicados, cadastros),
      taxaPrimeiroAgendamentoSobreCadastro:
        percentual(primeirosAgendamentos, cadastros),
    },
    demanda: {
      agendamentosValidos: numero(bruto.agendamentos_validos),
    },
    receita: {
      pagamentosConfirmados: numero(bruto.pagamentos_confirmados),
      negociosComPagamento,
      receitaConfirmada: numero(bruto.receita_confirmada),
      taxaPagamentoSobreCadastro:
        percentual(negociosComPagamento, cadastros),
    },
    metodologia: {
      audiencia:
        "Sessões e tempo vêm do analytics first-party do AF e excluem a navegação em /admin.",
      ativacao:
        "Cadastro profissional usa a atribuição canônica do backend; publicação usa primeira_publicacao_em; primeiro agendamento usa a primeira reserva não cancelada de cada negócio.",
      receita:
        "Receita inclui somente pagamentos CONFIRMED/RECEIVED de planos pagos. Checkout e cadastro não contam como receita.",
    },
  };
}

function mapearCampanhasFunil(funil) {
  return (funil?.campanhas || []).map((campanha) => ({
    origem: campanha.origem,
    midia: campanha.midia,
    campanha: campanha.campanha,
    campanhaOficialId: campanha.campanhaOficialId,
    classificacaoAtribuicao: campanha.classificacaoAtribuicao,
    cadastros: numero(campanha.cadastros),
    negociosCriados: numero(campanha.negociosCriados),
    servicosCriados: numero(campanha.servicosCriados),
    negociosPublicados: numero(campanha.negociosPublicados),
    primeirosAgendamentos: numero(campanha.primeirosAgendamentos),
    checkoutsIniciados: numero(campanha.checkoutsIniciados),
    assinaturasAtivadas: numero(campanha.assinaturasAtivadas),
    investimentoCentavos: numero(campanha.investimentoCentavos),
    receitaPrimeiroPagamentoCentavos:
      numero(campanha.receitaPrimeiroPagamentoCentavos),
    cacAssinanteCentavos:
      campanha.cacAssinanteCentavos === null
        ? null
        : numero(campanha.cacAssinanteCentavos),
    roas: campanha.roas,
    decisao: campanha.decisao || null,
  }));
}

async function buscarOverview(periodo) {
  const bruto = await repository.buscarVisaoGeral(periodo);
  return mapearVisaoGeral(bruto);
}

async function buscarAcquisition(periodo) {
  const periodoSeguro = repository.periodoSeguro(periodo);
  const [firstParty, funil] = await Promise.all([
    repository.listarAquisicao(periodoSeguro),
    professionalFunnelService.buscarFunil({ periodo: periodoSeguro }),
  ]);

  return {
    periodo: periodoSeguro,
    sessoesPorOrigem: firstParty.origens,
    funilPorCampanha: mapearCampanhasFunil(funil),
    qualidadeMensuracao: funil.qualidadeMensuracao || null,
    diagnosticoAtribuicao: funil.diagnosticoAtribuicao || null,
    metodologia: {
      sessoes:
        "Canal, source e medium são resolvidos no backend a partir de UTM, click IDs consentidos e referrer. Campanhas oficiais exigem correspondência com marketing_campanhas.",
      conversao:
        "Cadastros e marcos comerciais continuam vindo da coorte profissional canônica do backend; sessões first-party não são tratadas como cadastro, ativação ou receita.",
    },
  };
}

async function buscarJourney(periodo) {
  return repository.buscarJornada(periodo);
}

async function buscarRetention(periodo) {
  return professionalRecurrenceService.buscarRecorrencia({ periodo });
}

async function buscarRevenue(periodo) {
  const resultado = await repository.buscarReceita(periodo);
  const resumo = resultado.resumo || {};
  const checkouts = numero(resumo.checkouts_iniciados);
  const novasPagas = numero(resumo.novas_assinaturas_pagas);

  return {
    periodo: resultado.periodo,
    resumo: {
      checkoutsIniciados: checkouts,
      checkoutsConcluidos: numero(resumo.checkouts_concluidos),
      checkoutsFalhos: numero(resumo.checkouts_falhos),
      pagamentosConfirmados: numero(resumo.pagamentos_confirmados),
      negociosPagantes: numero(resumo.negocios_pagantes),
      novasAssinaturasPagas: novasPagas,
      assinaturasPagasAtivas: numero(resumo.assinaturas_pagas_ativas),
      receitaTotal: numero(resumo.receita_total),
      receitaPrimeiroPagamento: numero(resumo.receita_primeiro_pagamento),
      conversaoCheckoutParaNovaAssinatura:
        percentual(novasPagas, checkouts),
    },
    planos: resultado.planos,
    metodologia: {
      checkout:
        "Checkout iniciado mede tentativa de compra, não receita.",
      novaAssinatura:
        "Nova assinatura paga é a assinatura cujo primeiro pagamento CONFIRMED/RECEIVED caiu no período.",
      receita:
        "Receita total soma pagamentos CONFIRMED/RECEIVED no período e pode incluir renovações; receita de primeiro pagamento isola monetização inicial.",
      ativas:
        "Assinaturas pagas ativas é um estoque atual e não uma contagem criada no período.",
    },
  };
}

async function buscar({ secao, periodo }) {
  const normalizada = String(secao || "").trim().toLowerCase();
  if (!SECOES.has(normalizada)) {
    throw criarErro("Seção administrativa inválida.", 404);
  }

  if (normalizada === "overview") return buscarOverview(periodo);
  if (normalizada === "acquisition") return buscarAcquisition(periodo);
  if (normalizada === "journey") return buscarJourney(periodo);
  if (normalizada === "retention") return buscarRetention(periodo);
  return buscarRevenue(periodo);
}

module.exports = {
  buscar,
  buscarOverview,
  buscarAcquisition,
  buscarJourney,
  buscarRetention,
  buscarRevenue,
  mapearVisaoGeral,
  mapearCampanhasFunil,
  percentual,
};
