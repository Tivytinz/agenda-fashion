// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
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
});
