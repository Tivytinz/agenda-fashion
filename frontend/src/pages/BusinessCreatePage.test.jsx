// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { apiRequest } from "../api/client";
import { BusinessPage } from "./BusinessPage";

const refreshSession = vi.fn();

vi.mock("../api/client", () => ({
  apiRequest: vi.fn()
}));

vi.mock("../auth/SessionContext", () => ({
  useSession: () => ({
    usuario: {
      id: 7,
      nome: "Ana",
      whatsapp: "62999999999"
    },
    refresh: refreshSession
  })
}));

beforeEach(() => {
  apiRequest.mockReset();
  refreshSession.mockReset();
});

afterEach(cleanup);

describe("criação do negócio", () => {
  it("reaproveita o WhatsApp da conta e mostra somente o essencial para avançar", async () => {
    render(
      <MemoryRouter initialEntries={["/criar-negocio"]}>
        <BusinessPage create />
      </MemoryRouter>
    );

    expect(screen.getByRole("heading", {
      name: "Complete só o necessário agora"
    })).not.toBeNull();
    expect(screen.getByText(/Foto, descrição, mapa e endereço completo podem ser adicionados depois/i))
      .not.toBeNull();

    const whatsapp = screen.getByLabelText("WhatsApp");
    expect(whatsapp.value).toBe("(62) 99999-9999");
    expect(whatsapp.required).toBe(true);
    expect(screen.getByText(/Trouxemos o número da sua conta/i)).not.toBeNull();

    expect(screen.getByLabelText("Cidade").required).toBe(true);
    expect(screen.getByRole("combobox", { name: "Estado" }).required).toBe(true);
    expect(screen.queryByLabelText(/Descrição/)).toBeNull();
    expect(screen.queryByLabelText(/Link do Google Maps/)).toBeNull();
    expect(screen.queryByLabelText(/CEP/)).toBeNull();
  });
});