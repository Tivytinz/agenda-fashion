const {
  configuracaoDecisao,
} = require(
  "./adminProfessionalFunnelService"
);
const {
  ocorreuDentroDaJanela,
} = require(
  "./adminProfessionalRecurrenceService"
);
const {
  dataLocalSaoPaulo,
  diaCompletamenteMaduro,
} = require(
  "./adminProfessionalAcquisitionCostService"
);
const {
  pagamentoInicialNaJanela,
} = require(
  "./adminProfessionalRecurrenceMonetizationService"
);

const JANELAS_RECORRENCIA = Object.freeze([
  7,
  14,
  30,
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

function linhaOficialDaCampanha(
  linha,
  campanhaId
) {
  return (
    texto(
      linha?.classificacao_atribuicao
    ).toLowerCase() === "oficial" &&
    texto(linha?.campanha_oficial_id) ===
      campanhaId
  );
}

function encontrarJanela(
  campanha,
  campo,
  janelaDias
) {
  const janelas = Array.isArray(
    campanha?.[campo]
  )
    ? campanha[campo]
    : [];

  return janelas.find(
    (janela) =>
      numero(janela?.janelaDias) ===
        numero(janelaDias)
  ) || null;
}

function rotuloBloqueioCusto(codigo) {
  const rotulos = {
    aguardando_gasto_maduro:
      "Aguardando gasto maduro",
    gasto_maduro_sem_profissional:
      "Gasto maduro sem profissional atribuído",
    cobertura_custo_incompleta:
      "Cobertura de custo incompleta",
    origem_sem_evidencia:
      "Origem sem evidência",
    atribuicao_paga_incompleta:
      "Atribuição paga incompleta",
    amostra_madura_pequena:
      "Amostra madura pequena",
  };

  return rotulos[codigo] ||
    "Base financeira ainda não comparável";
}

function criarLeituraProntidao({
  custo,
  monetizacao,
  linhasCobertas,
}) {
  if (!custo) {
    return {
      codigo: "sem_base_custo",
      rotulo: "Sem base de custo",
      pronta: false,
      motivo:
        "A campanha ainda não possui a janela de custo maduro necessária para cruzar investimento, recorrência e monetização.",
    };
  }

  if (!monetizacao) {
    return {
      codigo: "sem_base_monetizacao",
      rotulo: "Sem base de monetização",
      pronta: false,
      motivo:
        "A campanha ainda não possui a janela de monetização correspondente para a leitura conjunta.",
    };
  }

  if (
    numero(
      monetizacao.diasMaturidadeNecessarios
    ) > numero(custo.diasNecessarios)
  ) {
    return {
      codigo:
        "maturidade_financeira_desalinhada",
      rotulo:
        "Aguardar maturidade financeira alinhada",
      pronta: false,
      motivo:
        "A janela de monetização exige mais tempo do que a base de custo de recorrência atualmente cobre. A leitura conjunta fica bloqueada para não misturar coortes com maturidades diferentes.",
    };
  }

  if (
    custo.baseComparavel !== true ||
    custo.leitura !==
      "base_madura_comparavel"
  ) {
    const codigo =
      texto(custo.leitura) ||
      "base_financeira_bloqueada";

    return {
      codigo,
      rotulo: rotuloBloqueioCusto(codigo),
      pronta: false,
      motivo:
        "A leitura conjunta herda os guardrails da base madura de custo. Corrija cobertura, atribuição, maturidade ou tamanho de amostra antes de usar essa janela financeiramente.",
    };
  }

  if (
    linhasCobertas.length !==
    numero(
      custo.profissionaisMadurosComGasto
    )
  ) {
    return {
      codigo: "base_financeira_inconsistente",
      rotulo: "Base financeira inconsistente",
      pronta: false,
      motivo:
        "A quantidade de profissionais reconstruída pelos dias maduros de gasto não coincide com a base madura registrada. A leitura fica bloqueada até a divergência ser investigada.",
    };
  }

  return {
    codigo: "leitura_conjunta_disponivel",
    rotulo: "Leitura conjunta disponível",
    pronta: true,
    motivo:
      "Investimento, profissionais oficialmente atribuídos, maturidade, recorrência e primeiro pagamento estão alinhados na mesma base financeira madura. Isso libera leitura descritiva, não uma recomendação automática de orçamento.",
  };
}

function selecionarLinhasCobertas({
  campanha,
  custo,
  linhasRecorrencia = [],
  investimentosDiarios = [],
  agora = new Date(),
}) {
  if (!custo) return [];

  const campanhaId = texto(
    campanha?.campanhaOficialId
  );
  const diasNecessarios = numero(
    custo.diasNecessarios
  );
  const datasComGastoMaduro = new Set(
    investimentosDiarios
      .filter(
        (gasto) =>
          texto(gasto?.campanha_id) ===
            campanhaId &&
          diaCompletamenteMaduro({
            dataLocal: texto(
              gasto?.data_gasto
            ),
            idadeDias: gasto?.idade_dias,
            diasNecessarios,
            agora,
          })
      )
      .map((gasto) =>
        texto(gasto?.data_gasto)
      )
  );

  return linhasRecorrencia.filter(
    (linha) => {
      if (
        !linhaOficialDaCampanha(
          linha,
          campanhaId
        )
      ) {
        return false;
      }

      const dataAtribuicao =
        dataLocalSaoPaulo(
          linha?.atribuicao_em
        );

      return Boolean(
        dataAtribuicao &&
        datasComGastoMaduro.has(
          dataAtribuicao
        )
      );
    }
  );
}

function contarResultados({
  linhas = [],
  janelaDias,
  configuracao,
}) {
  const diasAtivacao = numero(
    configuracao.diasMaturacaoAtivacao
  );
  const diasMonetizacao = numero(
    configuracao.diasMaturacaoMonetizacao
  );
  let comPrimeiroNaAtivacao = 0;
  let comSegundoNaJanela = 0;
  let comTerceiroNaJanela = 0;
  let assinaturasNaMonetizacao = 0;
  let assinaturasEntreSegundo = 0;
  let assinaturasEntreTerceiro = 0;

  for (const linha of linhas) {
    const primeiro =
      ocorreuDentroDaJanela(
        linha?.atribuicao_em,
        linha?.primeiro_agendamento_em,
        diasAtivacao
      );
    const segundo =
      primeiro &&
      ocorreuDentroDaJanela(
        linha?.primeiro_agendamento_em,
        linha?.segundo_agendamento_em,
        janelaDias
      );
    const terceiro =
      primeiro &&
      ocorreuDentroDaJanela(
        linha?.primeiro_agendamento_em,
        linha?.terceiro_agendamento_em,
        janelaDias
      );
    const assinatura =
      pagamentoInicialNaJanela(
        linha,
        diasMonetizacao
      );

    if (primeiro) {
      comPrimeiroNaAtivacao += 1;
    }
    if (segundo) {
      comSegundoNaJanela += 1;
    }
    if (terceiro) {
      comTerceiroNaJanela += 1;
    }
    if (assinatura) {
      assinaturasNaMonetizacao += 1;
    }
    if (assinatura && segundo) {
      assinaturasEntreSegundo += 1;
    }
    if (assinatura && terceiro) {
      assinaturasEntreTerceiro += 1;
    }
  }

  return {
    comPrimeiroNaAtivacao,
    comSegundoNaJanela,
    comTerceiroNaJanela,
    assinaturasNaMonetizacao,
    assinaturasEntreSegundo,
    assinaturasEntreTerceiro,
  };
}

function criarJanelaProntidao({
  campanha,
  linhasRecorrencia = [],
  investimentosDiarios = [],
  janelaDias,
  agora = new Date(),
  configuracao = configuracaoDecisao(),
}) {
  const custo = encontrarJanela(
    campanha,
    "custosRecorrenciaMadura",
    janelaDias
  );
  const monetizacao = encontrarJanela(
    campanha,
    "monetizacaoRecorrencia",
    janelaDias
  );
  const linhasCobertas =
    selecionarLinhasCobertas({
      campanha,
      custo,
      linhasRecorrencia,
      investimentosDiarios,
      agora,
    });
  const leitura = criarLeituraProntidao({
    custo,
    monetizacao,
    linhasCobertas,
  });
  const resultados = contarResultados({
    linhas: linhasCobertas,
    janelaDias,
    configuracao,
  });
  const minimoAssinaturas = numero(
    configuracao.minimoAssinaturas
  );

  return {
    janelaDias,
    diasMaturidadeFinanceira:
      Math.max(
        numero(custo?.diasNecessarios),
        numero(
          monetizacao
            ?.diasMaturidadeNecessarios
        )
      ),
    investimentoMaduroCentavos:
      custo
        ? numero(
            custo.investimentoMaduroCentavos
          )
        : null,
    profissionaisMadurosComGasto:
      custo
        ? numero(
            custo.profissionaisMadurosComGasto
          )
        : null,
    profissionaisReconstruidos:
      linhasCobertas.length,
    profissionaisMadurosSemGasto:
      custo
        ? numero(
            custo.profissionaisMadurosSemGasto
          )
        : null,
    ...resultados,
    minimoAssinaturasReguaRoas:
      minimoAssinaturas,
    atingiuMinimoAssinaturasReguaRoas:
      resultados.assinaturasNaMonetizacao >=
        minimoAssinaturas,
    prontaParaLeituraConjunta:
      leitura.pronta,
    leitura,
  };
}

function enriquecerRecorrenciaComProntidaoFinanceira({
  recorrencia = {},
  linhasRecorrencia = [],
  investimentosDiarios = [],
  agora = new Date(),
  configuracao = configuracaoDecisao(),
} = {}) {
  const campanhas = Array.isArray(
    recorrencia.qualidadeCampanhasOficiais
  )
    ? recorrencia.qualidadeCampanhasOficiais
    : [];

  return {
    ...recorrencia,
    qualidadeCampanhasOficiais:
      campanhas.map((campanha) => ({
        ...campanha,
        prontidaoFinanceiraRecorrencia:
          JANELAS_RECORRENCIA.map(
            (janelaDias) =>
              criarJanelaProntidao({
                campanha,
                linhasRecorrencia,
                investimentosDiarios,
                janelaDias,
                agora,
                configuracao,
              })
          ),
      })),
    diagnosticoProntidaoFinanceira: {
      minimoCadastros:
        numero(configuracao.minimoCadastros),
      minimoAssinaturas:
        numero(configuracao.minimoAssinaturas),
      coberturaMinimaPercentual:
        numero(
          configuracao
            .coberturaMinimaPercentual
        ),
      diasMaturacaoAtivacao:
        numero(
          configuracao.diasMaturacaoAtivacao
        ),
      diasMaturacaoMonetizacao:
        numero(
          configuracao.diasMaturacaoMonetizacao
        ),
    },
    metodologia: {
      ...(recorrencia.metodologia || {}),
      prontidaoFinanceira:
        "a prontidão financeira conjunta reutiliza os guardrails da base madura de custo e cruza somente profissionais oficialmente atribuídos cobertos pelos mesmos dias maduros de gasto. A janela precisa respeitar ativação, recorrência e monetização; divergência de maturidade bloqueia a leitura. Resultado zero de recorrência ou assinatura não bloqueia uma base íntegra. O mínimo de assinaturas da régua de ROAS é mostrado apenas como contexto e não substitui a decisão financeira do funil profissional.",
    },
  };
}

module.exports = {
  contarResultados,
  criarJanelaProntidao,
  criarLeituraProntidao,
  enriquecerRecorrenciaComProntidaoFinanceira,
  encontrarJanela,
  selecionarLinhasCobertas,
};
