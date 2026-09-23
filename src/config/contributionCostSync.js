const {
  flagAtiva
} = require(
  "../utils/featureFlags"
);

const PRIMEIRA_EXECUCAO_MS =
  90000;
const HORAS_PADRAO = 6;
const HORAS_MINIMAS = 1;
const HORAS_MAXIMAS = 24;

function intervaloHoras() {
  const valor = Number(
    process.env
      .CONTRIBUTION_COST_SYNC_INTERVAL_HOURS ||
    HORAS_PADRAO
  );

  if (!Number.isFinite(valor)) {
    return HORAS_PADRAO;
  }

  return Math.min(
    HORAS_MAXIMAS,
    Math.max(
      HORAS_MINIMAS,
      valor
    )
  );
}

function agendamentoAtivo() {
  return flagAtiva(
    process.env
      .CONTRIBUTION_COST_SYNC_SCHEDULE_ENABLED
  );
}

function statusAgendamento() {
  return {
    habilitado:
      agendamentoAtivo(),
    intervaloHoras:
      intervaloHoras(),
    primeiraExecucaoSegundos:
      Math.round(
        PRIMEIRA_EXECUCAO_MS /
          1000
      ),
  };
}

module.exports = {
  PRIMEIRA_EXECUCAO_MS,
  intervaloHoras,
  agendamentoAtivo,
  statusAgendamento,
};
