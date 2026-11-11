export const DAY_NAMES = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];

const DAY_SHORT_NAMES = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

export const DURATION_OPTIONS = [30, 45, 60, 90, 120];

export const INTERVAL_OPTIONS = [0, 5, 10, 15, 30];

export const LEAD_TIME_OPTIONS = [0, 1, 2, 4, 12, 24, 48, 72];

export function normalizeDay(day) {
  return {
    diaSemana: Number(day.dia_semana ?? day.diaSemana),
    trabalha: Boolean(day.trabalha),
    horaInicio: day.hora_inicio ?? day.horaInicio ?? "08:00",
    horaFim: day.hora_fim ?? day.horaFim ?? "18:00",
    intervaloInicio: day.intervalo_inicio ?? day.intervaloInicio ?? "",
    intervaloFim: day.intervalo_fim ?? day.intervaloFim ?? ""
  };
}

export function withCurrentOption(options, currentValue) {
  const value = Number(currentValue);
  return [...new Set([...options, value])]
    .filter((item) => Number.isFinite(item))
    .sort((a, b) => a - b);
}

export function formatLeadTime(value) {
  const hours = Number(value) || 0;
  if (hours === 0) return "Sem antecedência";
  if (hours === 1) return "1 hora";
  if (hours === 24) return "1 dia";
  if (hours > 24 && hours % 24 === 0) return `${hours / 24} dias`;
  return `${hours} horas`;
}

function scheduleSignature(day) {
  return [
    day.horaInicio || "",
    day.horaFim || "",
    day.intervaloInicio || "",
    day.intervaloFim || ""
  ].join("|");
}

export function serializeSchedule(config, days) {
  return JSON.stringify({
    duracaoPadrao: config?.duracaoPadrao,
    intervaloMinutos: config?.intervaloMinutos,
    antecedenciaAgendamento: config?.antecedenciaAgendamento,
    antecedenciaCancelamento: config?.antecedenciaCancelamento,
    days
  });
}

export function summarizeSchedule(days) {
  const groups = new Map();

  for (const day of days.filter((item) => item.trabalha)) {
    const signature = scheduleSignature(day);
    const current = groups.get(signature) || [];
    current.push(day);
    groups.set(signature, current);
  }

  return Array.from(groups.values()).map((group) => {
    const sample = group[0];
    const pause = sample.intervaloInicio && sample.intervaloFim
      ? `${sample.intervaloInicio}–${sample.intervaloFim}`
      : null;

    return {
      key: scheduleSignature(sample),
      days: group.map((day) => DAY_SHORT_NAMES[day.diaSemana]).join(", "),
      attendance: `${sample.horaInicio}–${sample.horaFim}`,
      pause
    };
  });
}

export function validateSchedule(days, { requireActiveDay = false } = {}) {
  if (requireActiveDay && !days.some((day) => day.trabalha)) {
    return "Escolha pelo menos um dia de atendimento antes de confirmar a agenda.";
  }

  for (const day of days) {
    if (!day.trabalha) continue;

    const dayName = DAY_NAMES[day.diaSemana] || "Dia selecionado";
    if (!day.horaInicio || !day.horaFim || day.horaInicio >= day.horaFim) {
      return `Em ${dayName}, o horário final precisa ser depois do horário inicial.`;
    }

    const hasPauseStart = Boolean(day.intervaloInicio);
    const hasPauseEnd = Boolean(day.intervaloFim);
    if (hasPauseStart !== hasPauseEnd) {
      return `Em ${dayName}, preencha o início e o fim da pausa.`;
    }

    if (hasPauseStart && (
      day.intervaloInicio >= day.intervaloFim
      || day.intervaloInicio <= day.horaInicio
      || day.intervaloFim >= day.horaFim
    )) {
      return `Em ${dayName}, a pausa precisa estar dentro do horário de atendimento.`;
    }
  }

  return "";
}
