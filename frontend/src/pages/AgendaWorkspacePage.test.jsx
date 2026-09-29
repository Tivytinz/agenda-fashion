// @vitest-environment jsdom

import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { apiRequest } from "../api/client";
import { AgendaWorkspacePage } from "./AgendaWorkspacePage";

vi.mock("../api/client", () => ({ apiRequest: vi.fn() }));

beforeEach(() => {
  apiRequest.mockReset();
  apiRequest.mockResolvedValue({
    agenda: [
      {
        data: "2026-08-03",
        profissionais: [{ id: 1, nome: "Ana", horarios: [{ hora: "09:00", status: "livre" }] }]
      },
      { data: "2026-08-04", profissionais: [] }
    ]
  });
});

afterEach(cleanup);

describe("agenda do negócio", () => {
  it("mantém o contexto profissional explícito ao carregar e bloquear a própria agenda", async () => {
    const agendaProfissional = {
      agenda: [{
        data: "2026-08-03",
        trabalha: true,
        horarios: [{
          hora: "09:00",
          status: "livre"
        }]
      }]
    };

    apiRequest
      .mockResolvedValueOnce(
        agendaProfissional
      )
      .mockResolvedValueOnce({
        mensagem:
          "Horário bloqueado."
      })
      .mockResolvedValueOnce({
        agenda: [{
          data: "2026-08-03",
          trabalha: true,
          horarios: [{
            hora: "09:00",
            status: "bloqueado"
          }]
        }]
      });

    render(
      <MemoryRouter>
        <AgendaWorkspacePage />
      </MemoryRouter>
    );

    const slot =
      await screen.findByRole(
        "button",
        { name: /09:00 Livre/ }
      );

    expect(
      apiRequest.mock.calls[0]
    ).toEqual([
      "/agenda-profissional",
      {
        headers: {
          "X-AF-Contexto":
            "profissional"
        }
      }
    ]);

    fireEvent.click(
      slot
    );

    await waitFor(
      () =>
        expect(
          apiRequest
        ).toHaveBeenCalledTimes(3)
    );

    expect(
      apiRequest.mock.calls[1]
    ).toEqual([
      "/bloqueios-horario",
      expect.objectContaining({
        method: "POST",
        headers: {
          "X-AF-Contexto":
            "profissional"
        }
      })
    ]);
  });

  it("marca Hoje pelo fuso do negócio em vez do relógio local do dispositivo", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(
      new Date(
        "2026-09-29T02:30:00.000Z"
      )
    );

    apiRequest.mockResolvedValue({
      fuso_horario:
        "America/Noronha",
      agenda: [{
        data:
          "2026-09-29",
        profissionais: [{
          id: 1,
          nome: "Ana",
          horarios: [{
            hora: "09:00",
            status: "livre"
          }]
        }]
      }]
    });

    render(
      <AgendaWorkspacePage owner />
    );

    await act(
      async () => {}
    );

    expect(
      screen.getByRole(
        "button",
        { name: /Hoje/i }
      )
    ).not.toBeNull();

    vi.useRealTimers();
  });

  it("explica quando a data escolhida não possui profissional disponível", async () => {
    render(<AgendaWorkspacePage owner />);

    expect(await screen.findByRole("button", { name: /03 ago/ })).not.toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /04 ago/ }));

    expect(screen.getByText("Nenhuma profissional disponível neste dia")).not.toBeNull();
    expect(screen.getByRole("button", { name: /04 ago/ }).getAttribute("aria-pressed")).toBe("true");
  });

  it("omite o filtro quando existe uma única profissional", async () => {
    render(<AgendaWorkspacePage owner />);

    expect(await screen.findByRole("button", { name: /09:00 Livre/ })).not.toBeNull();
    expect(screen.queryByRole("combobox")).toBeNull();
  });

  it("mostra o filtro quando há mais de uma profissional", async () => {
    apiRequest.mockResolvedValue({
      agenda: [{
        data: "2026-08-03",
        profissionais: [
          { id: 1, nome: "Ana", horarios: [{ hora: "09:00", status: "livre" }] },
          { id: 2, nome: "Bia", horarios: [{ hora: "10:00", status: "livre" }] }
        ]
      }]
    });

    render(<AgendaWorkspacePage owner />);

    expect(await screen.findByRole("combobox", { name: "Profissional" })).not.toBeNull();
  });

  it("mantém o horário desabilitado, mostra a ação e confirma em um toast discreto", async () => {
    let finishReload;
    const refreshedAgenda = new Promise((resolve) => { finishReload = resolve; });
    apiRequest
      .mockResolvedValueOnce({
        agenda: [{
          data: "2026-08-03",
          profissionais: [{ id: 1, nome: "Ana", horarios: [{ hora: "09:00", status: "livre" }] }]
        }]
      })
      .mockResolvedValueOnce({ mensagem: "Horário bloqueado." })
      .mockImplementationOnce(() => refreshedAgenda);

    render(<AgendaWorkspacePage owner />);
    const slot = await screen.findByRole("button", { name: /09:00 Livre/ });
    fireEvent.click(slot);

    await waitFor(() => expect(apiRequest).toHaveBeenCalledTimes(3));
    expect(slot.disabled).toBe(true);
    expect(screen.getByText("Bloqueando...")).not.toBeNull();

    finishReload({
      agenda: [{
        data: "2026-08-03",
        profissionais: [{ id: 1, nome: "Ana", horarios: [{ hora: "09:00", status: "bloqueado" }] }]
      }]
    });

    const blocked = await screen.findByRole("button", { name: /09:00 Bloqueado/ });
    expect(blocked.querySelector(".slot-lock-icon")).not.toBeNull();

    const feedback = screen.getByRole("status");
    expect(feedback.className).toContain("agenda-feedback-toast");
    expect(screen.getByText("Horário bloqueado.")).not.toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Fechar aviso" }));
    expect(screen.queryByRole("status")).toBeNull();
  });

  it("CA-AG-22: não oferece ação de bloqueio sobre reserva confirmada", async () => {
    apiRequest.mockResolvedValue({
      agenda: [{
        data: "2026-08-03",
        profissionais: [{
          id: 1,
          nome: "Ana",
          horarios: [{
            hora: "14:00",
            status: "confirmado",
            agendamento_id: 91,
            cliente: "Cliente",
            servico: "Manicure"
          }]
        }]
      }]
    });

    render(<AgendaWorkspacePage owner />);

    expect(await screen.findByText("14:00")).not.toBeNull();
    expect(screen.getByText("Confirmado")).not.toBeNull();
    expect(
      screen.queryByRole("button", { name: /14:00 Confirmado/ })
    ).toBeNull();
    expect(apiRequest).toHaveBeenCalledTimes(1);
  });

  it("pagina as datas sem deixar botões cortados", async () => {
    const originalWidth = window.innerWidth;
    Object.defineProperty(window, "innerWidth", { configurable: true, value: 700 });
    apiRequest.mockResolvedValue({
      agenda: ["03", "04", "05", "06", "07"].map((day) => ({
        data: `2026-08-${day}`,
        profissionais: [{ id: 1, nome: "Ana", horarios: [{ hora: "09:00", status: "livre" }] }]
      }))
    });

    render(<AgendaWorkspacePage owner />);

    expect(await screen.findByRole("button", { name: /03 ago/ })).not.toBeNull();
    expect(screen.getByRole("button", { name: /05 ago/ })).not.toBeNull();
    expect(screen.queryByRole("button", { name: /06 ago/ })).toBeNull();
    await act(async () => {});

    fireEvent.click(screen.getByRole("button", { name: "Ver próximas datas" }));

    expect(await screen.findByRole("button", { name: /06 ago/ })).not.toBeNull();
    Object.defineProperty(window, "innerWidth", { configurable: true, value: originalWidth });
  });

  it("orienta a profissional para os próprios horários quando a agenda está vazia", async () => {
    apiRequest.mockResolvedValue({ agenda: [] });

    render(
      <MemoryRouter>
        <AgendaWorkspacePage />
      </MemoryRouter>
    );

    expect(
      await screen.findByRole("heading", { name: "Minha agenda" })
    ).not.toBeNull();
    expect(
      screen.getByText("Sua agenda ainda está vazia")
    ).not.toBeNull();
    expect(
      screen.getByRole("link", { name: "Ajustar meus horários" })
        .getAttribute("href")
    ).toBe("/profissional/horarios");
    expect(
      screen.queryByText(/Vincule profissionais/i)
    ).toBeNull();
  });

  it("mantém uma ação principal e agrupa operações secundárias para a profissional", async () => {
    apiRequest.mockResolvedValue({
      agenda: [{
        data: "2026-08-03",
        trabalha: true,
        horarios: [{
          hora: "09:30",
          status: "confirmado",
          agendamento_id: 91,
          cliente: "Ana",
          servico: "Corte",
          pode_reagendar: true,
          pode_cancelar: true,
          pode_iniciar_atendimento: true,
          pode_marcar_realizado: false,
          pode_marcar_falta: true
        }]
      }]
    });

    render(
      <MemoryRouter>
        <AgendaWorkspacePage />
      </MemoryRouter>
    );

    expect(
      await screen.findByRole("button", { name: "Iniciar atendimento" })
    ).not.toBeNull();
    expect(
      screen.queryByRole("button", { name: "Concluir" })
    ).toBeNull();

    const more = screen.getByText("Mais");
    fireEvent.click(more);

    expect(
      screen.getByRole("button", { name: "Reagendar" })
    ).not.toBeNull();
    expect(
      screen.getByRole("button", { name: "Cancelar agendamento" })
    ).not.toBeNull();
    expect(
      screen.getByRole("button", { name: "Marcar falta" })
    ).not.toBeNull();
  });

  it("preserva as ações completas da agenda da dona", async () => {
    apiRequest.mockResolvedValue({
      agenda: [{
        data: "2026-08-03",
        profissionais: [{
          id: 1,
          nome: "Ana",
          horarios: [{
            hora: "09:30",
            status: "confirmado",
            agendamento_id: 91,
            cliente: "Cliente",
            servico: "Corte",
            pode_reagendar: true,
            pode_cancelar: true,
            pode_iniciar_atendimento: true,
            pode_marcar_realizado: true,
            pode_marcar_falta: true
          }]
        }]
      }]
    });

    render(<AgendaWorkspacePage owner />);

    expect(
      await screen.findByRole("button", { name: "Reagendar" })
    ).not.toBeNull();
    expect(
      screen.getByRole("button", { name: "Cancelar agendamento" })
    ).not.toBeNull();
    expect(
      screen.getByRole("button", { name: "Iniciar atendimento" })
    ).not.toBeNull();
    expect(
      screen.getByRole("button", { name: "Concluir" })
    ).not.toBeNull();
    expect(
      screen.getByRole("button", { name: "Marcar falta" })
    ).not.toBeNull();
    expect(screen.queryByText("Mais")).toBeNull();
  });

  it("exibe compromisso persistido mesmo quando o dia atual está marcado como folga", async () => {
    apiRequest.mockResolvedValue({
      agenda: [{
        data: "2026-08-03",
        trabalha: false,
        horarios: [{
          data: "2026-08-03",
          hora: "09:30",
          status: "confirmado",
          agendamento_id: 91,
          cliente: "Ana",
          servico: "Corte"
        }]
      }]
    });

    render(<AgendaWorkspacePage />);

    expect(await screen.findByText("09:30")).not.toBeNull();
    expect(screen.getByText("Confirmado")).not.toBeNull();
    expect(screen.getByText("Ana · Corte")).not.toBeNull();
    expect(screen.queryByText("Dia de folga")).toBeNull();
  });
});
