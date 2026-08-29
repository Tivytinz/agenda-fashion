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

function mapearResumo(linha = {}) {
  const profissionaisCohorte =
    numero(linha.profissionais_coorte);
  const negociosCriados =
    numero(linha.negocios_criados);
  const primeiro =
    numero(linha.com_primeiro_agendamento);
  const segundo =
    numero(linha.com_segundo_agendamento);
  const terceiro =
    numero(linha.com_terceiro_agendamento);

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
    await repository.buscarResumo(
      periodo
    );

  return {
    periodo: resultado.periodo,
    resumo:
      mapearResumo(
        resultado.resumo
      ),
    metodologia: {
      unidade: "profissional",
      criterio:
        "quantidade de agendamentos criados no primeiro negócio em que o profissional aparece como dono",
      observacao:
        "Esta leitura mede recorrência observada e não representa retenção D30, atendimento realizado ou receita.",
    },
  };
}

module.exports = {
  buscarRecorrencia,
  mapearResumo,
  percentual,
};
