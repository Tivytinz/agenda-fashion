const {
  flagAtiva
} = require(
  "../utils/featureFlags"
);

const PRIMEIRA_EXECUCAO_MS =
  90000;
const MINUTOS_PADRAO = 15;
const MINUTOS_MINIMOS = 5;
const MINUTOS_MAXIMOS = 60;

function intervaloMinutos() {
  const valor = Number(
    process.env
      .CONTRIBUTION_COST_SYNC_POLL_INTERVAL_MINUTES ||
    MINUTOS_PADRAO
  );

  if (!Number.isFinite(valor)) {
    return MINUTOS_PADRAO;
  }

  return Math.min(
    MINUTOS_MAXIMOS,
    Math.max(
      MINUTOS_MINIMOS,
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
    intervaloMinutos:
      intervaloMinutos(),
    primeiraExecucaoSegundos:
      Math.round(
        PRIMEIRA_EXECUCAO_MS /
          1000
      ),
  };
}

module.exports = {
  PRIMEIRA_EXECUCAO_MS,
  intervaloMinutos,
  agendamentoAtivo,
  statusAgendamento,
};
