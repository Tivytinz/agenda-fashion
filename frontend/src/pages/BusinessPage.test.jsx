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
  useSession: () => ({ refresh: refreshSession })
}));

const BUSINESS = {
  id: 11,
  nome: "Studio Victor",
  descricao: "Beleza e cuidados pessoais.",
  setor: "Beleza",
  whatsapp: "62999999999",
  cidade: "Goiânia",
  estado: "GO",
  bairro: "Centro",
  areas: ["Unhas"],
  publicado: false
};

function renderPage() {
  return render(
    <MemoryRouter>
      <BusinessPage />
    </MemoryRouter>
  );
}

beforeEach(() => {
  apiRequest.mockReset();
  refreshSession.mockReset();
  refreshSession.mockResolvedValue({});
});

afterEach(() => {
  cleanup();
});

describe("publicação do negócio", () => {
  it("publica um perfil pronto e atualiza o estado da tela", async () => {
    apiRequest
      .mockResolvedValueOnce({
        negocio: BUSINESS,
        publicacao: {
          publicado: false,
          pode_publicar: true,
          pendencias: []
        }
      })
      .mockResolvedValueOnce({
        mensagem: "Seu negócio está publicado e já pode aparecer na página inicial.",
        publicacao: {
          publicado: true,
          pode_publicar: true,
          pendencias: []
        }
      });

    renderPage();
    fireEvent.click(await screen.findByRole("button", { name: "Publicar meu negócio" }));

    await waitFor(() => {
      expect(apiRequest).toHaveBeenCalledWith("/configuracoes/publicacao", {
        method: "PATCH",
        body: { publicado: true }
      });
    });
    expect(await screen.findByRole("heading", { name: "Seu negócio está publicado" })).not.toBeNull();
    expect(refreshSession).toHaveBeenCalledTimes(1);
  });

  it("mostra o que falta e bloqueia a publicação incompleta", async () => {
    apiRequest.mockResolvedValueOnce({
      negocio: { ...BUSINESS, descricao: "", cidade: "" },
      publicacao: {
        publicado: false,
        pode_publicar: false,
        pendencias: ["descrição", "cidade", "pelo menos um serviço ativo"]
      }
    });

    renderPage();

    expect(await screen.findByText(/Falta completar: descrição, cidade, pelo menos um serviço ativo/)).not.toBeNull();
    expect(screen.getByRole("button", { name: "Publicar meu negócio" }).disabled).toBe(true);
    expect(apiRequest).toHaveBeenCalledTimes(1);
  });
});
