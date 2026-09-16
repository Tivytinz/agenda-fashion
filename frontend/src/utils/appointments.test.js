// @vitest-environment jsdom

import { beforeEach, describe, expect, test } from "vitest";
import {
  APPOINTMENT_STATUS,
  groupAppointments,
  markRecentAppointmentCanceled,
  normalizeAppointment,
  readRecentAppointment,
  saveRecentAppointment
} from "./appointments";

const ACCESS = "a".repeat(43);

const visitorBooking = {
  slug: "studio-teste",
  business: { id: 8, nome: "Studio Teste" },
  service: { id: 4, nome: "Manicure", valor: 50 },
  professional: { id: 7, nome: "Ana" }
};

const visitorAppointment = {
  id: 101,
  data: "2026-09-20",
  horario: "10:00",
  status: "agendado",
  acesso_visitante: ACCESS
};

describe("agenda da cliente", () => {
  beforeEach(() => {
    sessionStorage.clear();
    localStorage.clear();
  });

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

  test("mantém a capability do visitante somente no storage de sessão", () => {
    saveRecentAppointment({
      booking: visitorBooking,
      appointment: visitorAppointment
    });

    expect(readRecentAppointment().acesso_visitante).toBe(ACCESS);
    expect(sessionStorage.getItem("af_recent_appointment")).toContain(ACCESS);
    expect(localStorage.getItem("af_recent_appointment")).toBeNull();
  });

  test("remove a capability depois do cancelamento", () => {
    saveRecentAppointment({
      booking: visitorBooking,
      appointment: visitorAppointment
    });

    markRecentAppointmentCanceled(101);

    const recent = readRecentAppointment();
    expect(recent.status).toBe(APPOINTMENT_STATUS.canceled);
    expect(recent.acesso_visitante).toBeNull();
  });

  test("descarta capability fora do formato esperado", () => {
    saveRecentAppointment({
      booking: visitorBooking,
      appointment: {
        ...visitorAppointment,
        acesso_visitante: "token-invalido"
      }
    });

    expect(readRecentAppointment().acesso_visitante).toBeNull();
  });
});