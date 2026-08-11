const adminProfessionalFunnelRepository =
  require(
    "../repositories/adminProfessionalFunnelRepository"
  );

function numero(valor) {
  const convertido = Number(valor);
  return Number.isFinite(convertido)
    ? convertido
    : 0;
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

function mapearLinha(linha) {
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
  const investimentoCentavos =
    numero(linha.investimento_centavos);

  return {
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
    cacAssinanteCentavos:
      custoUnitario(
        investimentoCentavos,
        assinaturasAtivadas
      ),
  };
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

async function buscarFunil({
  periodo,
} = {}) {
  const periodoNormalizado =
    adminProfessionalFunnelRepository
      .periodoSeguro(periodo);

  const bruto =
    await adminProfessionalFunnelRepository
      .listarPorCampanha(
        periodoNormalizado
      );

  const campanhas =
    bruto.map(
      mapearLinha
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
  resumo.cacAssinanteCentavos =
    custoUnitario(
      resumo.investimentoCentavos,
      resumo.assinaturasAtivadas
    );

  return {
    periodo:
      periodoNormalizado,
    resumo,
    campanhas,
  };
}

module.exports = {
  buscarFunil,
  mapearLinha,
  percentual,
  custoUnitario,
};
