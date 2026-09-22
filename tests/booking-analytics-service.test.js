jest.mock(
  "../src/repositories/bookingAnalyticsRepository",
  () => ({
    buscarContextoAgendamento:
      jest.fn(),
    registrarEvento:
      jest.fn(),
  })
);

const repository = require(
  "../src/repositories/bookingAnalyticsRepository"
);
const service = require(
  "../src/services/bookingAnalyticsService"
);

const CONTEXTO = Object.freeze({
  booking_id: 321,
  business_id: 11,
  professional_id: 22,
  client_id: 33,
  service_id: 44,
  status: "confirmado",
  service_name_snapshot:
    "Manicure Premium",
  price_snapshot: "79.90",
  duration_snapshot: 60,
  inicio_previsto_em:
    "2026-09-25T13:00:00.000Z",
  fuso_horario_snapshot:
    "America/Sao_Paulo",
  data: "2026-09-25",
  horario: "10:00",
  business_timezone:
    "America/Sao_Paulo",
});

describe("bookingAnalyticsService - P0", () => {
  const executor = {
    query: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();

    repository
      .buscarContextoAgendamento
      .mockResolvedValue({
        ...CONTEXTO,
      });

    repository
      .registrarEvento
      .mockImplementation(
        async (evento) => ({
          event_id:
            evento.eventId,
          nome:
            evento.nome,
          occurred_at:
            evento.occurredAt,
        })
      );
  });

  test("CA-ANA-01: booking_created possui IDs e snapshots mínimos", async () => {
    const evento =
      await service
        .registrarBookingCreated({
          agendamentoId: 321,
          executor,
        });

    expect(evento).toMatchObject({
      name:
        "booking_created",
      business_id: 11,
      professional_id: 22,
      client_id: 33,
      booking_id: 321,
      service_id: 44,
      service_name_snapshot:
        "Manicure Premium",
      price_snapshot: 79.9,
      duration_snapshot: 60,
      scheduled_start_at:
        "2026-09-25T13:00:00.000Z",
      business_timezone:
        "America/Sao_Paulo",
    });

    expect(evento.event_id).toMatch(
      /^[0-9a-f-]{36}$/i
    );
    expect(
      Number.isNaN(
        Date.parse(
          evento.occurred_at
        )
      )
    ).toBe(false);

    expect(
      repository.registrarEvento
    ).toHaveBeenCalledWith(
      expect.objectContaining({
        nome:
          "booking_created",
        businessId: 11,
        serviceId: 44,
        bookingId: 321,
        propriedades:
          expect.objectContaining({
            business_id: 11,
            professional_id: 22,
            client_id: 33,
            booking_id: 321,
            service_id: 44,
            service_name_snapshot:
              "Manicure Premium",
            price_snapshot:
              79.9,
            duration_snapshot:
              60,
          }),
      }),
      executor
    );
  });

  test("CA-ANA-02: booking_rescheduled preserva horários, profissionais e ator humano", async () => {
    const evento =
      await service
        .registrarBookingRescheduled({
          agendamentoId: 321,
          actorType:
            "OWNER",
          actorId: 7,
          previousProfessionalId:
            22,
          previousData:
            "2026-09-25",
          previousHorario:
            "10:00",
          newData:
            "2026-09-26",
          newHorario:
            "14:30",
          previousScheduledStartAt:
            "2026-09-25T13:00:00.000Z",
          newScheduledStartAt:
            "2026-09-26T17:30:00.000Z",
          executor,
        });

    expect(evento).toMatchObject({
      name:
        "booking_rescheduled",
      business_id: 11,
      professional_id: 22,
      client_id: 33,
      booking_id: 321,
      service_id: 44,
      previous_professional_id:
        22,
      previous_scheduled_start_at:
        "2026-09-25T13:00:00.000Z",
      scheduled_start_at:
        "2026-09-26T17:30:00.000Z",
      actor_type:
        "OWNER",
      actor_id:
        7,
    });
  });

  test.each([
    [
      "OWNER",
      7,
      "Profissional indisponível",
    ],
    [
      "PROFESSIONAL",
      22,
      "Atendimento interrompido",
    ],
  ])(
    "CA-ANA-03: booking_cancelled operacional registra %s, actor_id e motivo",
    async (
      actorType,
      actorId,
      motivo
    ) => {
      const evento =
        await service
          .registrarBookingCancelled({
            agendamentoId:
              321,
            actorType,
            actorId,
            cancellationReason:
              motivo,
            executor,
          });

      expect(evento).toMatchObject({
        name:
          "booking_cancelled",
        business_id: 11,
        professional_id: 22,
        client_id: 33,
        booking_id: 321,
        actor_type:
          actorType,
        actor_id:
          actorId,
        cancellation_reason:
          motivo,
      });
    }
  );

  test("CA-ANA-03: cancelamento de visitante identifica CLIENT sem inventar actor_id", async () => {
    const evento =
      await service
        .registrarBookingCancelled({
          agendamentoId: 321,
          actorType:
            "CLIENT",
          actorId:
            null,
          executor,
        });

    expect(evento).toMatchObject({
      name:
        "booking_cancelled",
      actor_type:
        "CLIENT",
      client_id:
        33,
    });
    expect(evento)
      .not.toHaveProperty(
        "actor_id"
      );
    expect(evento)
      .not.toHaveProperty(
        "cancellation_reason"
      );
  });

  test("CA-ANA-04: booking_completed usa PROFESSIONAL e user_id da responsável", async () => {
    const evento =
      await service
        .registrarBookingCompleted({
          agendamentoId:
            321,
          actorId:
            22,
          executor,
        });

    expect(evento).toMatchObject({
      name:
        "booking_completed",
      actor_type:
        "PROFESSIONAL",
      actor_id:
        22,
      professional_id:
        22,
    });
  });

  test.each([
    [
      "OWNER",
      7,
    ],
    [
      "PROFESSIONAL",
      22,
    ],
  ])(
    "CA-ANA-04: booking_no_show aceita %s com actor_id obrigatório",
    async (
      actorType,
      actorId
    ) => {
      const evento =
        await service
          .registrarBookingNoShow({
            agendamentoId:
              321,
            actorType,
            actorId,
            executor,
          });

      expect(evento).toMatchObject({
        name:
          "booking_no_show",
        actor_type:
          actorType,
        actor_id:
          actorId,
      });
    }
  );

  test("não registra motivo vazio em cancelamento operacional", async () => {
    await expect(
      service
        .registrarBookingCancelled({
          agendamentoId:
            321,
          actorType:
            "OWNER",
          actorId:
            7,
          cancellationReason:
            " ",
          executor,
        })
    ).rejects.toThrow(
      /exige motivo/i
    );

    expect(
      repository.registrarEvento
    ).not.toHaveBeenCalled();
  });
});
