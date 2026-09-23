const repository = require(
  "../repositories/adminAnalyticsV2Repository"
);
const professionalFunnelService = require(
  "./adminProfessionalFunnelService"
);
const professionalRecurrenceAnalysisService = require(
  "./adminProfessionalRecurrenceAnalysisService"
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
  const clientesComAgendamento = numero(
    bruto.clientes_com_agendamento
  );

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
    entidades: {
      profissionaisNoFunil: cadastros,
      negociosCriados: negocios,
      clientesComAgendamento,
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
      entidades:
        "Profissionais, negócios e clientes são contabilizados separadamente. Cliente usa agendamentos.client_id canônico; cadastro, clique, negócio e primeiro agendamento não são equivalentes.",
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


function mapearReconciliacaoPipelines(bruto = {}) {
  const linhas = Array.isArray(bruto.eventos)
    ? bruto.eventos
    : [];

  const eventos = linhas.map((linha) => {
    const legado = numero(linha.legado_eventos_comparaveis);
    const v2 = numero(linha.v2_eventos_comparaveis);
    const legadoSessoes = numero(linha.legado_sessoes_comparaveis);
    const v2Sessoes = numero(linha.v2_sessoes_comparaveis);

    return {
      evento: linha.evento,
      legadoPeriodo: numero(linha.legado_eventos_periodo),
      v2Periodo: numero(linha.v2_eventos_periodo),
      legadoComparavel: legado,
      v2Comparavel: v2,
      diferencaEventos: v2 - legado,
      divergenciaAbsoluta: Math.abs(v2 - legado),
      coberturaV2SobreLegado:
        legado > 0
          ? percentual(v2, legado)
          : null,
      legadoSessoesComparaveis: legadoSessoes,
      v2SessoesComparaveis: v2Sessoes,
      diferencaSessoes: v2Sessoes - legadoSessoes,
      bookingCompletedVinculados:
        numero(linha.booking_completed_vinculados),
      paridadeExata:
        legado === v2,
      paridadeSessoes:
        legadoSessoes === v2Sessoes,
    };
  });

  const legadoPeriodo = eventos.reduce(
    (total, item) => total + item.legadoPeriodo,
    0
  );
  const v2Periodo = eventos.reduce(
    (total, item) => total + item.v2Periodo,
    0
  );
  const temInicioComparavel = Boolean(
    bruto.inicioComparavel
  );
  const divergentes = eventos.filter(
    (item) => !item.paridadeExata
  ).length;

  let estado = "divergencia_observada";
  if (!temInicioComparavel) {
    estado = legadoPeriodo > 0
      ? "sem_base_v2"
      : "sem_eventos";
  } else if (divergentes === 0) {
    estado = "paridade_exata";
  }

  return {
    periodo: bruto.periodo || "30",
    inicioComparavel:
      bruto.inicioComparavel || null,
    estado,
    eventosComDivergencia: divergentes,
    legadoEventosPeriodo: legadoPeriodo,
    v2EventosPeriodo: v2Periodo,
    eventos,
    metodologia: {
      comparacao:
        "A reconciliação compara somente eventos emitidos pelos dois pipelines a partir do primeiro evento V2 comparável do recorte. Ela não soma os pipelines e não substitui fatos transacionais. Sessões aparecem como diagnóstico auxiliar, mas não definem paridade porque os pipelines usam contratos de sessionização diferentes.",
      eventos:
        "perfil_visualizado ↔ profile_viewed; links copiados/compartilhados ↔ profile_shared; agendamento_iniciado ↔ booking_started; agendamento_concluido ↔ booking_completed.",
      decisao:
        "Paridade exata é diagnóstico técnico, não autorização automática para remover o pipeline legado. A retirada exige estabilidade observada em produção e revisão das dependências restantes.",
    },
  };
}

async function buscarJourney(periodo) {
  const periodoSeguro = repository.periodoSeguro(periodo);
  const [jornada, reconciliacao] = await Promise.all([
    repository.buscarJornada(periodoSeguro),
    repository.buscarReconciliacaoPipelines(periodoSeguro),
  ]);

  return {
    ...jornada,
    reconciliacaoPipelines:
      mapearReconciliacaoPipelines(reconciliacao),
  };
}

async function buscarRetention(periodo) {
  return professionalRecurrenceAnalysisService.buscar({
    periodo: repository.periodoSeguro(periodo),
  });
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
      receitaValidaAtual: numero(resumo.receita_total),
      receitaBruta: numero(resumo.receita_bruta),
      pagamentosEmReversao: numero(resumo.pagamentos_em_reversao),
      valorExpostoReversoes: numero(resumo.valor_exposto_reversoes),
      receitaPrimeiroPagamento: numero(resumo.receita_primeiro_pagamento),
      novosNegociosPagantes: numero(resumo.novos_negocios_pagantes),
      receitaPrimeiraConversao: numero(
        resumo.receita_primeira_conversao
      ),
      pagamentosRenovacao: numero(resumo.pagamentos_renovacao),
      negociosComRenovacao: numero(resumo.negocios_com_renovacao),
      receitaRenovacao: numero(resumo.receita_renovacao),
      pagamentosMudancaPlano: numero(
        resumo.pagamentos_mudanca_plano
      ),
      negociosComMudancaPlano: numero(
        resumo.negocios_com_mudanca_plano
      ),
      receitaMudancaPlano: numero(
        resumo.receita_mudanca_plano
      ),
      renovacoesPrevistas: numero(resumo.renovacoes_previstas),
      renovacoesConfirmadas: numero(
        resumo.renovacoes_confirmadas
      ),
      taxaRenovacao: percentual(
        resumo.renovacoes_confirmadas,
        resumo.renovacoes_previstas
      ),
      renovacoesComAtraso: numero(
        resumo.renovacoes_com_atraso
      ),
      renovacoesRecuperadas: numero(
        resumo.renovacoes_recuperadas
      ),
      taxaRecuperacaoRenovacao: percentual(
        resumo.renovacoes_recuperadas,
        resumo.renovacoes_com_atraso
      ),
      cancelamentosRenovacaoAgendados: numero(
        resumo.cancelamentos_renovacao_agendados
      ),
      assinaturasEncerradasAposCancelamento: numero(
        resumo.assinaturas_encerradas_apos_cancelamento
      ),
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
        "Receita bruta usa cobranças que tiveram data de pagamento no período. Receita atualmente válida soma apenas pagamentos hoje em CONFIRMED/RECEIVED/RECEIVED_IN_CASH. Pagamentos em reversão ou disputa são mostrados separadamente pelo valor integral exposto da cobrança; o AF não chama esse valor de receita líquida porque o schema atual não persiste o valor exato de estornos parciais nem a data econômica de cada reversão. Receita de primeiro pagamento por assinatura é preservada por compatibilidade.",
      classificacaoReceita:
        "A Wave 21 classifica pagamentos válidos por negócio e assinatura sem alterar o schema: o primeiro pagamento cronológico do negócio é conversão inicial; pagamentos posteriores da mesma assinatura são renovação; o primeiro pagamento de uma assinatura paga posterior do mesmo negócio é mudança de plano. Mudança de plano não é chamada automaticamente de expansão porque pode representar upgrade, downgrade ou troca lateral.",
      retencaoFinanceira:
        "A coorte de renovação usa cobranças posteriores à primeira cobrança da mesma assinatura, com vencimento já ocorrido no período. Renovação confirmada exige status financeiro atualmente válido. Atraso observado usa o estado atual de atraso ou um webhook PAYMENT_OVERDUE processado; recuperação exige cobrança hoje confirmada/recebida com histórico processado de atraso. As taxas podem amadurecer depois do fim do período e ainda não constituem uma definição oficial de churn, LTV ou payback.",
      cancelamento:
        "Cancelamento de renovação agendado é estoque atual com acesso pago ainda ativo. Encerramento após cancelamento conta somente assinaturas inativas marcadas pela operação voluntária do titular no período; falha de pagamento recuperável não é classificada como churn.",
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
  mapearReconciliacaoPipelines,
  percentual,
};
