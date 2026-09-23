const repository = require(
  "../repositories/adminAcquisitionFinancialRepository"
);
const aquisicaoFinanceiraRepository = require(
  "../repositories/aquisicaoFinanceiraRepository"
);
const {
  configuracaoDecisao,
} = require(
  "./adminProfessionalFunnelService"
);

function numero(valor) {
  const convertido = Number(valor);
  return Number.isFinite(convertido)
    ? convertido
    : 0;
}

function razao(
  numerador,
  denominador
) {
  const base = numero(denominador);

  if (base <= 0) {
    return null;
  }

  return Number(
    (
      numero(numerador) /
      base
    ).toFixed(2)
  );
}

function custoUnitario(
  centavos,
  quantidade
) {
  const total = numero(quantidade);

  if (
    total <= 0 ||
    numero(centavos) <= 0
  ) {
    return null;
  }

  return Math.round(
    numero(centavos) / total
  );
}

function mapearJanela(
  linha,
  dias
) {
  const sufixo = `d${dias}`;
  const investimento = numero(
    linha[
      `investimento_${sufixo}_centavos`
    ]
  );
  const negociosPagos = numero(
    linha[
      `negocios_pagos_${sufixo}`
    ]
  );
  const receita = numero(
    linha[
      `receita_${sufixo}_centavos`
    ]
  );
  const diasMaduros = numero(
    linha[
      `dias_maduros_${sufixo}`
    ]
  );
  const diasSobrepostos = numero(
    linha[
      `dias_sobrepostos_${sufixo}`
    ]
  );
  const diasAmbiguos = numero(
    linha[
      `dias_ambiguos_${sufixo}`
    ]
  );

  return {
    dias,
    diasMaduros,
    investimentoCentavos:
      investimento,
    negociosPagos,
    cacMidiaCentavos:
      custoUnitario(
        investimento,
        negociosPagos
      ),
    receitaBrutaCentavos:
      receita,
    ltvBrutoCentavos:
      custoUnitario(
        receita,
        negociosPagos
      ),
    retornoBruto:
      razao(
        receita,
        investimento
      ),
    ltvBrutoSobreCacMidia:
      negociosPagos > 0
        ? razao(
            custoUnitario(
              receita,
              negociosPagos
            ),
            custoUnitario(
              investimento,
              negociosPagos
            )
          )
        : null,
    diasFontesSobrepostas:
      diasSobrepostos,
    diasCustoAmbiguo:
      diasAmbiguos,
    custoConfiavel:
      diasAmbiguos === 0,
  };
}

function primeiraRecuperacao(
  janelas
) {
  const encontrada =
    janelas.find(
      (janela) =>
        janela.custoConfiavel &&
        janela.retornoBruto !== null &&
        janela.retornoBruto >= 1
    );

  return encontrada
    ? encontrada.dias
    : null;
}

async function buscar() {
  const configuracao =
    configuracaoDecisao();

  const [bruto, pendentes] =
    await Promise.all([
      repository.buscarRetornoAquisicao({
        diasMaturacaoMonetizacao:
          configuracao
            .diasMaturacaoMonetizacao,
      }),
      aquisicaoFinanceiraRepository
        .contarPendentes(),
    ]);

  const campanhas = (
    Array.isArray(bruto.campanhas)
      ? bruto.campanhas
      : []
  ).map((linha) => {
    const janelas = [30, 60, 90]
      .map((dias) =>
        mapearJanela(
          linha,
          dias
        )
      );

    return {
      campanhaOficialId:
        numero(linha.campanha_id),
      campanha:
        linha.campanha_nome || null,
      canal:
        linha.canal || null,
      origem:
        linha.utm_source || null,
      midia:
        linha.utm_medium || null,
      utmCampaign:
        linha.utm_campaign || null,
      janelas,
      primeiraRecuperacaoReceitaBrutaDias:
        primeiraRecuperacao(
          janelas
        ),
      valorExpostoReversoesCentavos:
        numero(
          linha
            .valor_exposto_reversoes_centavos
        ),
      pagantesSemCustoD30:
        numero(
          linha.pagantes_sem_custo_d30
        ),
      pagantesCustoAmbiguoD30:
        numero(
          linha
            .pagantes_custo_ambiguo_d30
        ),
    };
  });

  const diagnosticoBruto =
    bruto.diagnostico || {};

  const diasSobrepostos =
    campanhas.reduce(
      (total, campanha) =>
        total +
        numero(
          campanha.janelas[0]
            ?.diasFontesSobrepostas
        ),
      0
    );
  const diasAmbiguos =
    campanhas.reduce(
      (total, campanha) =>
        total +
        numero(
          campanha.janelas[0]
            ?.diasCustoAmbiguo
        ),
      0
    );

  return {
    inicioCobertura:
      bruto.inicio_cobertura || null,
    primeiroDiaCompleto:
      bruto.primeiro_dia_completo || null,
    independenteDoFiltroPeriodo: true,
    unidade: "negocio",
    diasMaturacaoMonetizacao:
      numero(
        bruto.dias_maturacao_monetizacao
      ),
    janelasDisponiveis: [30, 60, 90],
    campanhas,
    diagnostico: {
      snapshotsTotal:
        numero(
          diagnosticoBruto.snapshots_total
        ),
      snapshotsOficiais:
        numero(
          diagnosticoBruto
            .snapshots_oficiais
        ),
      snapshotsOrganicos:
        numero(
          diagnosticoBruto
            .snapshots_organicos
        ),
      snapshotsAtribuicaoIncompleta:
        numero(
          diagnosticoBruto
            .snapshots_atribuicao_incompleta
        ),
      snapshotsAquisicaoPreCutover:
        numero(
          diagnosticoBruto
            .snapshots_aquisicao_pre_cutover
        ),
      snapshotsPendentes:
        numero(pendentes),
      diasFontesSobrepostasD30:
        diasSobrepostos,
      diasCustoAmbiguoD30:
        diasAmbiguos,
    },
    metodologia: {
      custo:
        "CAC de mídia observado usa custo diário canônico. Uma fonte automática substitui o manual no mesmo dia sem somá-los; duas fontes automáticas tornam o dia ambíguo e bloqueiam a leitura financeira correspondente.",
      coorte:
        "A aquisição financeira é congelada por negócio a partir da primeira conversão paga canônica posterior ao cutover. Transferência de proprietária, troca de plano, nova assinatura e reativação não criam uma nova aquisição.",
      maturidade:
        "D30, D60 e D90 usam somente dias de aquisição maduros por pelo menos a janela de monetização configurada mais a janela de receita observada.",
      retorno:
        "Retorno bruto compara receita bruta observada com investimento de mídia da mesma coorte. Não representa margem, lucro ou payback econômico. Reversões permanecem exposição separada.",
    },
  };
}

module.exports = {
  buscar,
  mapearJanela,
  primeiraRecuperacao,
};
