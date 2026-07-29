import { describe, expect, test } from "vitest";
import {
  getAgendaEntityName,
  getValidAgendaDays,
  getValidProfessionals,
  getValidSlots
} from "./agenda";

describe("agenda do espaço de trabalho", () => {
  test("trata cliente e serviço nulos sem acessar nome", () => {
    expect(getAgendaEntityName(null)).toBe("");
    expect(getAgendaEntityName(undefined)).toBe("");
    expect(getAgendaEntityName({ nome: " Corte " })).toBe("Corte");
    expect(getAgendaEntityName(" Maria ")).toBe("Maria");
  });

  test("remove registros nulos das listas retornadas pela API", () => {
    expect(getValidAgendaDays([null, { data: "2026-07-30" }, {}]))
      .toEqual([{ data: "2026-07-30" }]);
    expect(getValidProfessionals([null, { id: 1, nome: "Ana" }, { nome: "Sem id" }]))
      .toEqual([{ id: 1, nome: "Ana" }]);
    expect(getValidSlots([null, { hora: "09:00", cliente: null }, {}]))
      .toEqual([{ hora: "09:00", cliente: null }]);
  });
});
