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
  agruparPorCampanhaOficial,
} = require(
  "./adminProfessionalRecurrenceCampaignService"
);
const {
  dataLocalSaoPaulo,
} = require(
  "./adminProfessionalAcquisitionCostService"
);

const DIA_MS = 24 * 60 * 60 * 1000;
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

function percentualOuNulo(
  parte,
  total
) {
  const denominador = numero(total);

  if (denominador <= 0) {
    return null;
  }

  return Number(
    ((numero(parte) / denominador) * 100)
      .toFixed(2)
  );
}

function timestamp(valor) {
  if (!valor) return null;

  const convertido =
    new Date(valor).getTime();

  return Number.isFinite(convertido)
    ? convertido
    : null;
}

function ordinalData(valor) {
  const partes = String(valor || "")
    .split("-")
    .map((parte) => Number(parte));

  if (
    partes.length !== 3 ||
    partes.some((parte) =>
      !Number.isInteger(parte)
    )
  ) {
    return null;
  }

  const [ano, mes, dia] = partes;
  const convertido = Date.UTC(
    ano,
    mes - 1,
    dia
  );

  return Number.isFinite(convertido)
    ? Math.floor(convertido / DIA_MS)
    : null;
}

function dataPagamentoLocal(valor) {
  const texto = String(valor || "").trim();

  if (/^\d{4}-\d{2}-\d{2}$/.test(texto)) {
    return texto;
  }

  return dataLocalSaoPaulo(valor);
}

function estaMaduroDesdeAquisicao(
  atribuicaoEm,
  agora,
  diasNecessarios
) {
  const atribuicaoMs =
    timestamp(atribuicaoEm);
  const agoraMs = timestamp(agora);

  if (
    atribuicaoMs === null ||
    agoraMs === null ||
    agoraMs < atribuicaoMs
  ) {
    return false;
  }

  return (
    agoraMs - atribuicaoMs >=
    numero(diasNecessarios) * DIA_MS
  );
}

function pagamentoInicialValido(linha) {
  return (
    linha?.pagamento_inicial_valido === true ||
    String(
      linha?.pagamento_inicial_valido || ""
    ).toLowerCase() === "true"
  );
}

function pagamentoInicialNaJanela(
  linha,
  diasMonetizacao
) {
  if (!pagamentoInicialValido(linha)) {
    return false;
  }

  const aquisicao = ordinalData(
    dataLocalSaoPaulo(
      linha?.atribuicao_em
    )
  );
  const pagamento = ordinalData(
    dataPagamentoLocal(
      linha?.primeiro_pagamento_em
    )
  );

  if (
    aquisicao === null ||
    pagamento === null ||
    pagamento < aquisicao
  ) {
    return false;
  }

  return (
    pagamento - aquisicao <=
    numero(diasMonetizacao)
  );
}

function primeiroNaAtivacao(
  linha,
  diasAtivacao
) {
  return ocorreuDentroDaJanela(
    linha?.atribuicao_em,
    linha?.primeiro_agendamento_em,
    diasAtivacao
  );
}

function repetiuNaJanela(
  linha,
  campo,
  janelaDias
) {
  return ocorreuDentroDaJanela(
    linha?.primeiro_agendamento_em,
    linha?.[campo],
    janelaDias
  );
}

function criarJanelaMonetizacao(
  linhas = [],
  janelaDias,
  agora,
  configuracao
) {
  const diasAtivacao = numero(
    configuracao.diasMaturacaoAtivacao
  );
  const diasMonetizacao = numero(
    configuracao.diasMaturacaoMonetizacao
  );
  const diasMaturidadeNecessarios =
    Math.max(
      diasMonetizacao,
      diasAtivacao + janelaDias
    );
  const maduras = linhas.filter(
    (linha) =>
      estaMaduroDesdeAquisicao(
        linha?.atribuicao_em,
        agora,
        diasMaturidadeNecessarios
      )
  );

  let comPrimeiroNaAtivacao = 0;
  let comSegundoNaJanela = 0;
  let comTerceiroNaJanela = 0;
  let assinaturasNaMonetizacao = 0;
  let assinaturasEntrePrimeiro = 0;
  let assinaturasEntreSegundo = 0;
  let assinaturasEntreTerceiro = 0;

  for (const linha of maduras) {
    const primeiro =
      primeiroNaAtivacao(
        linha,
        diasAtivacao
      );
    const segundo =
      primeiro &&
      repetiuNaJanela(
        linha,
        "segundo_agendamento_em",
        janelaDias
      );
    const terceiro =
      primeiro &&
      repetiuNaJanela(
        linha,
        "terceiro_agendamento_em",
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
    if (assinatura && primeiro) {
      assinaturasEntrePrimeiro += 1;
    }
    if (assinatura && segundo) {
      assinaturasEntreSegundo += 1;
    }
    if (assinatura && terceiro) {
      assinaturasEntreTerceiro += 1;
    }
  }

  const profissionaisMaduros =
    maduras.length;

  return {
    janelaDias,
    diasMaturidadeNecessarios,
    profissionaisMaduros,
    comPrimeiroNaAtivacao,
    comSegundoNaJanela,
    comTerceiroNaJanela,
    assinaturasNaMonetizacao,
    taxaAssinaturaBaseMadura:
      percentualOuNulo(
        assinaturasNaMonetizacao,
        profissionaisMaduros
      ),
    assinaturasEntrePrimeiro,
    taxaAssinaturaEntrePrimeiro:
      percentualOuNulo(
        assinaturasEntrePrimeiro,
        comPrimeiroNaAtivacao
      ),
    assinaturasEntreSegundo,
    taxaAssinaturaEntreSegundo:
      percentualOuNulo(
        assinaturasEntreSegundo,
        comSegundoNaJanela
      ),
    assinaturasEntreTerceiro,
    taxaAssinaturaEntreTerceiro:
      percentualOuNulo(
        assinaturasEntreTerceiro,
        comTerceiroNaJanela
      ),
    minimoCadastrosReguaOperacional:
      numero(configuracao.minimoCadastros),
    baseAbaixoReguaOperacional:
      profissionaisMaduros <
        numero(configuracao.minimoCadastros),
  };
}

function criarMonetizacaoPorCampanha({
  linhas = [],
  agora = new Date(),
  configuracao = configuracaoDecisao(),
  janelas = JANELAS_RECORRENCIA,
} = {}) {
  return agruparPorCampanhaOficial(
    linhas
  ).map((grupo) => ({
    chave: grupo.chave,
    campanhaOficialId:
      grupo.campanhaOficialId,
    origem: grupo.origem,
    midia: grupo.midia,
    campanha: grupo.campanha,
    janelas: janelas.map(
      (janelaDias) =>
        criarJanelaMonetizacao(
          grupo.linhas,
          janelaDias,
          agora,
          configuracao
        )
    ),
  }));
}

function enriquecerRecorrenciaComMonetizacao({
  recorrencia = {},
  linhasRecorrencia = [],
  agora = new Date(),
  configuracao = configuracaoDecisao(),
} = {}) {
  const monetizacao =
    criarMonetizacaoPorCampanha({
      linhas: linhasRecorrencia,
      agora,
      configuracao,
    });
  const porCampanha = new Map(
    monetizacao.map((item) => [
      String(item.campanhaOficialId),
      item,
    ])
  );
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
        monetizacaoRecorrencia:
          porCampanha.get(
            String(
              campanha?.campanhaOficialId || ""
            )
          )?.janelas || [],
      })),
    diagnosticoMonetizacaoRecorrencia: {
      diasMaturacaoAtivacao:
        numero(
          configuracao.diasMaturacaoAtivacao
        ),
      diasMaturacaoMonetizacao:
        numero(
          configuracao.diasMaturacaoMonetizacao
        ),
      minimoCadastros:
        numero(configuracao.minimoCadastros),
      janelas: JANELAS_RECORRENCIA.map(
        (janelaDias) => ({
          janelaDias,
          diasMaturidadeNecessarios:
            Math.max(
              numero(
                configuracao
                  .diasMaturacaoMonetizacao
              ),
              numero(
                configuracao
                  .diasMaturacaoAtivacao
              ) + janelaDias
            ),
        })
      ),
    },
    metodologia: {
      ...(recorrencia.metodologia || {}),
      monetizacaoRecorrencia:
        "a monetização usa somente o primeiro pagamento datado de um plano pago do negócio e o considera válido quando seu status atual é CONFIRMED ou RECEIVED, preservando a mesma regra do funil profissional. Como pagamentos.data_pagamento é DATE, a janela financeira é comparada por dia civil em America/Sao_Paulo, entre o dia local da atribuição e o dia-limite configurado. As janelas D7, D14 e D30 usam coortes cujo timestamp de aquisição já completou o maior prazo entre monetização e ativação somada à janela de repetição. As taxas mostram coexistência entre repetição de valor e assinatura paga na mesma coorte madura; não provam causalidade e não definem retenção, LTV, payback ou ROAS.",
    },
  };
}

module.exports = {
  criarJanelaMonetizacao,
  criarMonetizacaoPorCampanha,
  dataPagamentoLocal,
  enriquecerRecorrenciaComMonetizacao,
  estaMaduroDesdeAquisicao,
  pagamentoInicialNaJanela,
  percentualOuNulo,
};
