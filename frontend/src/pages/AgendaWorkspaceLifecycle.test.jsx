// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { apiRequest } from "../api/client";
import { AgendaWorkspacePage } from "./AgendaWorkspacePage";

vi.mock("../api/client", () => ({ apiRequest: vi.fn() }));

const AGENDA = {
  agenda: [
    {
      data: "2026-09-15",
      trabalha: true,
      horarios: [
        {
          hora: "10:00",
          status: "agendado",
          agendamento_id: 42,
          profissional_id: 7,
          cliente: "Maria",
          servico: "Manicure",
          pode_cancelar: true,
          pode_reagendar: true,
          pode_iniciar_atendimento: true,
          pode_marcar_falta: true,
          pode_marcar_realizado: true,
        },
      ],
    },
  ],
};

beforeEach(() => {
  apiRequest.mockReset();
  apiRequest.mockImplementation((path, options = {}) => {
    if (path === "/agenda-profissional") {
      return Promise.resolve(AGENDA);
    }

    if (
      path === "/agendamentos/42/atendimento" &&
      options.method === "PATCH"
    ) {
      return Promise.resolve({
        mensagem: "Atendimento marcado como realizado.",
      });
    }

    if (
      path === "/agendamentos/42/reagendar-operacional" &&
      options.method === "PATCH"
    ) {
      return Promise.resolve({
        mensagem: "Agendamento reagendado com sucesso.",
        agendamento: {
          id: 42,
          status: "confirmado",
        },
      });
    }

    if (
      path === "/agendamentos/42/cancelar-operacional" &&
      options.method === "PATCH"
    ) {
      return Promise.resolve({
        mensagem: "Agendamento cancelado pelo negócio com sucesso.",
        agendamento: {
          id: 42,
          status: "cancelado",
        },
      });
    }

    return Promise.reject(new Error(`Requisição inesperada: ${path}`));
  });
});

afterEach(cleanup);

describe("ciclo operacional na agenda", () => {
  it("envia a transição de realizado pelo endpoint autorizado", async () => {
    render(<AgendaWorkspacePage />);

    const concluir = await screen.findByRole("button", { name: "Concluir" });
    fireEvent.click(concluir);

    await waitFor(() => {
      expect(apiRequest).toHaveBeenCalledWith(
        "/agendamentos/42/atendimento",
        {
          method: "PATCH",
          body: { status: "realizado" },
        }
      );
    });

    expect(await screen.findByText("Atendimento marcado como realizado.")).not.toBeNull();
  });

  it("registra início real do atendimento pelo endpoint autorizado", async () => {
    render(<AgendaWorkspacePage />);

    fireEvent.click(
      await screen.findByRole("button", { name: "Iniciar atendimento" })
    );

    await waitFor(() => {
      expect(apiRequest).toHaveBeenCalledWith(
        "/agendamentos/42/atendimento",
        {
          method: "PATCH",
          body: { status: "iniciado" },
        }
      );
    });
  });

  it("CA-AG-16: profissional reage a própria reserva pela agenda", async () => {
    render(<AgendaWorkspacePage />);

    fireEvent.click(
      await screen.findByRole("button", { name: "Reagendar" })
    );

    expect(
      screen.getByRole("dialog", { name: "Escolha o novo horário" })
    ).not.toBeNull();

    fireEvent.change(
      screen.getByLabelText("Nova data"),
      {
        target: {
          value: "2026-09-20",
        },
      }
    );

    fireEvent.change(
      screen.getByLabelText("Novo horário"),
      {
        target: {
          value: "14:30",
        },
      }
    );

    fireEvent.click(
      screen.getByRole("button", { name: "Confirmar reagendamento" })
    );

    await waitFor(() => {
      expect(apiRequest).toHaveBeenCalledWith(
        "/agendamentos/42/reagendar-operacional",
        {
          method: "PATCH",
          body: {
            data: "2026-09-20",
            horario: "14:30",
          },
        }
      );
    });

    expect(
      await screen.findByText("Agendamento reagendado com sucesso.")
    ).not.toBeNull();
  });

  it("expõe falta separadamente do bloqueio de agenda", async () => {
    render(<AgendaWorkspacePage />);

    const falta = await screen.findByRole("button", { name: "Marcar falta" });
    fireEvent.click(falta);

    await waitFor(() => {
      expect(apiRequest).toHaveBeenCalledWith(
        "/agendamentos/42/atendimento",
        {
          method: "PATCH",
          body: { status: "falta" },
        }
      );
    });

    expect(apiRequest).not.toHaveBeenCalledWith(
      "/bloqueios-horario",
      expect.anything()
    );
  });

  it("confirma cancelamento operacional com motivo estruturado e recarrega a agenda", async () => {
    render(<AgendaWorkspacePage />);

    fireEvent.click(
      await screen.findByRole("button", { name: "Cancelar agendamento" })
    );

    expect(
      screen.getByRole("dialog", { name: "Cancelar este agendamento?" })
    ).not.toBeNull();

    fireEvent.change(
      screen.getByLabelText("Motivo do cancelamento"),
      {
        target: {
          value: "profissional_indisponivel",
        },
      }
    );

    fireEvent.click(
      screen.getByRole("button", { name: "Confirmar cancelamento" })
    );

    await waitFor(() => {
      expect(apiRequest).toHaveBeenCalledWith(
        "/agendamentos/42/cancelar-operacional",
        {
          method: "PATCH",
          body: {
            motivo_tipo: "profissional_indisponivel",
            motivo: null,
          },
        }
      );
    });

    expect(
      await screen.findByText("Agendamento cancelado pelo negócio com sucesso.")
    ).not.toBeNull();
    expect(screen.queryByRole("dialog")).toBeNull();
  });
});
