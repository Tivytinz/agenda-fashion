const repository = require(
  "../repositories/adminProfessionalRecurrenceRepository"
);
const {
  criarDiagnosticoEstabilidade,
} = require(
  "./adminProfessionalRecurrenceStabilityService"
);
const {
  agruparPorOrigemAquisicao,
} = require(
  "./adminProfessionalRecurrenceAcquisitionService"
);

const DIA_MS = 24 * 60 * 60 * 1000;
const JANELAS_CANDIDATAS_DIAS = [7, 14, 30];

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
  if (!total) return 0;

  return Number(
    ((parte / total) * 100)
      .toFixed(2)
  );
}

function arredondar(valor) {
  if (!Number.isFinite(valor)) {
    return null;
  }

  return Number(valor.toFixed(2));
}

function timestamp(valor) {
  if (!valor) {
    return null;
  }

  const convertido = new Date(valor).getTime();
  return Number.isFinite(convertido)
    ? convertido
    : null;
}

function diasEntre(
  inicio,
  fim
) {
  const inicioMs = timestamp(inicio);
  const fimMs = timestamp(fim);

  if (
    inicioMs === null ||
    fimMs === null ||
    fimMs < inicioMs
  ) {
    return null;
  }

  return arredondar(
    (fimMs - inicioMs) / DIA_MS
  );
}

function percentil(
  valores,
  proporcao
) {
  if (!valores.length) {
    return null;
  }

  const ordenados = [
    ...valores,
  ].sort((a, b) => a - b);
  const indice =
    (ordenados.length - 1) * proporcao;
  const inferior = Math.floor(indice);
  const superior = Math.ceil(indice);

  if (inferior === superior) {
    return arredondar(
      ordenados[inferior]
    );
  }

  const pesoSuperior =
    indice - inferior;
  const interpolado =
    ordenados[inferior] *
      (1 - pesoSuperior) +
    ordenados[superior] *
      pesoSuperior;

  return arredondar(interpolado);
}

function criarEstatistica(
  valores
) {
  const validos = valores.filter(
    (valor) => Number.isFinite(valor)
  );

  if (!validos.length) {
    return {
      amostra: 0,
      medianaDias: null,
      p75Dias: null,
      minimoDias: null,
      maximoDias: null,
    };
  }

  return {
    amostra: validos.length,
    medianaDias:
      percentil(validos, 0.5),
    p75Dias:
      percentil(validos, 0.75),
    minimoDias: arredondar(
      Math.min(...validos)
    ),
    maximoDias: arredondar(
      Math.max(...validos)
    ),
  };
}

function criarResumo(linhas = []) {
  const profissionaisCohorte =
    linhas.length;
  const negociosCriados =
    linhas.filter(
      (linha) => linha.negocio_id
    ).length;
  const primeiro =
    linhas.filter(
      (linha) =>
        numero(linha.total_agendamentos) >= 1
    ).length;
  const segundo =
    linhas.filter(
      (linha) =>
        numero(linha.total_agendamentos) >= 2
    ).length;
  const terceiro =
    linhas.filter(
      (linha) =>
        numero(linha.total_agendamentos) >= 3
    ).length;

  return {
    profissionaisCohorte,
    negociosCriados,
    comPrimeiroAgendamento: primeiro,
    comSegundoAgendamento: segundo,
    comTerceiroAgendamento: terceiro,
    taxaPrimeiroSobreNegocio:
      percentual(
        primeiro,
        negociosCriados
      ),
    taxaSegundoSobrePrimeiro:
      percentual(
        segundo,
        primeiro
      ),
    taxaTerceiroSobreSegundo:
      percentual(
        terceiro,
        segundo
      ),
    taxaTerceiroSobrePrimeiro:
      percentual(
        terceiro,
        primeiro
      ),
  };
}

function criarAnaliseTemporal(
  linhas = [],
  agora = new Date()
) {
  const primeiroParaSegundo = [];
  const segundoParaTerceiro = [];
  const idadeDesdePrimeiro = [];

  for (const linha of linhas) {
    const primeiro =
      linha.primeiro_agendamento_em;
    const segundo =
      linha.segundo_agendamento_em;
    const terceiro =
      linha.terceiro_agendamento_em;

    const diasPrimeiroSegundo =
      diasEntre(primeiro, segundo);
    const diasSegundoTerceiro =
      diasEntre(segundo, terceiro);
    const diasMaturidade =
      diasEntre(primeiro, agora);

    if (diasPrimeiroSegundo !== null) {
      primeiroParaSegundo.push(
        diasPrimeiroSegundo
      );
    }

    if (diasSegundoTerceiro !== null) {
      segundoParaTerceiro.push(
        diasSegundoTerceiro
      );
    }

    if (diasMaturidade !== null) {
      idadeDesdePrimeiro.push(
        diasMaturidade
      );
    }
  }

  return {
    primeiroParaSegundo:
      criarEstatistica(
        primeiroParaSegundo
      ),
    segundoParaTerceiro:
      criarEstatistica(
        segundoParaTerceiro
      ),
    maturidadeDesdePrimeiro:
      criarEstatistica(
        idadeDesdePrimeiro
      ),
  };
}

function ocorreuDentroDaJanela(
  inicio,
  fim,
  janelaDias
) {
  const inicioMs = timestamp(inicio);
  const fimMs = timestamp(fim);

  if (
    inicioMs === null ||
    fimMs === null ||
    fimMs < inicioMs
  ) {
    return false;
  }

  return (
    fimMs - inicioMs <=
    janelaDias * DIA_MS
  );
}

function estaMaduroParaJanela(
  primeiro,
  agora,
  janelaDias
) {
  const primeiroMs = timestamp(primeiro);
  const agoraMs = timestamp(agora);

  if (
    primeiroMs === null ||
    agoraMs === null ||
    agoraMs < primeiroMs
  ) {
    return false;
  }

  return (
    agoraMs - primeiroMs >=
    janelaDias * DIA_MS
  );
}

function criarJanelasCandidatas(
  linhas = [],
  agora = new Date(),
  janelas = JANELAS_CANDIDATAS_DIAS
) {
  return janelas.map((janelaDias) => {
    let elegiveis = 0;
    let segundoNaJanela = 0;
    let terceiroNaJanela = 0;

    for (const linha of linhas) {
      const primeiro =
        linha.primeiro_agendamento_em;

      if (
        !estaMaduroParaJanela(
          primeiro,
          agora,
          janelaDias
        )
      ) {
        continue;
      }

      elegiveis += 1;

      if (
        ocorreuDentroDaJanela(
          primeiro,
          linha.segundo_agendamento_em,
          janelaDias
        )
      ) {
        segundoNaJanela += 1;
      }

      if (
        ocorreuDentroDaJanela(
          primeiro,
          linha.terceiro_agendamento_em,
          janelaDias
        )
      ) {
        terceiroNaJanela += 1;
      }
    }

    return {
      janelaDias,
      elegiveis,
      comSegundoNaJanela: segundoNaJanela,
      taxaSegundoNaJanela:
        percentual(
          segundoNaJanela,
          elegiveis
        ),
      comTerceiroNaJanela: terceiroNaJanela,
      taxaTerceiroNaJanela:
        percentual(
          terceiroNaJanela,
          elegiveis
        ),
    };
  });
}

function criarCoortesSemanais(
  linhas = [],
  agora = new Date(),
  janelas = JANELAS_CANDIDATAS_DIAS
) {
  const grupos = new Map();

  for (const linha of linhas) {
    const semanaCadastro = String(
      linha.semana_cadastro || ""
    );

    if (
      !/^\d{4}-\d{2}-\d{2}$/.test(
        semanaCadastro
      )
    ) {
      continue;
    }

    if (!grupos.has(semanaCadastro)) {
      grupos.set(semanaCadastro, []);
    }

    grupos.get(semanaCadastro).push(linha);
  }

  return [...grupos.entries()]
    .sort(([semanaA], [semanaB]) =>
      semanaB.localeCompare(semanaA)
    )
    .map(([semanaCadastro, grupo]) => {
      const resumo = criarResumo(grupo);

      return {
        semanaCadastro,
        profissionais: grupo.length,
        comPrimeiroAgendamento:
          resumo.comPrimeiroAgendamento,
        taxaPrimeiroSobreProfissionais:
          percentual(
            resumo.comPrimeiroAgendamento,
            grupo.length
          ),
        janelasCandidatas:
          criarJanelasCandidatas(
            grupo,
            agora,
            janelas
          ),
      };
    });
}

function criarQualidadeAquisicaoPorOrigem(
  linhas = [],
  agora = new Date(),
  janelas = JANELAS_CANDIDATAS_DIAS
) {
  return agruparPorOrigemAquisicao(
    linhas
  ).map((grupo) => {
    const resumo =
      criarResumo(grupo.linhas);

    return {
      chave: grupo.chave,
      classificacaoAtribuicao:
        grupo.classificacaoAtribuicao,
      origem: grupo.origem,
      profissionais: grupo.linhas.length,
      comPrimeiroAgendamento:
        resumo.comPrimeiroAgendamento,
      taxaPrimeiroSobreProfissionais:
        percentual(
          resumo.comPrimeiroAgendamento,
          grupo.linhas.length
        ),
      comSegundoAgendamento:
        resumo.comSegundoAgendamento,
      taxaSegundoSobrePrimeiro:
        resumo.taxaSegundoSobrePrimeiro,
      comTerceiroAgendamento:
        resumo.comTerceiroAgendamento,
      taxaTerceiroSobrePrimeiro:
        resumo.taxaTerceiroSobrePrimeiro,
      janelasCandidatas:
        criarJanelasCandidatas(
          grupo.linhas,
          agora,
          janelas
        ),
    };
  });
}

async function buscarRecorrencia({
  periodo,
  agora = new Date(),
} = {}) {
  const resultado =
    await repository.listarRecorrencia(
      periodo
    );
  const coortesSemanais =
    criarCoortesSemanais(
      resultado.linhas,
      agora
    );

  return {
    periodo: resultado.periodo,
    resumo:
      criarResumo(
        resultado.linhas
      ),
    tempos:
      criarAnaliseTemporal(
        resultado.linhas,
        agora
      ),
    janelasCandidatas:
      criarJanelasCandidatas(
        resultado.linhas,
        agora
      ),
    coortesSemanais,
    estabilidadeCoortes:
      criarDiagnosticoEstabilidade(
        coortesSemanais
      ),
    qualidadeAquisicao:
      criarQualidadeAquisicaoPorOrigem(
        resultado.linhas,
        agora
      ),
    metodologia: {
      unidade: "profissional",
      criterio:
        "quantidade de agendamentos não cancelados criados no primeiro negócio em que o profissional aparece como dono",
      tempo:
        "os intervalos usam created_at, isto é, o momento em que cada agendamento entrou no AF, e não a data futura marcada para o atendimento",
      janelas:
        "D7, D14 e D30 são janelas candidatas de recorrência. Cada denominador inclui somente profissionais cujo primeiro agendamento já tem pelo menos a idade da janela analisada.",
      coortes:
        "as coortes semanais usam a semana de cadastro do usuário em America/Sao_Paulo e reaplicam as mesmas janelas maduras dentro de cada grupo",
      estabilidade:
        "a comparação entre coortes é descritiva: mostra faixa, amplitude e variação da coorte madura mais recente contra a anterior, sem inferir tendência estatística nem impor um tamanho mínimo de amostra inexistente no produto",
      aquisicao:
        "a qualidade por origem reutiliza a classificação oficial de atribuição do backend e separa origem oficial, orgânica, rastreamento incompleto, identidade não oficial e ausência de evidência; a recorrência por origem não altera CAC, ROAS nem decisões de orçamento por si só",
      observacao:
        "Esta leitura mede recorrência observada e maturidade da amostra. As janelas candidatas ainda não são uma definição oficial de retenção, não confirmam atendimento realizado e não representam receita.",
    },
  };
}

module.exports = {
  buscarRecorrencia,
  criarResumo,
  criarAnaliseTemporal,
  criarEstatistica,
  criarJanelasCandidatas,
  criarCoortesSemanais,
  criarQualidadeAquisicaoPorOrigem,
  diasEntre,
  estaMaduroParaJanela,
  ocorreuDentroDaJanela,
  percentual,
};
