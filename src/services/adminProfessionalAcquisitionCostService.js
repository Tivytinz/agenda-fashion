const repository = require(
  "../repositories/adminProfessionalAcquisitionCostRepository"
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

async function buscarInvestimentos(
  periodo
) {
  const resultado =
    await repository.listarInvestimentos(
      periodo
    );

  return resultado.linhas;
}

function enriquecerRecorrencia({
  recorrencia = {},
  investimentos = [],
} = {}) {
  const campanhas = enriquecerCampanhas({
    qualidadeCampanhasOficiais:
      recorrencia.qualidadeCampanhasOficiais,
    qualidadeAquisicao:
      recorrencia.qualidadeAquisicao,
    investimentos,
  });
  const medicao = criarDiagnosticoMedicao(
    recorrencia.qualidadeAquisicao
  );

  return {
    ...recorrencia,
    qualidadeCampanhasOficiais: campanhas,
    diagnosticoCustoAquisicao: medicao,
    metodologia: {
      ...(recorrencia.metodologia || {}),
      custos:
        "o investimento e a coorte usam o mesmo período operacional em America/Sao_Paulo e são ligados somente por campanha_oficial_id. Os custos exibidos são valores observados por profissional oficialmente atribuído e por profissional que chegou ao primeiro agendamento; não são CAC ou ROAS. Não é calculado custo por recorrente D7, D14 ou D30 porque o gasto do período inclui aquisições que podem ainda não ter maturidade suficiente para essas janelas.",
    },
  };
}

module.exports = {
  buscarInvestimentos,
  criarDiagnosticoMedicao,
  custoPorResultado,
  enriquecerCampanhas,
  enriquecerRecorrencia,
};
