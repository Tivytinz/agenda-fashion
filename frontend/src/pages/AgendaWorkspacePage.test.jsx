// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
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
  it("explica quando a data escolhida não possui profissional disponível", async () => {
    render(<AgendaWorkspacePage owner />);

    expect(await screen.findByRole("button", { name: /03 de ago/ })).not.toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /04 de ago/ }));

    expect(screen.getByText("Nenhuma profissional disponível neste dia")).not.toBeNull();
    expect(screen.getByRole("button", { name: /04 de ago/ }).getAttribute("aria-pressed")).toBe("true");
  });

  it("mantém o horário desabilitado até a agenda atualizada chegar", async () => {
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

    finishReload({
      agenda: [{
        data: "2026-08-03",
        profissionais: [{ id: 1, nome: "Ana", horarios: [{ hora: "09:00", status: "bloqueado" }] }]
      }]
    });

    expect(await screen.findByRole("button", { name: /09:00 Bloqueado/ })).not.toBeNull();
  });
});
