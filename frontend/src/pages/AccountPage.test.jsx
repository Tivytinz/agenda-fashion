// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { apiRequest } from "../api/client";
import { useSession } from "../auth/SessionContext";
import { AccountPage } from "./AccountPage";

vi.mock("../api/client", () => ({ apiRequest: vi.fn() }));
vi.mock("../auth/SessionContext", () => ({ useSession: vi.fn() }));

const refreshSession = vi.fn();

beforeEach(() => {
  apiRequest.mockReset();
  refreshSession.mockReset();
  refreshSession.mockResolvedValue({});
  useSession.mockReturnValue({
    temNegocio: false,
    ehAdministrador: false,
    negocio: null,
    refresh: refreshSession,
    logout: vi.fn()
  });
});

afterEach(cleanup);

describe("minha conta", () => {
  it("exibe máscara no WhatsApp e envia somente os dígitos", async () => {
    apiRequest
      .mockResolvedValueOnce({
        usuario: {
          id: 7,
          nome: "Victor Souza",
          email: "victor@example.com",
          whatsapp: "62999998888"
        }
      })
      .mockResolvedValueOnce({
        mensagem: "Perfil atualizado.",
        usuario: {
          id: 7,
          nome: "Victor Souza",
          email: "victor@example.com",
          whatsapp: "11987654321"
        }
      });

    render(<MemoryRouter><AccountPage /></MemoryRouter>);

    const whatsapp = await screen.findByLabelText("WhatsApp");
    expect(whatsapp.value).toBe("(62) 99999-8888");
    expect(whatsapp.getAttribute("placeholder")).toBe("(00) 12345-6789");

    fireEvent.change(whatsapp, { target: { value: "11 98765-4321" } });
    fireEvent.click(screen.getByRole("button", { name: "Salvar perfil" }));

    await waitFor(() => {
      expect(apiRequest).toHaveBeenLastCalledWith("/conta", {
        method: "PUT",
        body: {
          nome: "Victor Souza",
          whatsapp: "11987654321"
        }
      });
    });
  });

  it("mantém o administrador dentro do fluxo administrativo", async () => {
    useSession.mockReturnValue({
      temNegocio: false,
      ehAdministrador: true,
      negocio: null,
      refresh: refreshSession,
      logout: vi.fn()
    });
    apiRequest.mockResolvedValueOnce({
      usuario: {
        id: 9,
        nome: "Admin AF",
        email: "admin@example.com",
        whatsapp: "62999998888"
      }
    });

    const { container } = render(
      <MemoryRouter>
        <AccountPage />
      </MemoryRouter>
    );

    const backLink = await screen.findByRole(
      "link",
      { name: /Voltar à administração/ }
    );

    expect(backLink.getAttribute("href"))
      .toBe("/admin/trafego-pago");
    expect(
      container.querySelector("main")
        ?.classList.contains("workspace-page")
    ).toBe(true);
  });
});
