// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { apiRequest } from "../api/client";
import { useSession } from "../auth/SessionContext";
import { MyAppointmentsPage } from "./MyAppointmentsPage";

vi.mock("../api/client", () => ({ apiRequest: vi.fn() }));
vi.mock("../analytics/track", () => ({ track: vi.fn() }));
vi.mock("../auth/SessionContext", () => ({ useSession: vi.fn() }));

const APPOINTMENT = {
  id: 12,
  negocio_id: 4,
  servico_id: 9,
  profissional_id: 3,
  negocio: "Studio Aurora",
  slug: "studio-aurora",
  servico: "Manicure",
  profissional: "Ana",
  data: "2026-08-08",
  horario: "09:30:00",
  valor: 50,
  status: "agendado"
};

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
  useSession.mockReset();
  sessionStorage.clear();
});

afterEach(cleanup);

describe("agenda da cliente", () => {
  it("relaciona as três abas ao conteúdo, navega pelo teclado e facilita repetir o serviço", async () => {
    useSession.mockReturnValue({ authenticated: true, loading: false });
    apiRequest.mockResolvedValue({
      agendamentos: [
        APPOINTMENT,
        { ...APPOINTMENT, id: 13, status: "realizado", servico: "Pedicure" }
      ]
    });

    render(<MemoryRouter><MyAppointmentsPage /></MemoryRouter>);

    expect(await screen.findByText("Manicure")).not.toBeNull();
    const scheduledTab = screen.getByRole("tab", { name: /Agendados/ });
    const completedTab = screen.getByRole("tab", { name: /Realizados/ });
    const panel = screen.getByRole("tabpanel");

    expect(scheduledTab.getAttribute("aria-controls")).toBe(panel.id);
    expect(panel.getAttribute("aria-labelledby")).toBe(scheduledTab.id);

    scheduledTab.focus();
    fireEvent.keyDown(scheduledTab, { key: "ArrowRight" });

    expect(completedTab.getAttribute("aria-selected")).toBe("true");
    expect(document.activeElement).toBe(completedTab);
    expect(screen.getByRole("tabpanel").textContent).toContain("Pedicure");

    const repeatLink = screen.getByRole("link", { name: "Agendar novamente" });
    expect(repeatLink.getAttribute("href"))
      .toBe("/negocio/studio-aurora?servico=9");
    expect(repeatLink.getAttribute("href")).not.toContain("profissional");
  });

  it("mantém o histórico legado utilizável quando não existe servico_id", async () => {
    useSession.mockReturnValue({ authenticated: true, loading: false });
    apiRequest.mockResolvedValue({
      agendamentos: [{
        ...APPOINTMENT,
        id: 14,
        status: "realizado",
        servico_id: null
      }]
    });

    render(<MemoryRouter><MyAppointmentsPage /></MemoryRouter>);

    fireEvent.click(await screen.findByRole("tab", { name: /Realizados/ }));

    expect(screen.queryByRole("link", { name: "Agendar novamente" })).toBeNull();
    expect(screen.getByRole("link", { name: "Ver negócio" })
      .getAttribute("href")).toBe("/negocio/studio-aurora");
  });

  it("mantém o diálogo aberto e mostra o erro quando o cancelamento falha", async () => {
    useSession.mockReturnValue({ authenticated: true, loading: false });
    apiRequest
      .mockResolvedValueOnce({ agendamentos: [APPOINTMENT] })
      .mockRejectedValueOnce(new Error("Não foi possível cancelar agora."));

    render(<MemoryRouter><MyAppointmentsPage /></MemoryRouter>);

    fireEvent.click(await screen.findByRole("button", {
      name: "Cancelar agendamento"
    }));
    fireEvent.click(screen.getByRole("button", { name: "Sim, cancelar" }));

    expect((await screen.findByRole("alert")).textContent).toContain(
      "Não foi possível cancelar agora."
    );
    expect(screen.getByRole("dialog").hasAttribute("open")).toBe(true);
    expect(screen.queryByText("Agendamento cancelado com sucesso.")).toBeNull();

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Sim, cancelar" }).disabled)
        .toBe(false);
    });
  });

  it("volta ao modo visitante quando a sessão deixa de existir", async () => {
    let session = { authenticated: true, loading: false };
    useSession.mockImplementation(() => session);
    apiRequest.mockRejectedValue(new Error("Sessão expirada"));

    const view = render(<MemoryRouter><MyAppointmentsPage /></MemoryRouter>);
    expect(await screen.findByText("Algo não saiu como esperado")).not.toBeNull();

    session = { authenticated: false, loading: false };
    view.rerender(<MemoryRouter><MyAppointmentsPage /></MemoryRouter>);

    expect(await screen.findByText("Agendamento como visitante")).not.toBeNull();
    expect(screen.queryByText("Algo não saiu como esperado")).toBeNull();
  });
});
