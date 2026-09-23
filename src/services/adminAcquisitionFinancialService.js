const repository = require(
  "../repositories/adminAcquisitionFinancialRepository"
);
const aquisicaoFinanceiraRepository = require(
  "../repositories/aquisicaoFinanceiraRepository"
);
const paymentEconomicsRepository = require(
  "../repositories/adminPaymentEconomicsRepository"
);
const contributionReturnRepository = require(
  "../repositories/adminContributionReturnRepository"
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

function valorUnitario(
  centavos,
  quantidade
) {
  const total = numero(quantidade);

  if (total <= 0) {
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
  const pagantesSemCusto = numero(
    linha[
      `pagantes_sem_custo_${sufixo}`
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
    pagantesSemCusto,
    custoConfiavel:
      pagantesSemCusto === 0,
  };
}

function leituraJanela(
  janela
) {
  if (janela.pagantesSemCusto > 0) {
    return {
      codigo: "cobertura_custo_incompleta",
      rotulo: "Cobertura de custo incompleta",
      comparavel: false,
    };
  }

  if (janela.diasMaduros <= 0) {
    return {
      codigo: "aguardando_maturidade",
      rotulo: "Aguardando maturidade",
      comparavel: false,
    };
  }

  if (janela.investimentoCentavos <= 0) {
    return {
      codigo: "sem_investimento",
      rotulo: "Sem investimento maduro",
      comparavel: false,
    };
  }

  return {
    codigo: "base_comparavel",
    rotulo: "Base comparável",
    comparavel: true,
  };
}

function leituraContribuicao({
  diasMaduros,
  investimentoCentavos,
  negocios,
  negociosCobertos,
  incompletos,
  pagantesSemCusto,
  fontesObrigatorias,
}) {
  if (numero(fontesObrigatorias) <= 0) {
    return {
      codigo:
        "sem_fonte_contribuicao",
      rotulo:
        "Sem fonte de contribuição",
      comparavel: false,
    };
  }

  if (numero(pagantesSemCusto) > 0) {
    return {
      codigo:
        "cobertura_custo_incompleta",
      rotulo:
        "Cobertura de mídia incompleta",
      comparavel: false,
    };
  }

  if (numero(diasMaduros) <= 0) {
    return {
      codigo:
        "aguardando_maturidade",
      rotulo:
        "Aguardando maturidade",
      comparavel: false,
    };
  }

  if (numero(investimentoCentavos) <= 0) {
    return {
      codigo:
        "sem_investimento",
      rotulo:
        "Sem investimento maduro",
      comparavel: false,
    };
  }

  if (
    numero(incompletos) > 0 ||
    numero(negociosCobertos) !==
      numero(negocios)
  ) {
    return {
      codigo:
        "cobertura_contribuicao_incompleta",
      rotulo:
        "Cobertura de contribuição incompleta",
      comparavel: false,
    };
  }

  return {
    codigo: "base_comparavel",
    rotulo: "Base comparável",
    comparavel: true,
  };
}

function primeiraRecuperacao(
  janelas
) {
  const encontrada =
    janelas.find(
      (janela) =>
        janela.leitura?.comparavel === true &&
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

  const [
    bruto,
    pendentes,
    liquido,
    prontidaoContribuicao,
    retornoContribuicao,
  ] = await Promise.all([
    repository.buscarRetornoAquisicao({
      diasMaturacaoMonetizacao:
        configuracao
          .diasMaturacaoMonetizacao,
    }),
    aquisicaoFinanceiraRepository
      .contarPendentes(),
    paymentEconomicsRepository
      .buscarRetornoLiquidoAquisicao({
        diasMaturacaoMonetizacao:
          configuracao
            .diasMaturacaoMonetizacao,
      }),
    contributionReturnRepository
      .buscarProntidao(),
    contributionReturnRepository
      .buscarRetornoContribuicaoAquisicao({
        diasMaturacaoMonetizacao:
          configuracao
            .diasMaturacaoMonetizacao,
      }),
  ]);

  const liquidoPorCampanha =
    new Map(
      (
        Array.isArray(liquido.campanhas)
          ? liquido.campanhas
          : []
      ).map((item) => [
        numero(item.campanha_id),
        item,
      ])
    );

  const contribuicaoPorCampanha =
    new Map(
      (
        Array.isArray(
          retornoContribuicao.campanhas
        )
          ? retornoContribuicao.campanhas
          : []
      ).map((item) => [
        numero(item.campanha_id),
        item,
      ])
    );

  const campanhas = (
    Array.isArray(bruto.campanhas)
      ? bruto.campanhas
      : []
  ).map((linha) => {
    const janelas = [30, 60, 90]
      .map((dias) => {
        const janela =
          mapearJanela(
            linha,
            dias
          );
        const leitura =
          leituraJanela(
            janela
          );
        const economia =
          liquidoPorCampanha.get(
            numero(linha.campanha_id)
          ) || {};
        const sufixo =
          `d${dias}`;
        const negociosLiquidos =
          numero(
            economia[
              `negocios_${sufixo}`
            ]
          );
        const incompletosEconomia =
          numero(
            economia[
              `incompletos_${sufixo}`
            ]
          );
        const receitaLiquidaCentavos =
          Math.round(
            numero(
              economia[
                `receita_liquida_${sufixo}`
              ]
            ) * 100
          );
        const mesmaBase =
          negociosLiquidos ===
          janela.negociosPagos;
        const economiaComparavel =
          leitura.comparavel &&
          mesmaBase &&
          incompletosEconomia === 0;
        const retornoContribuicaoCampanha =
          contribuicaoPorCampanha.get(
            numero(linha.campanha_id)
          ) || {};
        const investimentoContribuicaoCentavos =
          numero(
            retornoContribuicaoCampanha[
              `investimento_${sufixo}_centavos`
            ]
          );
        const diasMadurosContribuicao =
          numero(
            retornoContribuicaoCampanha[
              `dias_maduros_${sufixo}`
            ]
          );
        const negociosContribuicao =
          numero(
            retornoContribuicaoCampanha[
              `negocios_${sufixo}`
            ]
          );
        const negociosCobertosContribuicao =
          numero(
            retornoContribuicaoCampanha[
              `negocios_cobertos_${sufixo}`
            ]
          );
        const incompletosContribuicao =
          numero(
            retornoContribuicaoCampanha[
              `incompletos_${sufixo}`
            ]
          );
        const pagantesSemCustoContribuicao =
          numero(
            retornoContribuicaoCampanha[
              `pagantes_sem_custo_${sufixo}`
            ]
          );
        const fontesObrigatoriasContribuicao =
          numero(
            retornoContribuicaoCampanha
              .fontes_obrigatorias ??
            prontidaoContribuicao
              .fontes_obrigatorias
          );
        const contribuicaoCentavos =
          Math.round(
            numero(
              retornoContribuicaoCampanha[
                `contribuicao_${sufixo}`
              ]
            ) * 100
          );
        const leituraContrib =
          leituraContribuicao({
            diasMaduros:
              diasMadurosContribuicao,
            investimentoCentavos:
              investimentoContribuicaoCentavos,
            negocios:
              negociosContribuicao,
            negociosCobertos:
              negociosCobertosContribuicao,
            incompletos:
              incompletosContribuicao,
            pagantesSemCusto:
              pagantesSemCustoContribuicao,
            fontesObrigatorias:
              fontesObrigatoriasContribuicao,
          });
        const cacMidiaContribuicaoCentavos =
          negociosContribuicao > 0
            ? custoUnitario(
                investimentoContribuicaoCentavos,
                negociosContribuicao
              )
            : null;
        const ltvContribuicaoCentavos =
          leituraContrib.comparavel &&
          negociosContribuicao > 0
            ? valorUnitario(
                contribuicaoCentavos,
                negociosContribuicao
              )
            : null;
        const retornoContribuicaoValor =
          leituraContrib.comparavel
            ? razao(
                contribuicaoCentavos,
                investimentoContribuicaoCentavos
              )
            : null;

        return {
          ...janela,
          custoConfiavel:
            leitura.comparavel,
          leitura,
          economiaLiquida: {
            comparavel:
              economiaComparavel,
            codigo:
              !leitura.comparavel
                ? "base_bruta_nao_comparavel"
                : !mesmaBase
                  ? "fora_cobertura_economica"
                  : incompletosEconomia > 0
                    ? "economia_incompleta"
                    : "base_comparavel",
            negociosCobertos:
              negociosLiquidos,
            pagamentosOuNegociosIncompletos:
              incompletosEconomia,
          },
          receitaLiquidaGatewayCentavos:
            economiaComparavel
              ? receitaLiquidaCentavos
              : null,
          ltvLiquidoGatewayCentavos:
            economiaComparavel &&
            janela.negociosPagos > 0
              ? custoUnitario(
                  receitaLiquidaCentavos,
                  janela.negociosPagos
                )
              : null,
          retornoLiquidoGateway:
            economiaComparavel
              ? razao(
                  receitaLiquidaCentavos,
                  janela.investimentoCentavos
                )
              : null,
          ltvLiquidoGatewaySobreCacMidia:
            economiaComparavel &&
            janela.negociosPagos > 0
              ? razao(
                  custoUnitario(
                    receitaLiquidaCentavos,
                    janela.negociosPagos
                  ),
                  janela.cacMidiaCentavos
                )
              : null,
          contribuicao: {
            ...leituraContrib,
            inicioCobertura:
              retornoContribuicao
                .inicio_cobertura ||
              null,
            fontesObrigatorias:
              fontesObrigatoriasContribuicao,
            diasMaduros:
              diasMadurosContribuicao,
            negocios:
              negociosContribuicao,
            negociosCobertos:
              negociosCobertosContribuicao,
            incompletos:
              incompletosContribuicao,
            pagantesSemCusto:
              pagantesSemCustoContribuicao,
            investimentoCentavos:
              investimentoContribuicaoCentavos,
            cacMidiaCentavos:
              cacMidiaContribuicaoCentavos,
            contribuicaoCentavos:
              leituraContrib.comparavel
                ? contribuicaoCentavos
                : null,
            ltvContribuicaoCentavos,
            retornoContribuicao:
              retornoContribuicaoValor,
            ltvContribuicaoSobreCacMidia:
              leituraContrib.comparavel &&
              ltvContribuicaoCentavos !== null
                ? razao(
                    ltvContribuicaoCentavos,
                    cacMidiaContribuicaoCentavos
                  )
                : null,
          },
        };
      });

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
      primeiraRecuperacaoLiquidaGatewayDias:
        (
          janelas.find(
            (janela) =>
              janela.economiaLiquida
                ?.comparavel === true &&
              janela.retornoLiquidoGateway
                !== null &&
              janela.retornoLiquidoGateway >= 1
          )?.dias || null
        ),
      primeiraRecuperacaoContribuicaoDias:
        (
          janelas.find(
            (janela) =>
              janela.contribuicao
                ?.comparavel === true &&
              janela.contribuicao
                .retornoContribuicao !==
                null &&
              janela.contribuicao
                .retornoContribuicao >= 1
          )?.dias || null
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
      pagantesSemCustoD60:
        numero(
          linha.pagantes_sem_custo_d60
        ),
      pagantesSemCustoD90:
        numero(
          linha.pagantes_sem_custo_d90
        ),
    };
  });

  const diagnosticoBruto =
    bruto.diagnostico || {};

  const pagantesSemCustoD30 =
    campanhas.reduce(
      (total, campanha) =>
        total +
        numero(
          campanha.pagantesSemCustoD30
        ),
      0
    );

  return {
    inicioCobertura:
      bruto.inicio_cobertura || null,
    primeiroDiaCompleto:
      bruto.primeiro_dia_completo || null,
    inicioCoberturaEconomiaLiquida:
      liquido.inicio_cobertura || null,
    inicioCoberturaRetornoContribuicao:
      retornoContribuicao
        .inicio_cobertura ||
      prontidaoContribuicao
        .inicio_cobertura_wave30 ||
      null,
    contribuicaoProntidao: {
      inicioCoberturaContribuicao:
        prontidaoContribuicao
          .inicio_cobertura_contribuicao ||
        null,
      fontesObrigatorias:
        numero(
          prontidaoContribuicao
            .fontes_obrigatorias
        ),
      fontesCobertasAteHoje:
        numero(
          prontidaoContribuicao
            .fontes_cobertas_ate_hoje
        ),
      inicioCoberturaFontes:
        prontidaoContribuicao
          .inicio_cobertura_fontes ||
        null,
      menorCobertoAte:
        prontidaoContribuicao
          .menor_coberto_ate ||
        null,
      coberturaCompletaHoje:
        prontidaoContribuicao
          .cobertura_contribuicao_completa_hoje ===
        true,
      ltvContribuicaoDisponivel:
        campanhas.some(
          (campanha) =>
            campanha.janelas.some(
              (janela) =>
                janela.contribuicao
                  ?.comparavel === true &&
                janela.contribuicao
                  .negocios > 0 &&
                janela.contribuicao
                  .ltvContribuicaoCentavos !==
                  null
            )
        ),
      retornoContribuicaoDisponivel:
        campanhas.some(
          (campanha) =>
            campanha.janelas.some(
              (janela) =>
                janela.contribuicao
                  ?.comparavel === true &&
                janela.contribuicao
                  .retornoContribuicao !==
                  null
            )
        ),
    },
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
      pagantesSemCustoD30,
    },
    metodologia: {
      custo:
        "CAC de mídia observado reutiliza o custo diário já canônico em marketing_campanha_gastos. A migration 037 garante uma única fonte efetiva por campanha/dia: a fonte gravada por último substitui a anterior, impedindo dupla contagem. Negócio pago adquirido em dia sem custo correspondente bloqueia a comparação da janela madura.",
      coorte:
        "A aquisição financeira é congelada por negócio a partir da primeira conversão paga canônica posterior ao cutover. Transferência de proprietária, troca de plano, nova assinatura e reativação não criam uma nova aquisição.",
      maturidade:
        "D30, D60 e D90 usam somente dias de aquisição maduros por pelo menos a janela de monetização configurada mais a janela de receita observada.",
      retorno:
        "Retorno bruto compara receita bruta observada com investimento de mídia da mesma coorte. A Wave 28 acrescenta retorno líquido de gateway somente quando a mesma base possui economia reconciliada, usando netValue menos refunds DONE. Nenhuma das leituras representa margem, lucro ou payback econômico.",
      retornoContribuicao:
        "A Wave 30 calcula retorno de contribuição sobre CAC de mídia apenas para aquisições oficiais posteriores ao cutover próprio. A mesma janela D30/D60/D90 exige custo de mídia canônico, economia de gateway reconciliada e cobertura integral das fontes obrigatórias de contribuição. Casos incompletos bloqueiam a janela e não são removidos da base. CAC total, lucro e payback econômico definitivo continuam fora do contrato.",
    },
  };
}

module.exports = {
  buscar,
  mapearJanela,
  primeiraRecuperacao,
  leituraJanela,
  leituraContribuicao,
  valorUnitario,
};
