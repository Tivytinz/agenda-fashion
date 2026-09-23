const repository = require(
  "../repositories/adminAnalyticsV2Repository"
);
const professionalFunnelService = require(
  "./adminProfessionalFunnelService"
);
const professionalRecurrenceAnalysisService = require(
  "./adminProfessionalRecurrenceAnalysisService"
);
const adminAcquisitionFinancialService = require(
  "./adminAcquisitionFinancialService"
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

function numeroOuNull(valor) {
  if (
    valor === null ||
    valor === undefined ||
    valor === ""
  ) {
    return null;
  }

  const convertido = Number(valor);
  return Number.isFinite(convertido)
    ? convertido
    : null;
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
  const [
    firstParty,
    funil,
    retornoAquisicao,
  ] = await Promise.all([
    repository.listarAquisicao(periodoSeguro),
    professionalFunnelService.buscarFunil({ periodo: periodoSeguro }),
    adminAcquisitionFinancialService.buscar(),
  ]);

  return {
    periodo: periodoSeguro,
    sessoesPorOrigem: firstParty.origens,
    funilPorCampanha: mapearCampanhasFunil(funil),
    qualidadeMensuracao: funil.qualidadeMensuracao || null,
    diagnosticoAtribuicao: funil.diagnosticoAtribuicao || null,
    retornoAquisicao,
    metodologia: {
      sessoes:
        "Canal, source e medium são resolvidos no backend a partir de UTM, click IDs consentidos e referrer. Campanhas oficiais exigem correspondência com marketing_campanhas.",
      conversao:
        "Cadastros e marcos comerciais continuam vindo da coorte profissional canônica do backend; sessões first-party não são tratadas como cadastro, ativação ou receita.",
      retornoFinanceiro:
        "A Wave 27 mantém CAC de mídia e retorno bruto em uma coorte financeira separada e imutável por negócio. Essa leitura é acumulada desde o cutover próprio e não altera automaticamente a régua operacional de mídia.",
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
  const [resultado, churn, mrr, ltv] = await Promise.all([
    repository.buscarReceita(periodo),
    repository.buscarChurnPago(periodo),
    repository.buscarMrr(periodo),
    repository.buscarLtvObservado(),
  ]);
  const resumo = resultado.resumo || {};
  const basePagaInicio = numero(churn.base_paga_inicio);
  const saidasTerminais = numero(
    churn.saidas_terminais_base_inicial
  );
  const mrrInicial = numero(mrr.mrr_inicial);
  const newMrr = numero(mrr.new_mrr);
  const reactivationMrr = numero(mrr.reactivation_mrr);
  const expansionMrr = numero(mrr.expansion_mrr);
  const contractionMrr = numero(mrr.contraction_mrr);
  const churnedMrr = numero(mrr.churned_mrr);
  const mrrFinalTotal = numero(mrr.mrr_final_total);
  const mrrCalculado =
    mrrInicial +
    newMrr +
    reactivationMrr +
    expansionMrr -
    contractionMrr -
    churnedMrr;
  const divergenciaBridgeMrr =
    Number((mrrCalculado - mrrFinalTotal).toFixed(2));
  const periodicidadesNaoSuportadas = numero(
    mrr.assinaturas_periodicidade_nao_suportada
  );
  const bridgeMrrReconciliado =
    Math.abs(divergenciaBridgeMrr) < 0.01;
  const negociosComCheckout = numero(resumo.negocios_com_checkout);
  const negociosCheckoutConvertidos = numero(
    resumo.negocios_checkout_convertidos
  );
  const coortesLtv = Array.isArray(ltv.coortes)
    ? ltv.coortes.map((coorte) => ({
        coorteMes: coorte.coorte_mes,
        negocios: numero(coorte.negocios),
        madurosD30: numero(coorte.maduros_d30),
        madurosD60: numero(coorte.maduros_d60),
        madurosD90: numero(coorte.maduros_d90),
        receitaBrutaD30: numero(
          coorte.receita_bruta_d30
        ),
        receitaBrutaD60: numero(
          coorte.receita_bruta_d60
        ),
        receitaBrutaD90: numero(
          coorte.receita_bruta_d90
        ),
        ltvBrutoD30: numeroOuNull(
          coorte.ltv_bruto_d30
        ),
        ltvBrutoD60: numeroOuNull(
          coorte.ltv_bruto_d60
        ),
        ltvBrutoD90: numeroOuNull(
          coorte.ltv_bruto_d90
        ),
        valorExpostoReversoes: numero(
          coorte.valor_exposto_reversoes
        ),
        pagamentosEmReversao: numero(
          coorte.pagamentos_em_reversao
        ),
      }))
    : [];
  const somarCoortes = (campo) =>
    coortesLtv.reduce(
      (total, coorte) =>
        total + numero(coorte[campo]),
      0
    );
  const negociosLtv = somarCoortes("negocios");
  const madurosD30 = somarCoortes("madurosD30");
  const madurosD60 = somarCoortes("madurosD60");
  const madurosD90 = somarCoortes("madurosD90");
  const receitaBrutaD30 =
    somarCoortes("receitaBrutaD30");
  const receitaBrutaD60 =
    somarCoortes("receitaBrutaD60");
  const receitaBrutaD90 =
    somarCoortes("receitaBrutaD90");

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
      cancelamentosVencidosPendentesReconciliacao: numero(
        resumo.cancelamentos_vencidos_pendentes_reconciliacao
      ),
      conversoesIniciaisCanonicas: numero(
        resumo.conversoes_iniciais_canonicas
      ),
      renovacoesConfirmadasCanonicas: numero(
        resumo.renovacoes_confirmadas_canonicas
      ),
      reativacoesPagas: numero(
        resumo.reativacoes_pagas
      ),
      mudancasPlanoCanonicas: numero(
        resumo.mudancas_plano_canonicas
      ),
      pagamentosAtrasadosCanonicos: numero(
        resumo.pagamentos_atrasados_canonicos
      ),
      pagamentosRecuperadosCanonicos: numero(
        resumo.pagamentos_recuperados_canonicos
      ),
      reversoesFinanceirasCanonicas: numero(
        resumo.reversoes_financeiras_canonicas
      ),
      cancelamentosRenovacaoCanonicos: numero(
        resumo.cancelamentos_renovacao_canonicos
      ),
      saidasBasePagaCanonicas: numero(
        resumo.saidas_base_paga_canonicas
      ),
      basePagaInicioChurn: basePagaInicio,
      saidasTerminaisBaseInicial: saidasTerminais,
      churnBrutoNegocios: percentual(
        saidasTerminais,
        basePagaInicio
      ),
      negociosReativadosChurn: numero(
        churn.negocios_reativados
      ),
      basePagaFimChurn: numero(
        churn.base_paga_fim
      ),
      saidasCancelamentoVoluntario: numero(
        churn.saidas_cancelamento_voluntario
      ),
      saidasInadimplenciaNaoRecuperada: numero(
        churn.saidas_inadimplencia_nao_recuperada
      ),
      saidasEncerramentoProvedor: numero(
        churn.saidas_encerramento_provedor
      ),
      saidasOutrosMotivos: numero(
        churn.saidas_outros_motivos
      ),
      mrrInicial: mrrInicial,
      newMrr,
      reactivationMrr,
      expansionMrr,
      contractionMrr,
      churnedMrr,
      mrrFinalCoorteInicial: numero(
        mrr.mrr_final_coorte_inicial
      ),
      mrrFinalTotal,
      mrrEmRisco: numero(mrr.mrr_em_risco),
      negociosMrrEmRisco: numero(
        mrr.negocios_mrr_em_risco
      ),
      grr: percentual(
        mrr.mrr_retido_bruto,
        mrrInicial
      ),
      nrr: percentual(
        mrr.mrr_final_coorte_inicial,
        mrrInicial
      ),
      divergenciaBridgeMrr,
      bridgeMrrReconciliado,
      assinaturasPeriodicidadeNaoSuportada:
        periodicidadesNaoSuportadas,
    },
    churn: {
      inicioCobertura: churn.inicio_cobertura || null,
      inicioEfetivo: churn.inicio_efetivo || null,
      periodoAjustadoAoCutover:
        churn.periodo_ajustado_cutover === true,
      historicoAnteriorInferido: false,
    },
    mrr: {
      inicioCobertura: mrr.inicio_cobertura || null,
      inicioEfetivo: mrr.inicio_efetivo || null,
      periodoAjustadoAoCutover:
        mrr.periodo_ajustado_cutover === true,
      historicoAnteriorInferido: false,
      periodicidadeSuportada: "MONTHLY",
      bridgeReconciliado: bridgeMrrReconciliado,
      confiavel:
        Boolean(mrr.inicio_cobertura) &&
        bridgeMrrReconciliado &&
        periodicidadesNaoSuportadas === 0,
    },
    ltv: {
      inicioCobertura: ltv.inicio_cobertura || null,
      historicoAnteriorInferido: false,
      unidade: "negocio",
      ltvLiquidoDisponivel: false,
      independenteDoFiltroPeriodo: true,
      negociosCoorte: negociosLtv,
      madurosD30,
      madurosD60,
      madurosD90,
      ltvBrutoD30:
        madurosD30 > 0
          ? Number(
              (
                receitaBrutaD30 /
                madurosD30
              ).toFixed(2)
            )
          : null,
      ltvBrutoD60:
        madurosD60 > 0
          ? Number(
              (
                receitaBrutaD60 /
                madurosD60
              ).toFixed(2)
            )
          : null,
      ltvBrutoD90:
        madurosD90 > 0
          ? Number(
              (
                receitaBrutaD90 /
                madurosD90
              ).toFixed(2)
            )
          : null,
      receitaBrutaD30,
      receitaBrutaD60,
      receitaBrutaD90,
      valorExpostoReversoes:
        somarCoortes("valorExpostoReversoes"),
      pagamentosEmReversao:
        somarCoortes("pagamentosEmReversao"),
      coortes: coortesLtv,
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
      lifecycleCanonico:
        "Desde a Wave 22, transições financeiras novas também são gravadas de forma append-only em assinatura_eventos. Na Wave 23, cancelamentos com período já vencido são reconciliados em background. Na Wave 24, a baseline paga e as fronteiras de episódio permitem observar churn sem reconstruir historicamente fatos anteriores ao cutover.",
      churn:
        "Gross logo churn v1 usa negócios que estavam pagos no início efetivo do recorte e tiveram saída terminal depois desse instante. Reativação permanece separada e não reduz retroativamente o churn bruto. Quando o recorte começa antes do cutover, o início efetivo é ajustado para a baseline da Wave 24.",
      mrr:
        "MRR v1 usa snapshots monetários append-only desde a Wave 25 e nunca reconstrói valores históricos a partir do preço atual do catálogo. New MRR fica fora da NRR. Expansion e contraction usam o delta monetário efetivo; atraso ou disputa permanecem como MRR em risco até uma saída terminal. MRR é receita recorrente contratada, não caixa recebido.",
      nrr:
        "NRR v1 compara o MRR final dos negócios que pertenciam à base inicial com o MRR desses mesmos negócios no início. GRR ignora expansion e considera zero para um negócio da base inicial que teve saída terminal no recorte, mesmo que depois tenha reativado. Recortes anteriores ao cutover são ajustados à cobertura da Wave 25.",
      ltv:
        "LTV bruto observado v1 usa o negócio como unidade e soma pagamentos com data de pagamento dentro de D30, D60 e D90 desde a primeira conversão paga canônica posterior ao cutover da Wave 26. Somente negócios maduros entram em cada denominador. Churn não remove o negócio da coorte e reativação não cria nova aquisição. Reversões ficam expostas separadamente; o AF não calcula LTV líquido enquanto o valor econômico exato de reversões parciais não estiver persistido.",
      ativas:
        "Assinaturas pagas ativas é um estoque atual e não uma contagem criada no período. Cancelamentos cujo acesso já venceu são excluídos do estoque mesmo antes do próximo ciclo do worker financeiro.",
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
