// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { apiRequest } from "../api/client";
import { BusinessPage } from "./BusinessPage";

vi.mock("../api/client", () => ({
  apiRequest: vi.fn()
}));

vi.mock("../auth/SessionContext", () => ({
  useSession: () => ({ refresh: vi.fn().mockResolvedValue({}) })
}));

const BUSINESS_WITHOUT_STREET = {
  id: 11,
  slug: "beauty-vanessa",
  nome: "Beauty Vanessa",
  descricao: "VEM NI MIM",
  whatsapp: "62999332133",
  cidade: "Aparecida de Goiânia",
  estado: "GO",
  bairro: "Araguaia",
  endereco: "",
  numero: "",
  complemento: "",
  cep: "74981100",
  areas: ["Cílios", "Sobrancelhas", "Estética"],
  publicado: true
};

beforeEach(() => {
  apiRequest.mockReset();
  apiRequest.mockImplementation((path) => {
    if (path === "/configuracoes") {
      return Promise.resolve({
        negocio: BUSINESS_WITHOUT_STREET,
        publicacao: {
          publicado: true,
          pode_publicar: true,
          pendencias: []
        }
      });
    }

    if (path === "/cep/74981100") {
      return Promise.resolve({
        cep: "74981100",
        endereco: "Rua 10",
        bairro: "Setor Araguaia Acréscimo",
        cidade: "Aparecida de Goiânia",
        estado: "GO"
      });
    }

    return Promise.reject(new Error(`Requisição inesperada: ${path}`));
  });
});

afterEach(() => {
  cleanup();
});

describe("estado de alterações do Meu negócio", () => {
  it("não marca como alterado quando o CEP salvo completa o endereço automaticamente", async () => {
    render(
      <MemoryRouter>
        <BusinessPage />
      </MemoryRouter>
    );

    expect(await screen.findByDisplayValue("Rua 10")).not.toBeNull();
    expect(screen.getByDisplayValue("Setor Araguaia Acréscimo")).not.toBeNull();

    await waitFor(() => {
      expect(screen.queryByRole("button", { name: "Salvar alterações" })).toBeNull();
    });

    fireEvent.change(screen.getByLabelText("Número"), {
      target: { value: "123" }
    });

    expect(screen.getByRole("button", { name: "Salvar alterações" })).not.toBeNull();
  });
});
