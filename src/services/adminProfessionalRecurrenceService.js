const repository = require(
  "../repositories/adminProfessionalRecurrenceRepository"
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
  if (!total) return 0;

  return Number(
    ((parte / total) * 100)
      .toFixed(2)
  );
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

async function buscarRecorrencia({
  periodo,
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
    metodologia: {
      unidade: "profissional",
      criterio:
        "quantidade de agendamentos não cancelados criados no primeiro negócio em que o profissional aparece como dono",
      observacao:
        "Esta leitura mede recorrência observada e não representa retenção D30, atendimento realizado ou receita.",
    },
  };
}

module.exports = {
  buscarRecorrencia,
  criarResumo,
  percentual,
};
