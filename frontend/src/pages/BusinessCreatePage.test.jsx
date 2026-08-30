// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
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
  it("reaproveita o WhatsApp da conta e exige todas as informações exceto foto", () => {
    render(
      <MemoryRouter initialEntries={["/criar-negocio"]}>
        <BusinessPage create />
      </MemoryRouter>
    );

    expect(screen.getByRole("heading", {
      name: "Preencha todas as informações do perfil"
    })).not.toBeNull();
    expect(screen.getByText(/A única informação que pode ficar para depois é a foto/i))
      .not.toBeNull();

    const requiredFields = [
      /Nome do negócio/,
      /Descrição/,
      /WhatsApp/,
      /Link do Google Maps/,
      /CEP/,
      /Endereço/,
      /Número/,
      /Complemento/,
      /Bairro/,
      /Cidade/
    ];

    for (const label of requiredFields) {
      expect(screen.getByLabelText(label).required).toBe(true);
    }

    expect(screen.getByRole("combobox", { name: "Estado" }).required).toBe(true);

    const whatsapp = screen.getByLabelText(/WhatsApp/);
    expect(whatsapp.value).toBe("(62) 99999-9999");
    expect(screen.getByText(/Trouxemos o número da sua conta/i)).not.toBeNull();
    expect(screen.getByText(/Sem complemento/i)).not.toBeNull();
    expect(screen.queryByLabelText(/Adicionar foto/i)).toBeNull();
  });

  it("não envia a criação quando faltar uma informação obrigatória", () => {
    render(
      <MemoryRouter initialEntries={["/criar-negocio"]}>
        <BusinessPage create />
      </MemoryRouter>
    );

    fireEvent.change(screen.getByLabelText(/Nome do negócio/), {
      target: { value: "Studio Aurora" }
    });
    fireEvent.click(screen.getByLabelText("Unhas"));
    fireEvent.submit(screen.getByRole("button", { name: "Criar negócio" }).closest("form"));

    expect(screen.getByRole("alert").textContent)
      .toContain("Campo pendente: Descrição");
    expect(apiRequest).not.toHaveBeenCalled();
  });
});
