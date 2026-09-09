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

function mapearVisaoGeral(bruto, resumoFunil = {}) {
  const sessoes = numero(bruto.sessoes);
  const cadastros = numero(resumoFunil.cadastros);
  const negocios = numero(resumoFunil.negociosCriados);
  const servicos = numero(resumoFunil.servicosCriados);
  const publicados = numero(resumoFunil.negociosPublicados);
  const primeirosAgendamentos = numero(resumoFunil.primeirosAgendamentos);
  const assinaturasAtivadas = numero(resumoFunil.assinaturasAtivadas);

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
      servicosCriados: servicos,
      negociosPublicados: publicados,
      primeirosAgendamentos,
      taxaNegocioSobreCadastro:
        resumoFunil.taxaNegocio === undefined
          ? percentual(negocios, cadastros)
          : numero(resumoFunil.taxaNegocio),
      taxaServicoSobreCadastro:
        resumoFunil.taxaServico === undefined
          ? percentual(servicos, cadastros)
          : numero(resumoFunil.taxaServico),
      taxaPublicacaoSobreCadastro:
        resumoFunil.taxaPublicacao === undefined
          ? percentual(publicados, cadastros)
          : numero(resumoFunil.taxaPublicacao),
      taxaPrimeiroAgendamentoSobreCadastro:
        resumoFunil.taxaPrimeiroAgendamento === undefined
          ? percentual(primeirosAgendamentos, cadastros)
          : numero(resumoFunil.taxaPrimeiroAgendamento),
    },
    demanda: {
      agendamentosValidos: numero(bruto.agendamentos_validos),
    },
    receita: {
      pagamentosConfirmados: numero(bruto.pagamentos_confirmados),
      negociosComPagamento: numero(bruto.negocios_com_pagamento),
      receitaConfirmada: numero(bruto.receita_confirmada),
      assinaturasAtivadasCohorte: assinaturasAtivadas,
      taxaAssinaturaSobreCadastro:
        resumoFunil.taxaAssinatura === undefined
          ? percentual(assinaturasAtivadas, cadastros)
          : numero(resumoFunil.taxaAssinatura),
    },
    metodologia: {
      audiencia:
        "Sessões e tempo vêm do analytics first-party do AF e excluem a navegação em /admin.",
      ativacao:
        "As taxas de cadastro, negócio, serviço, publicação e primeiro agendamento acompanham a mesma coorte de profissionais cadastrados no período, usando o funil profissional canônico do backend.",
      receita:
        "Conversão para assinatura usa a mesma coorte profissional. Receita e pagamentos confirmados são fatos financeiros ocorridos no período e não são divididos pelos cadastros como se fossem a mesma coorte.",
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
  const periodoSeguro = repository.periodoSeguro(periodo);
  const [bruto, funil] = await Promise.all([
    repository.buscarVisaoGeral(periodoSeguro),
    professionalFunnelService.buscarFunil({ periodo: periodoSeguro }),
  ]);

  return mapearVisaoGeral(
    bruto,
    funil?.resumo || {}
  );
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
  const negociosComCheckout = numero(resumo.negocios_com_checkout);
  const negociosCheckoutConvertidos = numero(
    resumo.negocios_checkout_convertidos
  );

  return {
    periodo: resultado.periodo,
    resumo: {
      checkoutsIniciados: numero(resumo.checkouts_iniciados),
      checkoutsConcluidos: numero(resumo.checkouts_concluidos),
      checkoutsFalhos: numero(resumo.checkouts_falhos),
      negociosComCheckoutCohorte: negociosComCheckout,
      negociosCheckoutConvertidos,
      conversaoCheckoutParaAssinaturaPaga:
        percentual(
          negociosCheckoutConvertidos,
          negociosComCheckout
        ),
      pagamentosConfirmados: numero(resumo.pagamentos_confirmados),
      negociosPagantes: numero(resumo.negocios_pagantes),
      novasAssinaturasPagas: numero(resumo.novas_assinaturas_pagas),
      assinaturasPagasAtivas: numero(resumo.assinaturas_pagas_ativas),
      receitaTotal: numero(resumo.receita_total),
      receitaPrimeiroPagamento: numero(resumo.receita_primeiro_pagamento),
    },
    planos: resultado.planos,
    metodologia: {
      checkout:
        "Checkouts iniciados, concluídos e falhos contam tentativas técnicas criadas no período e não representam receita.",
      conversaoCheckout:
        "A conversão de checkout usa uma coorte de negócios distintos que iniciaram checkout no período. O numerador inclui somente os negócios cujo próprio checkout do recorte está vinculado a uma assinatura que já recebeu pagamento CONFIRMED/RECEIVED. A taxa pode amadurecer depois do fim do período.",
      novaAssinatura:
        "Nova assinatura paga é a assinatura cujo primeiro pagamento CONFIRMED/RECEIVED caiu no período. Esse total é um fato financeiro do período e não é usado como numerador da coorte de checkout.",
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
