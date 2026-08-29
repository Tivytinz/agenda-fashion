const repository = require(
  "../repositories/adminProfessionalRecurrenceRepository"
);

const DIA_MS = 24 * 60 * 60 * 1000;

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

function diasEntre(
  inicio,
  fim
) {
  if (!inicio || !fim) {
    return null;
  }

  const inicioMs = new Date(inicio).getTime();
  const fimMs = new Date(fim).getTime();

  if (
    !Number.isFinite(inicioMs) ||
    !Number.isFinite(fimMs) ||
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

async function buscarRecorrencia({
  periodo,
  agora = new Date(),
} = {}) {
  const resultado =
    await repository.listarRecorrencia(
      periodo
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
    metodologia: {
      unidade: "profissional",
      criterio:
        "quantidade de agendamentos não cancelados criados no primeiro negócio em que o profissional aparece como dono",
      tempo:
        "os intervalos usam created_at, isto é, o momento em que cada agendamento entrou no AF, e não a data futura marcada para o atendimento",
      observacao:
        "Esta leitura mede recorrência observada e maturidade da amostra. Não representa retenção D30, atendimento realizado ou receita.",
    },
  };
}

module.exports = {
  buscarRecorrencia,
  criarResumo,
  criarAnaliseTemporal,
  criarEstatistica,
  diasEntre,
  percentual,
};
