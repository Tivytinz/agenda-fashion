const adminProfessionalFunnelRepository =
  require(
    "../repositories/adminProfessionalFunnelRepository"
  );

const DECISAO_PADRAO = Object.freeze({
  metaRoas: 1,
  multiplicadorEscala: 1.2,
  minimoCadastros: 10,
  minimoAssinaturas: 2,
});

function numero(valor) {
  const convertido = Number(valor);
  return Number.isFinite(convertido)
    ? convertido
    : 0;
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
  const roas = campanha.roas === null ||
    campanha.roas === undefined
    ? null
    : numero(campanha.roas);

  if (investimentoCentavos <= 0) {
    return {
      codigo: "sem_dados",
      rotulo: "Sem dados",
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
        `Amostra pequena: ${cadastros} de ${configuracao.minimoCadastros} cadastros mínimos para uma decisão forte.`,
    };
  }

  if (assinaturas === 0) {
    return {
      codigo: "pausar",
      rotulo: "Pausar",
      confianca: "media",
      motivo:
        `A campanha já atingiu ${cadastros} cadastros e ainda não gerou assinatura ativada.`,
    };
  }

  if (
    assinaturas <
    configuracao.minimoAssinaturas
  ) {
    return {
      codigo: "observar",
      rotulo: "Observar",
      confianca: "media",
      motivo:
        `Há conversão, mas apenas ${assinaturas} de ${configuracao.minimoAssinaturas} assinaturas mínimas para validar rentabilidade.`,
    };
  }

  const metaEscala =
    configuracao.metaRoas *
    configuracao.multiplicadorEscala;

  if (roas >= metaEscala) {
    return {
      codigo: "escalar",
      rotulo: "Escalar",
      confianca: "alta",
      motivo:
        `ROAS ${roas.toFixed(2)}x está acima da faixa de escala de ${metaEscala.toFixed(2)}x com volume mínimo atingido.`,
    };
  }

  if (roas >= configuracao.metaRoas) {
    return {
      codigo: "manter",
      rotulo: "Manter",
      confianca: "alta",
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
      confianca: "alta",
      motivo:
        `ROAS ${roas.toFixed(2)}x está abaixo da meta de ${configuracao.metaRoas.toFixed(2)}x. Revise criativo, oferta e segmentação antes de aumentar orçamento.`,
    };
  }

  return {
    codigo: "pausar",
    rotulo: "Pausar",
    confianca: "alta",
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
  const checkoutsIniciados =
    numero(linha.checkouts_iniciados);
  const assinaturasAtivadas =
    numero(linha.assinaturas_ativadas);
  const receitaPrimeiroPagamentoCentavos =
    numero(
      linha.receita_primeiro_pagamento_centavos
    );
  const investimentoCentavos =
    numero(linha.investimento_centavos);

  const campanha = {
    origem:
      linha.origem,
    midia:
      linha.midia,
    campanha:
      linha.campanha,
    cadastros,
    negociosCriados,
    servicosCriados,
    agendasConfiguradas,
    negociosPublicados,
    checkoutsIniciados,
    assinaturasAtivadas,
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
    taxaPublicacao:
      percentual(
        negociosPublicados,
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

function resumirDecisoes(campanhas) {
  const resumo = {
    escalar: 0,
    manter: 0,
    observar: 0,
    revisar: 0,
    pausar: 0,
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
        periodoNormalizado
      );

  const campanhas =
    bruto.map(
      (linha) =>
        mapearLinha(
          linha,
          decisaoConfig
        )
    );

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

  return {
    periodo:
      periodoNormalizado,
    resumo,
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
      contagem:
        resumirDecisoes(campanhas),
    },
    campanhas,
  };
}

module.exports = {
  buscarFunil,
  mapearLinha,
  percentual,
  custoUnitario,
  calcularRoas,
  configuracaoDecisao,
  recomendarCampanha,
  resumirDecisoes,
};
