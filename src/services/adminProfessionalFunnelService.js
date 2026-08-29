const adminProfessionalFunnelRepository =
  require(
    "../repositories/adminProfessionalFunnelRepository"
  );

const DECISAO_PADRAO = Object.freeze({
  metaRoas: 1,
  multiplicadorEscala: 1.2,
  minimoCadastros: 10,
  minimoAssinaturas: 2,
  coberturaMinimaPercentual: 100,
  diasMaturacaoAtivacao: 14,
  diasMaturacaoMonetizacao: 21,
});

const GOOGLE_PROFISSIONAIS_CANONICA = Object.freeze({
  origem: "google",
  midia: "cpc",
  campanha: "google_ads_profissionais",
});

const GOOGLE_PROFISSIONAIS_ALIASES = new Set([
  "aquisicao_profissionais",
  "search_aquisicao_profissionais",
  "google_ads_profissionais",
  "profissionais_google_ads",
]);

const CAMPOS_SOMA = Object.freeze([
  "cadastros",
  "negocios_criados",
  "servicos_criados",
  "agendas_configuradas",
  "negocios_publicados",
  "perfis_divulgados",
  "visitas_pos_divulgacao",
  "agendamentos_iniciados_pos_divulgacao",
  "primeiros_agendamentos_via_divulgacao",
  "primeiros_agendamentos",
  "checkouts_iniciados",
  "assinaturas_ativadas",
  "cadastros_maduros_ativacao",
  "cadastros_maduros_monetizacao",
  "negocios_publicados_maduros_ativacao",
  "primeiros_agendamentos_maduros_ativacao",
  "assinaturas_ativadas_maduras_monetizacao",
  "investimento_centavos",
  "receita_primeiro_pagamento_centavos",
]);

function numero(valor) {
  const convertido = Number(valor);
  return Number.isFinite(convertido)
    ? convertido
    : 0;
}

function texto(valor) {
  return String(valor || "").trim();
}

function textoChave(valor) {
  return texto(valor).toLowerCase();
}

function numeroPositivo(
  valor,
  fallback
) {
  const convertido = Number(valor);
  return Number.isFinite(convertido) &&
    convertido > 0
    ? convertido
    : fallback;
}

function inteiroPositivo(
  valor,
  fallback
) {
  const convertido = Number.parseInt(
    valor,
    10
  );
  return Number.isInteger(convertido) &&
    convertido > 0
    ? convertido
    : fallback;
}

function percentualConfiguravel(
  valor,
  fallback
) {
  const convertido = Number(valor);

  return Number.isFinite(convertido) &&
    convertido > 0 &&
    convertido <= 100
    ? convertido
    : fallback;
}

function configuracaoDecisao(
  env = process.env
) {
  return {
    metaRoas:
      numeroPositivo(
        env.MARKETING_DECISION_ROAS_TARGET,
        DECISAO_PADRAO.metaRoas
      ),
    multiplicadorEscala:
      numeroPositivo(
        env.MARKETING_DECISION_SCALE_MULTIPLIER,
        DECISAO_PADRAO.multiplicadorEscala
      ),
    minimoCadastros:
      inteiroPositivo(
        env.MARKETING_DECISION_MIN_SIGNUPS,
        DECISAO_PADRAO.minimoCadastros
      ),
    minimoAssinaturas:
      inteiroPositivo(
        env.MARKETING_DECISION_MIN_SUBSCRIPTIONS,
        DECISAO_PADRAO.minimoAssinaturas
      ),
    coberturaMinimaPercentual:
      percentualConfiguravel(
        env.MARKETING_DECISION_MIN_ATTRIBUTION_COVERAGE,
        DECISAO_PADRAO.coberturaMinimaPercentual
      ),
    diasMaturacaoAtivacao:
      inteiroPositivo(
        env.MARKETING_DECISION_ACTIVATION_MATURITY_DAYS,
        DECISAO_PADRAO.diasMaturacaoAtivacao
      ),
    diasMaturacaoMonetizacao:
      inteiroPositivo(
        env.MARKETING_DECISION_MONETIZATION_MATURITY_DAYS,
        DECISAO_PADRAO.diasMaturacaoMonetizacao
      ),
  };
}

function percentual(
  parte,
  total
) {
  if (!total) {
    return 0;
  }

  return Number(
    (
      (parte / total) * 100
    ).toFixed(2)
  );
}

function custoUnitario(
  investimentoCentavos,
  quantidade
) {
  if (
    investimentoCentavos <= 0 ||
    quantidade <= 0
  ) {
    return null;
  }

  return Math.round(
    investimentoCentavos /
      quantidade
  );
}

function calcularRoas(
  receitaCentavos,
  investimentoCentavos
) {
  if (investimentoCentavos <= 0) {
    return null;
  }

  return Number(
    (
      receitaCentavos /
      investimentoCentavos
    ).toFixed(2)
  );
}

function identidadeExata(linha) {
  return {
    origem: texto(linha?.origem) || "organico",
    midia: texto(linha?.midia) || "none",
    campanha: texto(linha?.campanha) || "organico",
  };
}

function identidadeCanonica(linha) {
  const exata = identidadeExata(linha);
  const origem = textoChave(exata.origem);
  const midia = textoChave(exata.midia);
  const campanha = textoChave(exata.campanha);
  const classificacao = textoChave(
    linha?.classificacao_atribuicao ??
    linha?.classificacaoAtribuicao
  );

  if (
    (!classificacao || classificacao === "oficial") &&
    origem === "google" &&
    midia === "cpc" &&
    GOOGLE_PROFISSIONAIS_ALIASES.has(campanha)
  ) {
    return GOOGLE_PROFISSIONAIS_CANONICA;
  }

  return exata;
}

function chaveIdentidade(identidade) {
  return [
    textoChave(identidade.origem),
    textoChave(identidade.midia),
    textoChave(identidade.campanha),
  ].join("|");
}

function consolidarLinhasCampanha(linhas = []) {
  const grupos = new Map();

  for (const linha of linhas) {
    const exata = identidadeExata(linha);
    const canonica = identidadeCanonica(linha);
    const classificacao = textoChave(
      linha?.classificacao_atribuicao ??
      linha?.classificacaoAtribuicao
    );
    const chave = [
      chaveIdentidade(canonica),
      classificacao,
    ].join("|");

    if (!grupos.has(chave)) {
      grupos.set(chave, {
        origem: canonica.origem,
        midia: canonica.midia,
        campanha: canonica.campanha,
        campanha_oficial_id:
          linha?.campanha_oficial_id ||
          null,
        classificacao_atribuicao:
          linha?.classificacao_atribuicao ||
          null,
        identidades_utm: [],
        ...Object.fromEntries(
          CAMPOS_SOMA.map((campo) => [campo, 0])
        ),
      });
    }

    const grupo = grupos.get(chave);

    if (
      !grupo.campanha_oficial_id &&
      linha?.campanha_oficial_id
    ) {
      grupo.campanha_oficial_id =
        linha.campanha_oficial_id;
    }

    if (
      linha?.classificacao_atribuicao ===
      "oficial"
    ) {
      grupo.classificacao_atribuicao =
        "oficial";
    } else if (
      !grupo.classificacao_atribuicao &&
      linha?.classificacao_atribuicao
    ) {
      grupo.classificacao_atribuicao =
        linha.classificacao_atribuicao;
    }

    for (const campo of CAMPOS_SOMA) {
      grupo[campo] += numero(linha?.[campo]);
    }

    const chaveExata = chaveIdentidade(exata);
    const jaIncluida = grupo.identidades_utm.some(
      (identidade) =>
        chaveIdentidade(identidade) === chaveExata
    );

    if (!jaIncluida) {
      grupo.identidades_utm.push(exata);
    }
  }

  return Array.from(grupos.values()).map((grupo) => ({
    ...grupo,
    identidades_utm: grupo.identidades_utm.sort(
      (a, b) =>
        chaveIdentidade(a).localeCompare(
          chaveIdentidade(b),
          "pt-BR"
        )
    ),
  }));
}

function recomendarCampanha(
  campanha,
  configuracao = configuracaoDecisao()
) {
  const investimentoCentavos =
    numero(campanha.investimentoCentavos);
  const cadastros =
    numero(campanha.cadastros);
  const assinaturas =
    numero(campanha.assinaturasAtivadas);
  const cadastrosMadurosAtivacao =
    campanha.cadastrosMadurosAtivacao === null ||
    campanha.cadastrosMadurosAtivacao === undefined
      ? cadastros
      : numero(
          campanha.cadastrosMadurosAtivacao
        );
  const cadastrosMadurosMonetizacao =
    campanha.cadastrosMadurosMonetizacao === null ||
    campanha.cadastrosMadurosMonetizacao === undefined
      ? cadastros
      : numero(
          campanha.cadastrosMadurosMonetizacao
        );
  const publicadosMadurosAtivacao =
    campanha.negociosPublicadosMadurosAtivacao === null ||
    campanha.negociosPublicadosMadurosAtivacao === undefined
      ? cadastrosMadurosAtivacao
      : numero(
          campanha.negociosPublicadosMadurosAtivacao
        );
  const agendamentosMadurosAtivacao =
    campanha.primeirosAgendamentosMadurosAtivacao === null ||
    campanha.primeirosAgendamentosMadurosAtivacao === undefined
      ? cadastrosMadurosAtivacao
      : numero(
          campanha.primeirosAgendamentosMadurosAtivacao
        );
  const assinaturasMadurasMonetizacao =
    campanha.assinaturasAtivadasMadurasMonetizacao === null ||
    campanha.assinaturasAtivadasMadurasMonetizacao === undefined
      ? assinaturas
      : numero(
          campanha.assinaturasAtivadasMadurasMonetizacao
        );
  const roas = campanha.roas === null ||
    campanha.roas === undefined
    ? null
    : numero(campanha.roas);

  if (investimentoCentavos <= 0) {
    return {
      codigo: "sem_dados",
      rotulo: "Sem investimento atribuído",
      confianca: "baixa",
      motivo:
        "Sem investimento atribuído, não há base para recomendar escala ou pausa.",
    };
  }

  if (
    cadastros <
    configuracao.minimoCadastros
  ) {
    return {
      codigo: "observar",
      rotulo: "Observar",
      confianca: "baixa",
      motivo:
        `Amostra pequena: ${cadastros} de ${configuracao.minimoCadastros} cadastros mínimos para aplicar a régua operacional.`,
    };
  }

  if (
    cadastrosMadurosAtivacao <
    configuracao.minimoCadastros
  ) {
    return {
      codigo: "observar",
      rotulo: "Aguardar maturidade",
      confianca: "baixa",
      motivo:
        `${cadastrosMadurosAtivacao} de ${cadastros} cadastros já completaram ${configuracao.diasMaturacaoAtivacao} dias. Aguarde a janela mínima de ativação antes de otimizar investimento.`,
    };
  }

  if (
    publicadosMadurosAtivacao === 0
  ) {
    return {
      codigo: "revisar",
      rotulo: "Revisar ativação",
      confianca: "operacional",
      motivo:
        `Há ${cadastrosMadurosAtivacao} cadastros com janela de ativação completa, mas nenhum negócio foi publicado dentro de ${configuracao.diasMaturacaoAtivacao} dias. Revise o onboarding antes de alterar mídia.`,
    };
  }

  if (agendamentosMadurosAtivacao === 0) {
    return {
      codigo: "revisar",
      rotulo: "Revisar ativação",
      confianca: "operacional",
      motivo:
        `Há ${cadastrosMadurosAtivacao} cadastros com janela de ativação completa, mas nenhum primeiro agendamento foi recebido dentro de ${configuracao.diasMaturacaoAtivacao} dias. Revise publicação, oferta e descoberta antes de alterar mídia.`,
    };
  }

  if (
    cadastrosMadurosMonetizacao <
    configuracao.minimoCadastros
  ) {
    return {
      codigo: "observar",
      rotulo: "Aguardar monetização",
      confianca: "baixa",
      motivo:
        `${cadastrosMadurosMonetizacao} de ${cadastros} cadastros já completaram ${configuracao.diasMaturacaoMonetizacao} dias. Aguarde a janela de monetização antes de avaliar retorno.`,
    };
  }

  if (assinaturasMadurasMonetizacao === 0) {
    return {
      codigo: "revisar",
      rotulo: "Revisar monetização",
      confianca: "operacional",
      motivo:
        `Nenhum dos ${cadastrosMadurosMonetizacao} cadastros com janela de monetização completa ativou assinatura dentro de ${configuracao.diasMaturacaoMonetizacao} dias. No modelo freemium, isso exige revisar a conversão para o plano pago, não pausar mídia automaticamente.`,
    };
  }

  if (
    assinaturasMadurasMonetizacao <
    configuracao.minimoAssinaturas
  ) {
    return {
      codigo: "observar",
      rotulo: "Observar",
      confianca: "baixa",
      motivo:
        `Há conversão, mas apenas ${assinaturasMadurasMonetizacao} de ${configuracao.minimoAssinaturas} assinaturas maduras mínimas para aplicar a régua de ROAS.`,
    };
  }

  if (roas === null) {
    return {
      codigo: "observar",
      rotulo: "Aguardar retorno",
      confianca: "baixa",
      motivo:
        "O investimento existe, mas ainda não há base financeira consistente para calcular ROAS.",
    };
  }

  const metaEscala =
    configuracao.metaRoas *
    configuracao.multiplicadorEscala;

  if (roas >= metaEscala) {
    return {
      codigo: "escalar",
      rotulo: "Escalar",
      confianca: "operacional",
      motivo:
        `ROAS ${roas.toFixed(2)}x está acima da faixa de escala de ${metaEscala.toFixed(2)}x com volume mínimo atingido.`,
    };
  }

  if (roas >= configuracao.metaRoas) {
    return {
      codigo: "manter",
      rotulo: "Manter",
      confianca: "operacional",
      motivo:
        `ROAS ${roas.toFixed(2)}x atingiu a meta de ${configuracao.metaRoas.toFixed(2)}x, mas ainda não a faixa de escala.`,
    };
  }

  if (
    roas >=
    configuracao.metaRoas * 0.7
  ) {
    return {
      codigo: "revisar",
      rotulo: "Revisar",
      confianca: "operacional",
      motivo:
        `ROAS ${roas.toFixed(2)}x está abaixo da meta de ${configuracao.metaRoas.toFixed(2)}x. Revise criativo, oferta e segmentação antes de aumentar orçamento.`,
    };
  }

  return {
    codigo: "pausar",
    rotulo: "Pausar",
    confianca: "operacional",
    motivo:
      `ROAS ${roas.toFixed(2)}x está muito abaixo da meta de ${configuracao.metaRoas.toFixed(2)}x com volume mínimo já atingido.`,
  };
}

function mapearLinha(
  linha,
  configuracao = configuracaoDecisao()
) {
  const cadastros =
    numero(linha.cadastros);
  const negociosCriados =
    numero(linha.negocios_criados);
  const servicosCriados =
    numero(linha.servicos_criados);
  const agendasConfiguradas =
    numero(linha.agendas_configuradas);
  const negociosPublicados =
    numero(linha.negocios_publicados);
  const perfisDivulgados =
    numero(linha.perfis_divulgados);
  const visitasPosDivulgacao =
    numero(linha.visitas_pos_divulgacao);
  const agendamentosIniciadosPosDivulgacao =
    numero(
      linha.agendamentos_iniciados_pos_divulgacao
    );
  const primeirosAgendamentosViaDivulgacao =
    numero(
      linha.primeiros_agendamentos_via_divulgacao
    );
  const primeirosAgendamentos =
    numero(linha.primeiros_agendamentos);
  const checkoutsIniciados =
    numero(linha.checkouts_iniciados);
  const assinaturasAtivadas =
    numero(linha.assinaturas_ativadas);
  const cadastrosMadurosAtivacao =
    numero(
      linha.cadastros_maduros_ativacao
    );
  const cadastrosMadurosMonetizacao =
    numero(
      linha.cadastros_maduros_monetizacao
    );
  const negociosPublicadosMadurosAtivacao =
    numero(
      linha.negocios_publicados_maduros_ativacao
    );
  const primeirosAgendamentosMadurosAtivacao =
    numero(
      linha.primeiros_agendamentos_maduros_ativacao
    );
  const assinaturasAtivadasMadurasMonetizacao =
    numero(
      linha.assinaturas_ativadas_maduras_monetizacao
    );
  const receitaPrimeiroPagamentoCentavos =
    numero(
      linha.receita_primeiro_pagamento_centavos
    );
  const investimentoCentavos =
    numero(linha.investimento_centavos);
  const identidadesUtm = Array.isArray(linha.identidades_utm)
    ? linha.identidades_utm
    : [identidadeExata(linha)];
  const campanhaOficialId =
    linha?.campanha_oficial_id
      ? numero(
          linha.campanha_oficial_id
        )
      : null;
  const classificacaoInformada =
    texto(
      linha?.classificacao_atribuicao
    );
  const identidade =
    identidadeExata(linha);
  const campanhaAusente = [
    "",
    "(sem campanha)",
    "sem campanha",
    "organico",
    "orgânico",
  ].includes(
    textoChave(
      identidade.campanha
    )
  );
  const origemOrganica = [
    "organico",
    "orgânico",
  ].includes(
    textoChave(
      identidade.origem
    )
  );
  const midiaPaga = [
    "cpc",
    "ppc",
    "paid",
    "paid_search",
    "paid_social",
    "paid-social",
    "social_paid",
    "display",
  ].includes(
    textoChave(
      identidade.midia
    )
  );
  const classificacaoAtribuicao =
    classificacaoInformada || (
      campanhaOficialId ||
      numero(
        linha?.investimento_centavos
      ) > 0
        ? "oficial"
        : midiaPaga && campanhaAusente
          ? "rastreamento_incompleto"
          : midiaPaga
            ? "identidade_nao_oficial"
            : origemOrganica
              ? "organico"
              : campanhaAusente
                ? "sem_evidencia"
                : "identidade_nao_oficial"
    );

  const campanha = {
    origem:
      linha.origem,
    midia:
      linha.midia,
    campanha:
      linha.campanha,
    campanhaOficialId,
    classificacaoAtribuicao,
    oficial:
      classificacaoAtribuicao ===
        "oficial",
    identidadesUtm,
    consolidada:
      identidadesUtm.length > 1,
    cadastros,
    negociosCriados,
    servicosCriados,
    agendasConfiguradas,
    negociosPublicados,
    perfisDivulgados,
    visitasPosDivulgacao,
    agendamentosIniciadosPosDivulgacao,
    primeirosAgendamentosViaDivulgacao,
    primeirosAgendamentos,
    checkoutsIniciados,
    assinaturasAtivadas,
    cadastrosMadurosAtivacao,
    cadastrosMadurosMonetizacao,
    negociosPublicadosMadurosAtivacao,
    primeirosAgendamentosMadurosAtivacao,
    assinaturasAtivadasMadurasMonetizacao,
    investimentoCentavos,
    receitaPrimeiroPagamentoCentavos,
    roas:
      calcularRoas(
        receitaPrimeiroPagamentoCentavos,
        investimentoCentavos
      ),
    taxaNegocio:
      percentual(
        negociosCriados,
        cadastros
      ),
    taxaServico:
      percentual(
        servicosCriados,
        cadastros
      ),
    taxaAgenda:
      percentual(
        agendasConfiguradas,
        cadastros
      ),
    taxaPublicacao:
      percentual(
        negociosPublicados,
        cadastros
      ),
    taxaDivulgacaoPosAgenda:
      percentual(
        perfisDivulgados,
        agendasConfiguradas
      ),
    taxaVisitaPosDivulgacao:
      percentual(
        visitasPosDivulgacao,
        perfisDivulgados
      ),
    taxaInicioPosVisita:
      percentual(
        agendamentosIniciadosPosDivulgacao,
        visitasPosDivulgacao
      ),
    taxaConclusaoPosInicio:
      percentual(
        primeirosAgendamentosViaDivulgacao,
        agendamentosIniciadosPosDivulgacao
      ),
    taxaPrimeiroAgendamento:
      percentual(
        primeirosAgendamentos,
        cadastros
      ),
    taxaCheckout:
      percentual(
        checkoutsIniciados,
        cadastros
      ),
    taxaAssinatura:
      percentual(
        assinaturasAtivadas,
        cadastros
      ),
    custoCadastroCentavos:
      custoUnitario(
        investimentoCentavos,
        cadastros
      ),
    custoCheckoutCentavos:
      custoUnitario(
        investimentoCentavos,
        checkoutsIniciados
      ),
    cacAssinanteCentavos:
      custoUnitario(
        investimentoCentavos,
        assinaturasAtivadas
      ),
  };

  campanha.decisao =
    recomendarCampanha(
      campanha,
      configuracao
    );

  return campanha;
}

function somar(
  linhas,
  campo
) {
  return linhas.reduce(
    (total, linha) =>
      total + numero(linha[campo]),
    0
  );
}

function criarResumo(campanhas) {
  const resumo = {
    cadastros:
      somar(
        campanhas,
        "cadastros"
      ),
    negociosCriados:
      somar(
        campanhas,
        "negociosCriados"
      ),
    servicosCriados:
      somar(
        campanhas,
        "servicosCriados"
      ),
    agendasConfiguradas:
      somar(
        campanhas,
        "agendasConfiguradas"
      ),
    negociosPublicados:
      somar(
        campanhas,
        "negociosPublicados"
      ),
    perfisDivulgados:
      somar(
        campanhas,
        "perfisDivulgados"
      ),
    visitasPosDivulgacao:
      somar(
        campanhas,
        "visitasPosDivulgacao"
      ),
    agendamentosIniciadosPosDivulgacao:
      somar(
        campanhas,
        "agendamentosIniciadosPosDivulgacao"
      ),
    primeirosAgendamentosViaDivulgacao:
      somar(
        campanhas,
        "primeirosAgendamentosViaDivulgacao"
      ),
    primeirosAgendamentos:
      somar(
        campanhas,
        "primeirosAgendamentos"
      ),
    checkoutsIniciados:
      somar(
        campanhas,
        "checkoutsIniciados"
      ),
    assinaturasAtivadas:
      somar(
        campanhas,
        "assinaturasAtivadas"
      ),
    cadastrosMadurosAtivacao:
      somar(
        campanhas,
        "cadastrosMadurosAtivacao"
      ),
    cadastrosMadurosMonetizacao:
      somar(
        campanhas,
        "cadastrosMadurosMonetizacao"
      ),
    negociosPublicadosMadurosAtivacao:
      somar(
        campanhas,
        "negociosPublicadosMadurosAtivacao"
      ),
    primeirosAgendamentosMadurosAtivacao:
      somar(
        campanhas,
        "primeirosAgendamentosMadurosAtivacao"
      ),
    assinaturasAtivadasMadurasMonetizacao:
      somar(
        campanhas,
        "assinaturasAtivadasMadurasMonetizacao"
      ),
    investimentoCentavos:
      somar(
        campanhas,
        "investimentoCentavos"
      ),
    receitaPrimeiroPagamentoCentavos:
      somar(
        campanhas,
        "receitaPrimeiroPagamentoCentavos"
      ),
  };

  resumo.taxaNegocio =
    percentual(
      resumo.negociosCriados,
      resumo.cadastros
    );
  resumo.taxaPublicacao =
    percentual(
      resumo.negociosPublicados,
      resumo.cadastros
    );
  resumo.taxaPrimeiroAgendamento =
    percentual(
      resumo.primeirosAgendamentos,
      resumo.cadastros
    );
  resumo.taxaServico =
    percentual(
      resumo.servicosCriados,
      resumo.cadastros
    );
  resumo.taxaAgenda =
    percentual(
      resumo.agendasConfiguradas,
      resumo.cadastros
    );
  resumo.taxaDivulgacaoPosAgenda =
    percentual(
      resumo.perfisDivulgados,
      resumo.agendasConfiguradas
    );
  resumo.taxaVisitaPosDivulgacao =
    percentual(
      resumo.visitasPosDivulgacao,
      resumo.perfisDivulgados
    );
  resumo.taxaInicioPosVisita =
    percentual(
      resumo.agendamentosIniciadosPosDivulgacao,
      resumo.visitasPosDivulgacao
    );
  resumo.taxaConclusaoPosInicio =
    percentual(
      resumo.primeirosAgendamentosViaDivulgacao,
      resumo.agendamentosIniciadosPosDivulgacao
    );
  resumo.taxaCheckout =
    percentual(
      resumo.checkoutsIniciados,
      resumo.cadastros
    );
  resumo.taxaAssinatura =
    percentual(
      resumo.assinaturasAtivadas,
      resumo.cadastros
    );
  resumo.custoCadastroCentavos =
    custoUnitario(
      resumo.investimentoCentavos,
      resumo.cadastros
    );
  resumo.custoCheckoutCentavos =
    custoUnitario(
      resumo.investimentoCentavos,
      resumo.checkoutsIniciados
    );
  resumo.cacAssinanteCentavos =
    custoUnitario(
      resumo.investimentoCentavos,
      resumo.assinaturasAtivadas
    );
  resumo.roas =
    calcularRoas(
      resumo.receitaPrimeiroPagamentoCentavos,
      resumo.investimentoCentavos
    );

  return resumo;
}

function criarQualidadeMensuracao(
  cadastrosPorClassificacao,
  configuracao = configuracaoDecisao()
) {
  const cadastrosOficiais =
    numero(
      cadastrosPorClassificacao.oficial
    );
  const cadastrosSemCampanha =
    numero(
      cadastrosPorClassificacao
        .rastreamento_incompleto
    );
  const cadastrosIdentidadeNaoOficial =
    numero(
      cadastrosPorClassificacao
        .identidade_nao_oficial
    );
  const cadastrosSemEvidencia =
    numero(
      cadastrosPorClassificacao
        .sem_evidencia
    );
  const cadastrosOrganicos =
    numero(
      cadastrosPorClassificacao.organico
    );
  const cadastrosPagosPendentes =
    cadastrosSemCampanha +
    cadastrosIdentidadeNaoOficial;
  const cadastrosPagosDetectados =
    cadastrosOficiais +
    cadastrosPagosPendentes;
  const cadastrosTotais =
    cadastrosPagosDetectados +
    cadastrosSemEvidencia +
    cadastrosOrganicos;
  const coberturaAtribuicaoPagaPercentual =
    cadastrosPagosDetectados > 0
      ? percentual(
          cadastrosOficiais,
          cadastrosPagosDetectados
        )
      : null;
  const coberturaOrigemPercentual =
    cadastrosTotais > 0
      ? percentual(
          cadastrosTotais -
            cadastrosSemEvidencia,
          cadastrosTotais
        )
      : null;
  const bloqueios = [];

  if (
    coberturaAtribuicaoPagaPercentual !== null &&
    coberturaAtribuicaoPagaPercentual <
      configuracao.coberturaMinimaPercentual
  ) {
    bloqueios.push({
      codigo: "atribuicao_paga_incompleta",
      mensagem:
        `A cobertura dos cadastros pagos está em ${coberturaAtribuicaoPagaPercentual.toFixed(2)}%, abaixo do mínimo operacional de ${configuracao.coberturaMinimaPercentual.toFixed(2)}%.`,
    });
  }

  if (cadastrosSemEvidencia > 0) {
    bloqueios.push({
      codigo: "origem_sem_evidencia",
      mensagem:
        `${cadastrosSemEvidencia} cadastro(s) não têm evidência suficiente para separar mídia paga, orgânica ou acesso direto.`,
    });
  }

  return {
    cadastrosTotais,
    cadastrosPagosDetectados,
    cadastrosPagosPendentes,
    cadastrosSemEvidencia,
    coberturaAtribuicaoPagaPercentual,
    coberturaOrigemPercentual,
    coberturaMinimaPercentual:
      configuracao.coberturaMinimaPercentual,
    prontaParaDecisao:
      bloqueios.length === 0,
    bloqueios,
  };
}

function bloquearDecisaoPorMensuracao(
  campanha,
  qualidadeMensuracao
) {
  if (
    qualidadeMensuracao.prontaParaDecisao ||
    numero(campanha.investimentoCentavos) <= 0
  ) {
    return campanha;
  }

  const motivo = qualidadeMensuracao.bloqueios
    .map((bloqueio) => bloqueio.mensagem)
    .join(" ");

  return {
    ...campanha,
    decisao: {
      codigo: "mensuracao_incompleta",
      rotulo: "Aguardar mensuração",
      confianca: "bloqueada",
      motivo:
        `${motivo} Corrija a atribuição antes de escalar, manter ou pausar investimento.`,
    },
  };
}

function resumirDecisoes(campanhas) {
  const resumo = {
    escalar: 0,
    manter: 0,
    observar: 0,
    revisar: 0,
    pausar: 0,
    mensuracaoIncompleta: 0,
    semDados: 0,
  };

  campanhas.forEach((campanha) => {
    const codigo =
      campanha.decisao?.codigo;

    if (codigo === "sem_dados") {
      resumo.semDados += 1;
      return;
    }

    if (
      codigo ===
      "mensuracao_incompleta"
    ) {
      resumo.mensuracaoIncompleta += 1;
      return;
    }

    if (
      Object.prototype.hasOwnProperty.call(
        resumo,
        codigo
      )
    ) {
      resumo[codigo] += 1;
    }
  });

  return resumo;
}

async function buscarFunil({
  periodo,
} = {}) {
  const periodoNormalizado =
    adminProfessionalFunnelRepository
      .periodoSeguro(periodo);
  const decisaoConfig =
    configuracaoDecisao();

  const bruto =
    await adminProfessionalFunnelRepository
      .listarPorCampanha(
        periodoNormalizado,
        {
          diasMaturacaoAtivacao:
            decisaoConfig.diasMaturacaoAtivacao,
          diasMaturacaoMonetizacao:
            decisaoConfig.diasMaturacaoMonetizacao,
        }
      );

  const linhasConsolidadas =
    consolidarLinhasCampanha(bruto);

  const campanhasCalculadas =
    linhasConsolidadas.map(
      (linha) =>
        mapearLinha(
          linha,
          decisaoConfig
        )
    );

  const cadastrosPorClassificacao =
    campanhasCalculadas.reduce(
      (acumulado, campanha) => {
        const classificacao =
          campanha.classificacaoAtribuicao;

        if (
          Object.prototype.hasOwnProperty.call(
            acumulado,
            classificacao
          )
        ) {
          acumulado[classificacao] +=
            campanha.cadastros;
        }

        return acumulado;
      },
      {
        oficial: 0,
        rastreamento_incompleto: 0,
        identidade_nao_oficial: 0,
        sem_evidencia: 0,
        organico: 0,
      }
    );

  const qualidadeMensuracao =
    criarQualidadeMensuracao(
      cadastrosPorClassificacao,
      decisaoConfig
    );

  const campanhas =
    campanhasCalculadas.map(
      (campanha) =>
        bloquearDecisaoPorMensuracao(
          campanha,
          qualidadeMensuracao
        )
    );

  const campanhasOficiais =
    campanhas.filter(
      (campanha) => campanha.oficial
    );

  const resumo =
    criarResumo(campanhas);

  const resumoOficial =
    criarResumo(
      campanhasOficiais
    );

  return {
    periodo:
      periodoNormalizado,
    resumo,
    resumoOficial,
    diagnosticoAtribuicao: {
      cadastrosOficiais:
        cadastrosPorClassificacao
          .oficial,
      cadastrosSemCampanha:
        cadastrosPorClassificacao
          .rastreamento_incompleto,
      cadastrosIdentidadeNaoOficial:
        cadastrosPorClassificacao
          .identidade_nao_oficial,
      cadastrosSemEvidencia:
        cadastrosPorClassificacao
          .sem_evidencia,
      cadastrosOrganicos:
        cadastrosPorClassificacao
          .organico,
    },
    qualidadeMensuracao,
    decisao: {
      metaRoas:
        decisaoConfig.metaRoas,
      faixaEscalaRoas:
        Number(
          (
            decisaoConfig.metaRoas *
            decisaoConfig.multiplicadorEscala
          ).toFixed(2)
        ),
      minimoCadastros:
        decisaoConfig.minimoCadastros,
      minimoAssinaturas:
        decisaoConfig.minimoAssinaturas,
      coberturaMinimaPercentual:
        decisaoConfig
          .coberturaMinimaPercentual,
      diasMaturacaoAtivacao:
        decisaoConfig
          .diasMaturacaoAtivacao,
      diasMaturacaoMonetizacao:
        decisaoConfig
          .diasMaturacaoMonetizacao,
      contagem:
        resumirDecisoes(
          campanhasOficiais
        ),
    },
    campanhas,
    campanhasOficiais,
  };
}

module.exports = {
  buscarFunil,
  mapearLinha,
  consolidarLinhasCampanha,
  identidadeCanonica,
  percentual,
  custoUnitario,
  calcularRoas,
  configuracaoDecisao,
  recomendarCampanha,
  resumirDecisoes,
  criarResumo,
  criarQualidadeMensuracao,
  bloquearDecisaoPorMensuracao,
};
