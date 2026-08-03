// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { apiRequest } from "../api/client";
import { ScheduleSettingsPage, validateSchedule } from "./ScheduleSettingsPage";

vi.mock("../api/client", () => ({ apiRequest: vi.fn() }));

beforeEach(() => {
  apiRequest.mockReset();
  apiRequest.mockResolvedValue({
    configuracao: {},
    horarios: [{
      dia_semana: 1,
      trabalha: true,
      hora_inicio: "18:00",
      hora_fim: "08:00"
    }]
  });
});

afterEach(cleanup);

describe("configuração de horários", () => {
  it("valida pausas incompletas", () => {
    expect(validateSchedule([{
      diaSemana: 1,
      trabalha: true,
      horaInicio: "08:00",
      horaFim: "18:00",
      intervaloInicio: "12:00",
      intervaloFim: ""
    }])).toContain("preencha o início e o fim da pausa");
  });

  it("não envia um período cujo fim antecede o início", async () => {
    render(<ScheduleSettingsPage />);
    const save = await screen.findByRole("button", { name: "Salvar horários" });
    fireEvent.click(save);

    expect(screen.getByRole("alert").textContent).toContain("horário final precisa ser depois");
    expect(apiRequest).toHaveBeenCalledTimes(1);
  });
});
