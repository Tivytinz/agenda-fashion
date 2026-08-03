// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { apiRequest } from "../api/client";
import { DashboardPage } from "./DashboardPage";

vi.mock("../api/client", () => ({ apiRequest: vi.fn() }));

const DASHBOARD = {
  resumo: { agendamentos_periodo: 2, faturamento_periodo: 100 },
  performance: { taxa_conversao: 10 }
};

beforeEach(() => apiRequest.mockReset());
afterEach(cleanup);

describe("dashboard", () => {
  it("cancela a consulta anterior e identifica o período selecionado", async () => {
    apiRequest.mockResolvedValue(DASHBOARD);
    render(<MemoryRouter><DashboardPage /></MemoryRouter>);

    expect(await screen.findByText("Faturamento")).not.toBeNull();
    const initialSignal = apiRequest.mock.calls[0][1].signal;
    const today = screen.getByRole("button", { name: "Hoje" });
    fireEvent.click(today);

    await waitFor(() => expect(apiRequest).toHaveBeenLastCalledWith(
      "/dashboard-dono?periodo=hoje",
      expect.objectContaining({ signal: expect.any(AbortSignal) })
    ));
    expect(initialSignal.aborted).toBe(true);
    expect((await screen.findByRole("button", { name: "Hoje" })).getAttribute("aria-pressed")).toBe("true");
  });
});
