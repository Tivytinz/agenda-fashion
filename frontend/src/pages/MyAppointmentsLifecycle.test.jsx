// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { apiRequest } from "../api/client";
import { track } from "../analytics/track";
import { useSession } from "../auth/SessionContext";
import { MyAppointmentsPage } from "./MyAppointmentsPage";

vi.mock("../api/client", () => ({ apiRequest: vi.fn() }));
vi.mock("../analytics/track", () => ({ track: vi.fn() }));
vi.mock("../auth/SessionContext", () => ({ useSession: vi.fn() }));

const APPOINTMENTS = [
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
  {
    id: 3,
    negocio_id: 10,
    servico_id: 21,
    profissional_id: 30,
    negocio: "Studio AF",
    slug: "studio-af",
    servico: "Spa dos pés",
    profissional: "Ana",
    data: "2026-09-13",
    horario: "14:00",
    valor: 95,
    status: "realizado",
    avaliacao: null,
  },
];

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
  track.mockReset();
  useSession.mockReturnValue({ authenticated: true, loading: false });
  apiRequest.mockImplementation((path, options = {}) => {
    if (path === "/meus-agendamentos") {
      return Promise.resolve({ agendamentos: APPOINTMENTS });
    }

    if (path === "/agendamentos/3/avaliar" && options.method === "PATCH") {
      return Promise.resolve({
        mensagem: "Avaliação salva com sucesso.",
        avaliacao: options.body?.avaliacao,
      });
    }

    return Promise.resolve({});
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

  it("mede o início do reagendamento a partir do histórico", async () => {
    render(<MemoryRouter><MyAppointmentsPage /></MemoryRouter>);

    const missedTab = await screen.findByRole("tab", { name: /Não realizados/ });
    fireEvent.click(missedTab);
    fireEvent.click(screen.getByRole("link", { name: "Agendar novamente" }));

    expect(track).toHaveBeenCalledWith("reagendamento_iniciado", {
      page: "meus_agendamentos",
      mission: "retornar_ao_negocio",
      businessId: 10,
      properties: {
        agendamento_id: 2,
        servico_id: 20,
        status_origem: "falta",
      },
    });
  });

  it("permite avaliar uma única vez um atendimento realizado", async () => {
    render(<MemoryRouter><MyAppointmentsPage /></MemoryRouter>);

    const completedTab = await screen.findByRole("tab", { name: /Realizados/ });
    fireEvent.click(completedTab);
    fireEvent.click(screen.getByRole("button", { name: "Avaliar com 5 estrelas" }));

    await waitFor(() => {
      expect(apiRequest).toHaveBeenCalledWith("/agendamentos/3/avaliar", {
        method: "PATCH",
        body: { avaliacao: 5 },
      });
    });

    expect(await screen.findByText("Sua avaliação: 5/5")).not.toBeNull();
    expect(screen.queryByRole("button", { name: "Avaliar com 5 estrelas" })).toBeNull();
    expect(track).toHaveBeenCalledWith("avaliacao_enviada", {
      page: "meus_agendamentos",
      mission: "avaliar_atendimento",
      businessId: 10,
      properties: {
        agendamento_id: 3,
        servico_id: 21,
        avaliacao: 5,
      },
    });
  });
});
