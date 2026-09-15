import { describe, expect, it } from "vitest";
import {
  APPOINTMENT_STATUS,
  groupAppointments,
  normalizeAppointment,
} from "./appointments";

const BASE = {
  id: 1,
  data: "2026-09-15",
  horario: "10:00",
};

describe("status persistido dos agendamentos da cliente", () => {
  it("preserva confirmado e falta em vez de normalizar tudo para agendado", () => {
    expect(normalizeAppointment({
      ...BASE,
      status: "confirmado",
    })?.status).toBe(APPOINTMENT_STATUS.confirmed);

    expect(normalizeAppointment({
      ...BASE,
      id: 2,
      status: "falta",
    })?.status).toBe(APPOINTMENT_STATUS.missed);
  });

  it("separa falta de realizado e mantém confirmado entre os próximos", () => {
    const grupos = groupAppointments([
      { ...BASE, id: 1, status: "confirmado" },
      { ...BASE, id: 2, status: "realizado" },
      { ...BASE, id: 3, status: "falta" },
      { ...BASE, id: 4, status: "cancelado" },
    ]);

    expect(grupos.scheduled.map((item) => item.id)).toEqual([1]);
    expect(grupos.completed.map((item) => item.id)).toEqual([2]);
    expect(grupos.missed.map((item) => item.id)).toEqual([3]);
    expect(grupos.canceled.map((item) => item.id)).toEqual([4]);
  });
});
