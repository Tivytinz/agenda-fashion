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

  it("explica intervalo e antecedências com unidades humanas", async () => {
    apiRequest.mockResolvedValueOnce({
      configuracao: {
        duracao_padrao: 60,
        intervalo_minutos: 0,
        antecedencia_agendamento: 0,
        antecedencia_cancelamento: 24
      },
      horarios: [{
        dia_semana: 1,
        trabalha: true,
        hora_inicio: "08:00",
        hora_fim: "18:00",
        intervalo_inicio: null,
        intervalo_fim: null
      }]
    });

    render(<ScheduleSettingsPage />);

    const interval = await screen.findByRole("combobox", { name: "Intervalo entre clientes" });
    const bookingLead = screen.getByRole("combobox", { name: "Antecedência para agendar" });
    const cancellationLead = screen.getByRole("combobox", { name: "Antecedência para cancelar" });

    expect(interval.selectedOptions[0].textContent).toBe("Sem intervalo");
    expect(bookingLead.selectedOptions[0].textContent).toBe("Sem antecedência");
    expect(cancellationLead.selectedOptions[0].textContent).toBe("1 dia");
  });

  it("mostra a pausa apenas quando a profissional decide configurá-la", async () => {
    apiRequest.mockResolvedValueOnce({
      configuracao: {},
      horarios: [{
        dia_semana: 1,
        trabalha: true,
        hora_inicio: "08:00",
        hora_fim: "18:00",
        intervalo_inicio: null,
        intervalo_fim: null
      }]
    });

    render(<ScheduleSettingsPage />);

    const pauseMode = await screen.findByRole("combobox", { name: "Pausa de Segunda" });
    expect(screen.queryByLabelText("Início da pausa de Segunda")).toBeNull();

    fireEvent.change(pauseMode, { target: { value: "custom" } });

    expect(screen.getByLabelText("Início da pausa de Segunda")).not.toBeNull();
    expect(screen.getByLabelText("Fim da pausa de Segunda")).not.toBeNull();
  });

  it("organiza a semana em colunas sem repetir os títulos no desktop", async () => {
    apiRequest.mockResolvedValueOnce({
      configuracao: {},
      horarios: [{
        dia_semana: 1,
        trabalha: true,
        hora_inicio: "08:00",
        hora_fim: "18:00",
        intervalo_inicio: null,
        intervalo_fim: null
      }]
    });

    render(<ScheduleSettingsPage />);

    await screen.findByText("Segunda");
    expect(screen.getByText("Dia")).not.toBeNull();
    expect(screen.getAllByText("Atendimento")).toHaveLength(2);
    expect(screen.getAllByText("Pausa")).toHaveLength(2);
  });

  it("copia um horário configurado para os demais dias ativos", async () => {
    apiRequest.mockResolvedValueOnce({
      configuracao: {},
      horarios: [
        {
          dia_semana: 1,
          trabalha: true,
          hora_inicio: "08:00",
          hora_fim: "18:00",
          intervalo_inicio: null,
          intervalo_fim: null
        },
        {
          dia_semana: 2,
          trabalha: true,
          hora_inicio: "10:00",
          hora_fim: "20:00",
          intervalo_inicio: null,
          intervalo_fim: null
        },
        {
          dia_semana: 3,
          trabalha: false,
          hora_inicio: null,
          hora_fim: null,
          intervalo_inicio: null,
          intervalo_fim: null
        }
      ]
    });

    render(<ScheduleSettingsPage />);

    const mondayStart = await screen.findByLabelText("Início do atendimento de Segunda");
    const mondayEnd = screen.getByLabelText("Fim do atendimento de Segunda");
    fireEvent.change(mondayStart, { target: { value: "09:00" } });
    fireEvent.change(mondayEnd, { target: { value: "17:00" } });
    fireEvent.click(screen.getByRole("button", { name: "Copiar horário de Segunda para os dias ativos" }));

    expect(screen.getByLabelText("Início do atendimento de Terça").value).toBe("09:00");
    expect(screen.getByLabelText("Fim do atendimento de Terça").value).toBe("17:00");
    expect(screen.queryByLabelText("Início do atendimento de Quarta")).toBeNull();
    expect(screen.getAllByText("Fechado").length).toBeGreaterThan(0);
  });
});
