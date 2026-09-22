// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
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
  it("reaproveita o WhatsApp da conta e deixa descrição, foto e complemento opcionais", () => {
    render(
      <MemoryRouter initialEntries={["/criar-negocio"]}>
        <BusinessPage create />
      </MemoryRouter>
    );

    expect(screen.getByRole("heading", {
      name: "Preencha os dados essenciais do perfil"
    })).not.toBeNull();
    expect(screen.getByText(/Descrição, foto e complemento são opcionais/i))
      .not.toBeNull();

    const requiredFields = [
      /Nome do negócio/,
      /WhatsApp/,
      /Link do Google Maps/,
      /CEP/,
      /Endereço/,
      /Número/,
      /Bairro/,
      /Cidade/
    ];

    for (const label of requiredFields) {
      expect(screen.getByLabelText(label).required).toBe(true);
    }

    expect(screen.getByLabelText(/Descrição \(opcional\)/).required)
      .toBe(false);
    expect(screen.getByLabelText(/Complemento/).required).toBe(false);
    expect(screen.getByRole("combobox", { name: "Estado" }).required).toBe(true);

    const whatsapp = screen.getByLabelText(/WhatsApp/);
    expect(whatsapp.value).toBe("(62) 99999-9999");
    expect(screen.getByText(/Trouxemos o número da sua conta/i)).not.toBeNull();
    expect(screen.queryByText(/Sem complemento/i)).toBeNull();
    expect(screen.queryByLabelText(/Adicionar foto/i)).toBeNull();
  });

  it("CA-NEG-02: exibe a rejeição do backend ao tentar criar segundo negócio operacional", async () => {
    apiRequest.mockRejectedValueOnce(
      new Error(
        "Esta conta já possui um negócio."
      )
    );

    render(
      <MemoryRouter initialEntries={["/criar-negocio"]}>
        <BusinessPage create />
      </MemoryRouter>
    );

    fireEvent.change(
      screen.getByLabelText(/Nome do negócio/),
      {
        target: { value: "Studio Aurora" }
      }
    );
    fireEvent.click(
      screen.getByLabelText("Unhas")
    );
    fireEvent.change(
      screen.getByLabelText(
        /Link do Google Maps/
      ),
      {
        target: {
          value:
            "https://maps.google.com/?q=goiania"
        }
      }
    );
    fireEvent.change(
      screen.getByLabelText(/CEP/),
      {
        target: { value: "74000-123" }
      }
    );
    fireEvent.change(
      screen.getByLabelText("Endereço"),
      {
        target: { value: "Rua das Flores" }
      }
    );
    fireEvent.change(
      screen.getByLabelText("Número"),
      {
        target: { value: "10" }
      }
    );
    fireEvent.change(
      screen.getByLabelText("Bairro"),
      {
        target: { value: "Centro" }
      }
    );
    fireEvent.change(
      screen.getByLabelText("Cidade"),
      {
        target: { value: "Goiânia" }
      }
    );
    fireEvent.change(
      screen.getByRole(
        "combobox",
        { name: "Estado" }
      ),
      {
        target: { value: "GO" }
      }
    );

    fireEvent.submit(
      screen
        .getByRole(
          "button",
          { name: "Criar negócio" }
        )
        .closest("form")
    );

    expect(
      await screen.findByRole("alert")
    ).toHaveTextContent(
      "Esta conta já possui um negócio."
    );

    await waitFor(() => {
      expect(apiRequest).toHaveBeenCalledWith(
        "/criar-negocio",
        expect.objectContaining({
          method: "POST"
        })
      );
    });
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
      .toContain("Campo pendente: Cidade");
    expect(apiRequest).not.toHaveBeenCalled();
  });
});
