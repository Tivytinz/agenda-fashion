import { describe, expect, test } from "vitest";
import {
  APPOINTMENT_STATUS,
  groupAppointments,
  normalizeAppointment
} from "./appointments";

describe("agenda da cliente", () => {
  test("normaliza o contrato da API preservando ids usados no reagendamento", () => {
    expect(normalizeAppointment({
      id: "12",
      negocio_id: "14",
      servico_id: "9",
      profissional_id: "3",
      data: "2026-07-31",
      horario: "09:30:00",
      status: "agendado",
      valor: "35.00"
    })).toMatchObject({
      id: 12,
      negocio_id: 14,
      servico_id: 9,
      profissional_id: 3,
      horario: "09:30",
      status: APPOINTMENT_STATUS.scheduled,
      valor: 35
    });
  });

  test("normaliza ids inválidos como ausentes sem inventar vínculo", () => {
    expect(normalizeAppointment({
      id: 12,
      negocio_id: 14,
      servico_id: null,
      profissional_id: undefined,
      data: "2026-07-31",
      horario: "09:30",
      status: "realizado"
    })).toMatchObject({
      servico_id: null,
      profissional_id: null
    });
  });

  test("separa agendados, realizados e cancelados preservando o serviço", () => {
    const groups = groupAppointments([
      { id: 1, servico_id: 8, data: "2026-08-02", horario: "10:00", status: "agendado" },
      { id: 2, servico_id: 9, data: "2026-07-20", horario: "10:00", status: "realizado" },
      { id: 3, servico_id: 10, data: "2026-07-21", horario: "10:00", status: "cancelado" }
    ]);

    expect(groups.scheduled).toHaveLength(1);
    expect(groups.completed).toHaveLength(1);
    expect(groups.canceled).toHaveLength(1);
    expect(groups.completed[0].servico_id).toBe(9);
  });

  test("ignora registros incompletos", () => {
    expect(groupAppointments([{ id: 1 }]).scheduled).toEqual([]);
  });
});
