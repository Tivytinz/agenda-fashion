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

  it("mantém o horário desabilitado e informa a ação enquanto a agenda atualiza", async () => {
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

    expect(await screen.findByRole("button", { name: /09:00 Bloqueado/ })).not.toBeNull();
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

    fireEvent.click(screen.getByRole("button", { name: "Ver próximas datas" }));

    expect(await screen.findByRole("button", { name: /06 ago/ })).not.toBeNull();
    Object.defineProperty(window, "innerWidth", { configurable: true, value: originalWidth });
  });
});
