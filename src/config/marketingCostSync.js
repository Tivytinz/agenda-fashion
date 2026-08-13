const PRIMEIRA_EXECUCAO_MS = 60000;
const HORAS_PADRAO = 6;
const HORAS_MINIMAS = 1;
const HORAS_MAXIMAS = 24;
const LIMITE_MANUAL_DESATUALIZADO_HORAS = 24;

function flagAtiva(valor) {
  return ["1", "true", "yes", "on"].includes(
    String(valor || "").trim().toLowerCase()
  );
}

function intervaloHoras() {
  const valor = Number(
    process.env.MARKETING_COST_SYNC_INTERVAL_HOURS ||
      HORAS_PADRAO
  );

  if (!Number.isFinite(valor)) {
    return HORAS_PADRAO;
  }

  return Math.min(
    HORAS_MAXIMAS,
    Math.max(HORAS_MINIMAS, valor)
  );
}

function agendamentoAtivo() {
  return flagAtiva(
    process.env.MARKETING_COST_SYNC_SCHEDULE_ENABLED
  );
}

function limiteDesatualizadoHoras() {
  if (!agendamentoAtivo()) {
    return LIMITE_MANUAL_DESATUALIZADO_HORAS;
  }

  return Math.max(
    2,
    intervaloHoras() * 2
  );
}

function statusAgendamento() {
  return {
    habilitado: agendamentoAtivo(),
    intervaloHoras: intervaloHoras(),
    primeiraExecucaoSegundos:
      Math.round(PRIMEIRA_EXECUCAO_MS / 1000),
    limiteDesatualizadoHoras:
      limiteDesatualizadoHoras()
  };
}

module.exports = {
  PRIMEIRA_EXECUCAO_MS,
  flagAtiva,
  intervaloHoras,
  agendamentoAtivo,
  limiteDesatualizadoHoras,
  statusAgendamento
};
