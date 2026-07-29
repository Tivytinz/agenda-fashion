const RECENT_APPOINTMENT_KEY = "af_recent_appointment";

export const APPOINTMENT_STATUS = {
  scheduled: "agendado",
  completed: "realizado",
  canceled: "cancelado"
};

export function normalizeAppointment(item, source = "account") {
  if (!item?.id || !item?.data || !item?.horario) {
    return null;
  }

  const status = Object.values(APPOINTMENT_STATUS).includes(item.status)
    ? item.status
    : APPOINTMENT_STATUS.scheduled;

  return {
    id: Number(item.id),
    data: String(item.data),
    horario: String(item.horario).slice(0, 5),
    status,
    avaliacao: item.avaliacao ?? null,
    negocio_id: Number(item.negocio_id) || null,
    negocio: item.negocio || "Negócio",
    slug: item.slug || "",
    profissional: item.profissional || "Profissional",
    servico: item.servico || "Serviço",
    valor: Number(item.valor) || 0,
    source
  };
}

export function saveRecentAppointment({ booking, appointment }) {
  if (!booking || !appointment) {
    return;
  }

  const recent = normalizeAppointment({
    ...appointment,
    negocio_id: booking.business?.id,
    negocio: booking.business?.nome,
    slug: booking.slug,
    profissional: booking.professional?.nome,
    servico: booking.service?.nome,
    valor: booking.service?.valor
  }, "visitor");

  if (recent) {
    sessionStorage.setItem(RECENT_APPOINTMENT_KEY, JSON.stringify(recent));
  }
}

export function readRecentAppointment() {
  try {
    return normalizeAppointment(
      JSON.parse(sessionStorage.getItem(RECENT_APPOINTMENT_KEY) || "null"),
      "visitor"
    );
  } catch {
    return null;
  }
}

export function groupAppointments(items) {
  const groups = {
    scheduled: [],
    completed: [],
    canceled: []
  };

  (Array.isArray(items) ? items : [])
    .map((item) => normalizeAppointment(item, item?.source))
    .filter(Boolean)
    .forEach((item) => {
      if (item.status === APPOINTMENT_STATUS.canceled) {
        groups.canceled.push(item);
      } else if (item.status === APPOINTMENT_STATUS.completed) {
        groups.completed.push(item);
      } else {
        groups.scheduled.push(item);
      }
    });

  groups.scheduled.sort((a, b) =>
    `${a.data} ${a.horario}`.localeCompare(`${b.data} ${b.horario}`)
  );
  groups.completed.sort((a, b) =>
    `${b.data} ${b.horario}`.localeCompare(`${a.data} ${a.horario}`)
  );
  groups.canceled.sort((a, b) =>
    `${b.data} ${b.horario}`.localeCompare(`${a.data} ${a.horario}`)
  );

  return groups;
}
