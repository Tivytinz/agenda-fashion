const { randomUUID } = require("node:crypto");

const bookingAnalyticsRepository = require(
  "../repositories/bookingAnalyticsRepository"
);

const EVENTOS = Object.freeze({
  CRIADO: "booking_created",
  REAGENDADO: "booking_rescheduled",
  CANCELADO: "booking_cancelled",
  CONCLUIDO: "booking_completed",
  FALTA: "booking_no_show",
});

function normalizarId(valor) {
  const id = Number(valor);
  return Number.isSafeInteger(id) && id > 0
    ? id
    : null;
}

function normalizarActorType(valor) {
  const actorType = String(valor || "")
    .trim()
    .toUpperCase();

  return [
    "OWNER",
    "PROFESSIONAL",
    "CLIENT",
    "ADMIN",
    "SYSTEM",
  ].includes(actorType)
    ? actorType
    : null;
}

function normalizarHorario(valor) {
  const match = /^(\d{1,2}):(\d{2})/.exec(
    String(valor || "").trim()
  );

  if (!match) return null;

  return [
    String(Number(match[1])).padStart(2, "0"),
    String(Number(match[2])).padStart(2, "0"),
  ].join(":");
}

function scheduledStartAt(data, horario) {
  const dataNormalizada = String(data || "").trim();
  const horarioNormalizado = normalizarHorario(horario);

  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(dataNormalizada) ||
    !horarioNormalizado
  ) {
    return null;
  }

  return `${dataNormalizada}T${horarioNormalizado}:00`;
}

function propriedadesBase(contexto) {
  return {
    business_id:
      normalizarId(contexto.business_id),
    professional_id:
      normalizarId(contexto.professional_id),
    client_id:
      normalizarId(contexto.client_id),
    booking_id:
      normalizarId(contexto.booking_id),
    service_id:
      normalizarId(contexto.service_id),
  };
}

async function persistir({
  nome,
  agendamentoId,
  actorType = null,
  actorId = null,
  actorBusinessId = null,
  propriedades = {},
  executor,
}) {
  const bookingId = normalizarId(agendamentoId);

  if (!bookingId) {
    throw new TypeError(
      "Agendamento inválido para evento de analytics."
    );
  }

  const contexto =
    await bookingAnalyticsRepository
      .buscarContextoAgendamento(
        bookingId,
        executor
      );

  if (!contexto) {
    throw new Error(
      "Agendamento não encontrado para evento de analytics."
    );
  }

  const actorTypeNormalizado =
    normalizarActorType(actorType);
  const actorIdNormalizado =
    normalizarId(actorId);

  const payload = {
    ...propriedadesBase(contexto),
    ...(actorTypeNormalizado
      ? { actor_type: actorTypeNormalizado }
      : {}),
    ...(actorIdNormalizado
      ? { actor_id: actorIdNormalizado }
      : {}),
    ...propriedades,
  };

  const eventId = randomUUID();
  const occurredAt = new Date().toISOString();

  const salvo =
    await bookingAnalyticsRepository
      .registrarEvento(
        {
          eventId,
          nome,
          occurredAt,
          actorUserId:
            actorIdNormalizado,
          actorBusinessId:
            normalizarId(actorBusinessId),
          businessId:
            normalizarId(contexto.business_id),
          serviceId:
            normalizarId(contexto.service_id),
          bookingId,
          propriedades:
            payload,
        },
        executor
      );

  if (!salvo) {
    throw new Error(
      `Não foi possível registrar o evento ${nome}.`
    );
  }

  return {
    event_id:
      salvo.event_id || eventId,
    occurred_at:
      salvo.occurred_at || occurredAt,
    name:
      salvo.nome || nome,
    ...payload,
  };
}

async function registrarBookingCreated({
  agendamentoId,
  executor,
}) {
  const bookingId = normalizarId(agendamentoId);
  const contexto =
    await bookingAnalyticsRepository
      .buscarContextoAgendamento(
        bookingId,
        executor
      );

  if (!contexto) {
    throw new Error(
      "Agendamento não encontrado para evento booking_created."
    );
  }

  if (
    String(contexto.status || "").toLowerCase() !==
    "confirmado"
  ) {
    throw new Error(
      "booking_created só pode ser emitido para reserva confirmada."
    );
  }

  return persistir({
    nome: EVENTOS.CRIADO,
    agendamentoId: bookingId,
    executor,
    propriedades: {
      service_name_snapshot:
        String(
          contexto.service_name_snapshot ||
          ""
        ).trim(),
      price_snapshot:
        Number(contexto.price_snapshot),
      duration_snapshot:
        Number(contexto.duration_snapshot),
    },
  });
}

async function registrarBookingRescheduled({
  agendamentoId,
  actorType,
  actorId,
  previousProfessionalId,
  previousData,
  previousHorario,
  newData,
  newHorario,
  executor,
}) {
  const previousStart =
    scheduledStartAt(
      previousData,
      previousHorario
    );
  const newStart =
    scheduledStartAt(
      newData,
      newHorario
    );

  if (!previousStart || !newStart) {
    throw new TypeError(
      "Horários de reagendamento inválidos para analytics."
    );
  }

  return persistir({
    nome: EVENTOS.REAGENDADO,
    agendamentoId,
    actorType,
    actorId,
    actorBusinessId: null,
    executor,
    propriedades: {
      previous_professional_id:
        normalizarId(previousProfessionalId),
      previous_scheduled_start_at:
        previousStart,
      scheduled_start_at:
        newStart,
    },
  });
}

async function registrarBookingCancelled({
  agendamentoId,
  actorType,
  actorId = null,
  cancellationReason = null,
  actorBusinessId = null,
  executor,
}) {
  const tipo =
    normalizarActorType(actorType);

  const motivo =
    cancellationReason === null ||
    cancellationReason === undefined
      ? null
      : String(cancellationReason)
          .trim()
          .slice(0, 300);

  if (
    ["OWNER", "PROFESSIONAL"].includes(tipo) &&
    !motivo
  ) {
    throw new TypeError(
      "Cancelamento operacional exige motivo no evento de analytics."
    );
  }

  return persistir({
    nome: EVENTOS.CANCELADO,
    agendamentoId,
    actorType: tipo,
    actorId,
    actorBusinessId,
    executor,
    propriedades: {
      ...(motivo
        ? {
            cancellation_reason:
              motivo,
          }
        : {}),
    },
  });
}

async function registrarBookingCompleted({
  agendamentoId,
  actorId,
  executor,
}) {
  const id = normalizarId(actorId);

  if (!id) {
    throw new TypeError(
      "Conclusão exige actor_id da profissional responsável."
    );
  }

  return persistir({
    nome: EVENTOS.CONCLUIDO,
    agendamentoId,
    actorType:
      "PROFESSIONAL",
    actorId: id,
    executor,
  });
}

async function registrarBookingNoShow({
  agendamentoId,
  actorType,
  actorId,
  executor,
}) {
  const tipo =
    normalizarActorType(actorType);
  const id =
    normalizarId(actorId);

  if (
    !["OWNER", "PROFESSIONAL"].includes(tipo) ||
    !id
  ) {
    throw new TypeError(
      "No-show exige ator OWNER ou PROFESSIONAL identificado."
    );
  }

  return persistir({
    nome: EVENTOS.FALTA,
    agendamentoId,
    actorType: tipo,
    actorId: id,
    executor,
  });
}

module.exports = {
  EVENTOS,
  registrarBookingCreated,
  registrarBookingRescheduled,
  registrarBookingCancelled,
  registrarBookingCompleted,
  registrarBookingNoShow,
  scheduledStartAt,
};
