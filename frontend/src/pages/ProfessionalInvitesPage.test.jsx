// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { apiRequest } from "../api/client";
import { useSession } from "../auth/SessionContext";
import { ProfessionalInvitesPage } from "./ProfessionalInvitesPage";

vi.mock("../api/client", () => ({ apiRequest: vi.fn() }));
vi.mock("../auth/SessionContext", () => ({ useSession: vi.fn() }));

const refresh = vi.fn();

beforeEach(() => {
  apiRequest.mockReset();
  refresh.mockReset();
  useSession.mockReturnValue({
    temNegocio: false,
    negocio: null,
    refresh
  });
});

afterEach(cleanup);

describe("convites recebidos", () => {
  it("aceita convite, atualiza a sessão e mostra acesso à área profissional", async () => {
    apiRequest
      .mockResolvedValueOnce({
        convites: [{
          id: 11,
          negocio_id: 4,
          negocio_nome: "Studio Rosa",
          status: "pendente",
          expira_em: "2026-09-20T18:00:00.000Z"
        }]
      })
      .mockResolvedValueOnce({
        mensagem: "Convite aceito. Você agora faz parte da equipe.",
        convite: { id: 11, negocio_id: 4, status: "aceito" }
      });

    refresh.mockResolvedValue({
      temNegocio: true,
      negocio: { id: 4, papel: "profissional" }
    });

    render(<MemoryRouter><ProfessionalInvitesPage /></MemoryRouter>);
    await screen.findByText("Studio Rosa");
    fireEvent.click(screen.getByRole("button", { name: "Aceitar convite" }));

    await waitFor(() => {
      expect(apiRequest).toHaveBeenLastCalledWith(
        "/profissionais/convites/11/aceitar",
        { method: "POST" }
      );
    });

    expect(refresh).toHaveBeenCalledTimes(1);
    const workspace = await screen.findByRole("link", {
      name: "Abrir minha área profissional"
    });
    expect(workspace.getAttribute("href")).toBe("/profissional/agenda");
    expect(screen.queryByText("Studio Rosa")).toBeNull();
  });

  it("recusa convite sem criar acesso ao negócio", async () => {
    apiRequest
      .mockResolvedValueOnce({
        convites: [{
          id: 12,
          negocio_id: 5,
          negocio_nome: "Salão Flor",
          status: "pendente",
          expira_em: "2026-09-20T18:00:00.000Z"
        }]
      })
      .mockResolvedValueOnce({
        mensagem: "Convite recusado.",
        convite: { id: 12, negocio_id: 5, status: "recusado" }
      });

    render(<MemoryRouter><ProfessionalInvitesPage /></MemoryRouter>);
    await screen.findByText("Salão Flor");
    fireEvent.click(screen.getByRole("button", { name: "Recusar" }));
    await screen.findByText("Convite recusado.");

    expect(refresh).not.toHaveBeenCalled();
    expect(screen.queryByText("Salão Flor")).toBeNull();
  });
});
