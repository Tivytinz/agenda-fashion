const repository = require(
  "../repositories/adminProfessionalAcquisitionCostRepository"
);
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

const JANELAS_RECORRENCIA = [7, 14, 30];
const DIA_MS = 24 * 60 * 60 * 1000;
const REPORT_TIME_ZONE = "America/Sao_Paulo";
const formatadorData = new Intl.DateTimeFormat(
  "en-US",
  {
    timeZone: REPORT_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }
);

function numero(valor) {
  const convertido = Number(valor);
  return Number.isFinite(convertido)
    ? convertido
    : 0;
}

function texto(valor) {
  return String(valor || "").trim();
}

function percentual(parte, total) {
  if (!total) return null;

  return Number(
    ((parte / total) * 100).toFixed(2)
  );
}

function custoPorResultado(
  investimentoCentavos,
  quantidade
) {
  const investimento = numero(
    investimentoCentavos
  );
  const base = numero(quantidade);

  if (investimento <= 0 || base <= 0) {
    return null;
  }

  return Math.round(
    investimento / base
  );
}

function criarDiagnosticoMedicao(
  qualidadeAquisicao = []
) {
  const contagens = {
    oficial: 0,
    organico: 0,
    rastreamento_incompleto: 0,
    identidade_nao_oficial: 0,
    sem_evidencia: 0,
  };

  for (const grupo of qualidadeAquisicao) {
    const classificacao = String(
      grupo?.classificacaoAtribuicao || ""
    )
      .trim()
      .toLowerCase();

    if (
      Object.prototype.hasOwnProperty.call(
        contagens,
        classificacao
      )
    ) {
      contagens[classificacao] += numero(
        grupo?.profissionais
      );
    }
  }

  const pagosSemAtribuicaoOficial =
    contagens.rastreamento_incompleto +
    contagens.identidade_nao_oficial;
  const basePagaClassificavel =
    contagens.oficial +
    pagosSemAtribuicaoOficial;
  const coberturaAtribuicaoPaga =
    percentual(
      contagens.oficial,
      basePagaClassificavel
    );
  const medicaoIncompleta =
    pagosSemAtribuicaoOficial > 0 ||
    contagens.sem_evidencia > 0;

  return {
    profissionaisOficiais:
      contagens.oficial,
    profissionaisOrganicos:
      contagens.organico,
    pagosSemAtribuicaoOficial,
    profissionaisSemEvidencia:
      contagens.sem_evidencia,
    coberturaAtribuicaoPaga,
    medicaoIncompleta,
  };
}

function criarLinhaSemRecorrencia(
  investimento = {}
) {
  const campanhaId = texto(
    investimento.campanha_id
  );

  return {
    chave: `campanha:${campanhaId}`,
    campanhaOficialId: campanhaId,
    origem:
      texto(investimento.utm_source) ||
      texto(investimento.canal) ||
      "desconhecida",
    midia:
      texto(investimento.utm_medium) ||
      "desconhecida",
    campanha:
      texto(investimento.utm_campaign) ||
      texto(investimento.campanha_nome),
    metodosResolucao: [],
    profissionais: 0,
    comPrimeiroAgendamento: 0,
    taxaPrimeiroSobreProfissionais: 0,
    comSegundoAgendamento: 0,
    taxaSegundoSobrePrimeiro: 0,
    comTerceiroAgendamento: 0,
    taxaTerceiroSobrePrimeiro: 0,
    janelasCandidatas: [],
  };
}

function definirLeituraCusto({
  investimentoCentavos,
  profissionais,
  comPrimeiroAgendamento,
  medicao,
}) {
  if (investimentoCentavos <= 0) {
    return "sem_investimento_registrado";
  }

  if (profissionais <= 0) {
    return "investimento_sem_profissional_atribuido";
  }

  if (medicao.medicaoIncompleta) {
    return "observado_medicao_incompleta";
  }

  if (comPrimeiroAgendamento <= 0) {
    return "observado_sem_primeiro_agendamento";
  }

  return "observado";
}

function enriquecerCampanhas({
  qualidadeCampanhasOficiais = [],
  qualidadeAquisicao = [],
  investimentos = [],
} = {}) {
  const medicao = criarDiagnosticoMedicao(
    qualidadeAquisicao
  );
  const porId = new Map();

  for (const campanha of qualidadeCampanhasOficiais) {
    const id = texto(
      campanha?.campanhaOficialId
    );
    if (!id) continue;

    porId.set(id, {
      campanha,
      investimento: null,
    });
  }

  for (const investimento of investimentos) {
    const id = texto(
      investimento?.campanha_id
    );
    if (!id) continue;

    if (!porId.has(id)) {
      porId.set(id, {
        campanha:
          criarLinhaSemRecorrencia(
            investimento
          ),
        investimento,
      });
      continue;
    }

    porId.get(id).investimento =
      investimento;
  }

  return [...porId.values()]
    .map(({ campanha, investimento }) => {
      const investimentoCentavos = numero(
        investimento?.investimento_centavos
      );
      const diasComGasto = numero(
        investimento?.dias_com_gasto
      );
      const profissionais = numero(
        campanha?.profissionais
      );
      const comPrimeiroAgendamento = numero(
        campanha?.comPrimeiroAgendamento
      );

      return {
        ...campanha,
        investimentoCentavos,
        diasComGasto,
        custoObservadoPorProfissionalCentavos:
          custoPorResultado(
            investimentoCentavos,
            profissionais
          ),
        custoObservadoPrimeiroAgendamentoCentavos:
          custoPorResultado(
            investimentoCentavos,
            comPrimeiroAgendamento
          ),
        leituraCusto:
          definirLeituraCusto({
            investimentoCentavos,
            profissionais,
            comPrimeiroAgendamento,
            medicao,
          }),
        medicaoCusto: medicao,
      };
    })
    .sort((a, b) => {
      const investimento =
        numero(b.investimentoCentavos) -
        numero(a.investimentoCentavos);

      if (investimento !== 0) {
        return investimento;
      }

      const profissionais =
        numero(b.profissionais) -
        numero(a.profissionais);

      if (profissionais !== 0) {
        return profissionais;
      }

      return String(a.campanha || "")
        .localeCompare(
          String(b.campanha || ""),
          "pt-BR"
        );
    });
}

function dataLocalSaoPaulo(valor) {
  const data = new Date(valor);

  if (!Number.isFinite(data.getTime())) {
    return null;
  }

  const partes = Object.fromEntries(
    formatadorData
      .formatToParts(data)
      .filter((parte) =>
        ["year", "month", "day"].includes(
          parte.type
        )
      )
      .map((parte) => [
        parte.type,
        parte.value,
      ])
  );

  if (
    !partes.year ||
    !partes.month ||
    !partes.day
  ) {
    return null;
  }

  return [
    partes.year,
    partes.month,
    partes.day,
  ].join("-");
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
  const timestamp = Date.UTC(
    ano,
    mes - 1,
    dia
  );

  return Number.isFinite(timestamp)
    ? Math.floor(timestamp / DIA_MS)
    : null;
}

function idadeDiasLocais(
  dataLocal,
  agora = new Date()
) {
  const atual = ordinalData(
    dataLocalSaoPaulo(agora)
  );
  const origem = ordinalData(dataLocal);

  if (
    atual === null ||
    origem === null ||
    atual < origem
  ) {
    return null;
  }

  return atual - origem;
}

function diaCompletamenteMaduro({
  dataLocal,
  idadeDias,
  diasNecessarios,
  agora,
}) {
  const idade =
    Number.isFinite(Number(idadeDias))
      ? Number(idadeDias)
      : idadeDiasLocais(
          dataLocal,
          agora
        );

  if (!Number.isFinite(idade)) {
    return false;
  }

  return idade > diasNecessarios;
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

function criarLeituraCustoRecorrencia({
  investimentoMaduroCentavos,
  diasMadurosComGasto,
  profissionaisMadurosComGasto,
  profissionaisMadurosSemGasto,
  medicao,
  configuracao,
}) {
  if (
    investimentoMaduroCentavos <= 0 ||
    diasMadurosComGasto <= 0
  ) {
    return "aguardando_gasto_maduro";
  }

  if (profissionaisMadurosComGasto <= 0) {
    return "gasto_maduro_sem_profissional";
  }

  if (profissionaisMadurosSemGasto > 0) {
    return "cobertura_custo_incompleta";
  }

  if (medicao.profissionaisSemEvidencia > 0) {
    return "origem_sem_evidencia";
  }

  if (
    medicao.coberturaAtribuicaoPaga !== null &&
    medicao.coberturaAtribuicaoPaga <
      configuracao.coberturaMinimaPercentual
  ) {
    return "atribuicao_paga_incompleta";
  }

  if (
    profissionaisMadurosComGasto <
    configuracao.minimoCadastros
  ) {
    return "amostra_madura_pequena";
  }

  return "base_madura_comparavel";
}

function criarCustosRecorrenciaMadura({
  campanha,
  linhasRecorrencia = [],
  investimentosDiarios = [],
  medicao,
  configuracao,
  agora = new Date(),
  janelas = JANELAS_RECORRENCIA,
}) {
  const campanhaId = texto(
    campanha?.campanhaOficialId
  );
  const linhasCampanha =
    linhasRecorrencia.filter((linha) =>
      linhaOficialDaCampanha(
        linha,
        campanhaId
      )
    );
  const gastosCampanha =
    investimentosDiarios.filter(
      (investimento) =>
        texto(investimento?.campanha_id) ===
          campanhaId
    );
  const diasMaturacaoAtivacao =
    numero(
      configuracao.diasMaturacaoAtivacao
    );

  return janelas.map((janelaDias) => {
    const diasNecessarios =
      diasMaturacaoAtivacao +
      janelaDias;
    const gastosMaduros =
      gastosCampanha.filter((gasto) =>
        diaCompletamenteMaduro({
          dataLocal: texto(
            gasto?.data_gasto
          ),
          idadeDias: gasto?.idade_dias,
          diasNecessarios,
          agora,
        })
      );
    const datasComGastoMaduro = new Set(
      gastosMaduros.map((gasto) =>
        texto(gasto?.data_gasto)
      )
    );
    const investimentoMaduroCentavos =
      gastosMaduros.reduce(
        (total, gasto) =>
          total + numero(
            gasto?.investimento_centavos
          ),
        0
      );
    const linhasMaturas =
      linhasCampanha.filter((linha) => {
        const dataAtribuicao =
          dataLocalSaoPaulo(
            linha?.atribuicao_em
          );

        return (
          dataAtribuicao &&
          datasComGastoMaduro.has(
            dataAtribuicao
          )
        );
      });
    const profissionaisMadurosSemGasto =
      linhasCampanha.filter((linha) => {
        const dataAtribuicao =
          dataLocalSaoPaulo(
            linha?.atribuicao_em
          );

        if (!dataAtribuicao) {
          return false;
        }

        return (
          diaCompletamenteMaduro({
            dataLocal: dataAtribuicao,
            diasNecessarios,
            agora,
          }) &&
          !datasComGastoMaduro.has(
            dataAtribuicao
          )
        );
      }).length;

    let comPrimeiroNaAtivacao = 0;
    let comSegundoNaJanela = 0;
    let comTerceiroNaJanela = 0;

    for (const linha of linhasMaturas) {
      const primeiroValido =
        ocorreuDentroDaJanela(
          linha.atribuicao_em,
          linha.primeiro_agendamento_em,
          diasMaturacaoAtivacao
        );

      if (!primeiroValido) {
        continue;
      }

      comPrimeiroNaAtivacao += 1;

      if (
        ocorreuDentroDaJanela(
          linha.primeiro_agendamento_em,
          linha.segundo_agendamento_em,
          janelaDias
        )
      ) {
        comSegundoNaJanela += 1;
      }

      if (
        ocorreuDentroDaJanela(
          linha.primeiro_agendamento_em,
          linha.terceiro_agendamento_em,
          janelaDias
        )
      ) {
        comTerceiroNaJanela += 1;
      }
    }

    const leitura =
      criarLeituraCustoRecorrencia({
        investimentoMaduroCentavos,
        diasMadurosComGasto:
          gastosMaduros.length,
        profissionaisMadurosComGasto:
          linhasMaturas.length,
        profissionaisMadurosSemGasto,
        medicao,
        configuracao,
      });

    return {
      janelaDias,
      diasMaturacaoAtivacao,
      diasNecessarios,
      investimentoMaduroCentavos,
      diasMadurosComGasto:
        gastosMaduros.length,
      profissionaisMadurosComGasto:
        linhasMaturas.length,
      profissionaisMadurosSemGasto,
      comPrimeiroNaAtivacao,
      comSegundoNaJanela,
      comTerceiroNaJanela,
      taxaSegundoSobreBaseMadura:
        percentual(
          comSegundoNaJanela,
          linhasMaturas.length
        ),
      taxaTerceiroSobreBaseMadura:
        percentual(
          comTerceiroNaJanela,
          linhasMaturas.length
        ),
      custoObservadoPrimeiroMaduroCentavos:
        custoPorResultado(
          investimentoMaduroCentavos,
          comPrimeiroNaAtivacao
        ),
      custoObservadoSegundoMaduroCentavos:
        custoPorResultado(
          investimentoMaduroCentavos,
          comSegundoNaJanela
        ),
      custoObservadoTerceiroMaduroCentavos:
        custoPorResultado(
          investimentoMaduroCentavos,
          comTerceiroNaJanela
        ),
      baseComparavel:
        leitura === "base_madura_comparavel",
      minimoCadastros:
        configuracao.minimoCadastros,
      leitura,
    };
  });
}

function enriquecerCustosRecorrenciaMadura({
  campanhas = [],
  linhasRecorrencia = [],
  investimentosDiarios = [],
  medicao,
  configuracao,
  agora,
}) {
  return campanhas.map((campanha) => ({
    ...campanha,
    custosRecorrenciaMadura:
      criarCustosRecorrenciaMadura({
        campanha,
        linhasRecorrencia,
        investimentosDiarios,
        medicao,
        configuracao,
        agora,
      }),
  }));
}

async function buscarInvestimentos(
  periodo
) {
  const resultado =
    await repository.listarInvestimentos(
      periodo
    );

  return resultado.linhas;
}

async function buscarInvestimentosDiarios(
  periodo
) {
  const resultado =
    await repository.listarInvestimentosDiarios(
      periodo
    );

  return resultado.linhas;
}

function enriquecerRecorrencia({
  recorrencia = {},
  linhasRecorrencia = [],
  investimentos = [],
  investimentosDiarios = [],
  agora = new Date(),
  configuracao = configuracaoDecisao(),
} = {}) {
  const campanhasObservadas =
    enriquecerCampanhas({
      qualidadeCampanhasOficiais:
        recorrencia.qualidadeCampanhasOficiais,
      qualidadeAquisicao:
        recorrencia.qualidadeAquisicao,
      investimentos,
    });
  const medicao = criarDiagnosticoMedicao(
    recorrencia.qualidadeAquisicao
  );
  const campanhas =
    enriquecerCustosRecorrenciaMadura({
      campanhas: campanhasObservadas,
      linhasRecorrencia,
      investimentosDiarios,
      medicao,
      configuracao,
      agora,
    });

  return {
    ...recorrencia,
    qualidadeCampanhasOficiais: campanhas,
    diagnosticoCustoAquisicao: medicao,
    metodologia: {
      ...(recorrencia.metodologia || {}),
      custos:
        "o investimento e a coorte usam o mesmo período operacional em America/Sao_Paulo e são ligados somente por campanha_oficial_id. Os custos por profissional e por primeiro agendamento são observados, não CAC ou ROAS.",
      custosRecorrencia:
        `o custo de recorrência usa somente dias completos de gasto cuja aquisição já teve tempo para cumprir ${configuracao.diasMaturacaoAtivacao} dias de ativação mais a janela D7, D14 ou D30. O profissional precisa ter atribuição oficial no mesmo dia de gasto, primeiro agendamento dentro da janela de ativação e repetição dentro da janela analisada. Dias maduros sem gasto registrado, atribuição insuficiente e amostra abaixo da régua operacional permanecem explícitos e bloqueiam comparação forte.`,
    },
  };
}

module.exports = {
  buscarInvestimentos,
  buscarInvestimentosDiarios,
  criarDiagnosticoMedicao,
  criarCustosRecorrenciaMadura,
  custoPorResultado,
  dataLocalSaoPaulo,
  diaCompletamenteMaduro,
  enriquecerCampanhas,
  enriquecerCustosRecorrenciaMadura,
  enriquecerRecorrencia,
};
