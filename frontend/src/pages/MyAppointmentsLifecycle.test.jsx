// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { apiRequest } from "../api/client";
import { useSession } from "../auth/SessionContext";
import { MyAppointmentsPage } from "./MyAppointmentsPage";

vi.mock("../api/client", () => ({ apiRequest: vi.fn() }));
vi.mock("../analytics/track", () => ({ track: vi.fn() }));
vi.mock("../auth/SessionContext", () => ({ useSession: vi.fn() }));

beforeAll(() => {
  HTMLDialogElement.prototype.showModal = function showModal() {
    this.setAttribute("open", "");
  };
  HTMLDialogElement.prototype.close = function close() {
    this.removeAttribute("open");
  };
});

beforeEach(() => {
  apiRequest.mockReset();
  useSession.mockReturnValue({ authenticated: true, loading: false });
  apiRequest.mockResolvedValue({
    agendamentos: [
      {
        id: 1,
        negocio_id: 10,
        servico_id: 20,
        profissional_id: 30,
        negocio: "Studio AF",
        slug: "studio-af",
        servico: "Manicure",
        profissional: "Ana",
        data: "2026-09-16",
        horario: "10:00",
        valor: 70,
        status: "confirmado",
      },
      {
        id: 2,
        negocio_id: 10,
        servico_id: 20,
        profissional_id: 30,
        negocio: "Studio AF",
        slug: "studio-af",
        servico: "Pedicure",
        profissional: "Ana",
        data: "2026-09-14",
        horario: "11:00",
        valor: 80,
        status: "falta",
      },
    ],
  });
});

afterEach(cleanup);

describe("histórico real da cliente", () => {
  it("mantém confirmado como futuro cancelável", async () => {
    render(<MemoryRouter><MyAppointmentsPage /></MemoryRouter>);

    expect(await screen.findByText("Confirmado")).not.toBeNull();
    expect(screen.getByRole("button", { name: "Cancelar agendamento" })).not.toBeNull();
  });

  it("separa falta em Não realizados e oferece novo agendamento", async () => {
    render(<MemoryRouter><MyAppointmentsPage /></MemoryRouter>);

    const missedTab = await screen.findByRole("tab", { name: /Não realizados/ });
    fireEvent.click(missedTab);

    expect(screen.getByText("Não realizado")).not.toBeNull();
    expect(screen.getByText("Pedicure")).not.toBeNull();
    expect(screen.getByRole("link", { name: "Agendar novamente" })
      .getAttribute("href")).toBe("/negocio/studio-af?servico=20");
  });
});
