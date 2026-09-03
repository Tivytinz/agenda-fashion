// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
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

function ActivationProbe() {
  const location = useLocation();

  return (
    <div>
      <h1>Novo serviço</h1>
      <output aria-label="etapa de ativação">
        {`${location.state?.onboarding}:${location.state?.onboardingStep}`}
      </output>
    </div>
  );
}

beforeEach(() => {
  sessionStorage.clear();
  apiRequest.mockReset();
  refreshSession.mockReset();
  refreshSession.mockResolvedValue({});
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

    fireEvent.change(screen.getByLabelText("Endereço"), {
      target: { value: "Rua das Flores" }
    });
    fireEvent.change(screen.getByLabelText("Cidade"), {
      target: { value: "Goiânia" }
    });

    const mapsSearch = screen.getByRole("link", {
      name: "Abrir este endereço no Google Maps ↗"
    });
    expect(mapsSearch.getAttribute("href")).toContain(
      "https://www.google.com/maps/search/?api=1&query="
    );
  });

  it("restaura o rascunho e segue direto para o primeiro serviço", async () => {
    sessionStorage.setItem("af_business_creation_draft", JSON.stringify({
      nome: "Studio Aurora",
      whatsapp: "62999999999",
      cidade: "Goiânia",
      estado: "GO",
      bairro: "Centro",
      endereco: "Rua das Flores",
      numero: "10",
      cep: "74000123",
      localizacao_url: "https://maps.google.com/?q=goiania",
      areas: ["Unhas"]
    }));
    apiRequest.mockResolvedValue({
      mensagem: "Negócio criado.",
      negocio: { id: 11, nome: "Studio Aurora" }
    });

    render(
      <MemoryRouter initialEntries={["/criar-negocio"]}>
        <Routes>
          <Route path="/criar-negocio" element={<BusinessPage create />} />
          <Route path="/painel/servicos/novo" element={<ActivationProbe />} />
        </Routes>
      </MemoryRouter>
    );

    expect(screen.getByLabelText("Nome do negócio").value).toBe("Studio Aurora");
    fireEvent.click(screen.getByRole("button", { name: "Criar negócio" }));

    expect(await screen.findByRole("heading", { name: "Novo serviço" }))
      .not.toBeNull();
    expect(screen.getByLabelText("etapa de ativação").textContent)
      .toBe("true:servico");
    expect(sessionStorage.getItem("af_business_creation_draft")).toBeNull();
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
