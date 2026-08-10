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
  slug: "studio-victor",
  nome: "Studio Victor",
  descricao: "Beleza e cuidados pessoais.",
  setor: "Beleza",
  whatsapp: "62999999999",
  cidade: "Goiânia",
  estado: "GO",
  bairro: "Centro",
  endereco: "Rua das Flores",
  numero: "10",
  complemento: "Sala 2",
  cep: "74000123",
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
  it("informa que o endereço acompanha o nome e envia os demais campos normalizados", async () => {
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
        mensagem: "Alterações salvas.",
        negocio: BUSINESS
      });

    renderPage();

    const whatsapp = await screen.findByLabelText("WhatsApp");
    const state = screen.getByRole("combobox", { name: "Estado" });
    const address = screen.getByLabelText("Endereço");
    const postalCode = screen.getByLabelText("CEP");

    expect(whatsapp.value).toBe("(62) 99999-9999");
    expect(screen.getByTestId("public-address-hint").textContent)
      .toContain("app.agendafashion.com.br/negocio/studio-victor");
    expect(screen.getByTestId("public-address-hint").textContent)
      .toContain("Ao salvar um novo nome, este endereço também será atualizado");
    expect(whatsapp.getAttribute("placeholder")).toBe("(00) 12345-6789");
    expect(state.value).toBe("GO");
    expect(state.required).toBe(true);
    expect(address.value).toBe("Rua das Flores");
    expect(postalCode.value).toBe("74000-123");
    expect(screen.queryByLabelText("Área principal")).toBeNull();
    expect(screen.queryByLabelText("Áreas atendidas")).toBeNull();
    expect(screen.getByLabelText("Unhas").checked).toBe(true);
    expect(screen.getByRole("link", {
      name: "Ver meu perfil público"
    }).getAttribute("href")).toBe("/negocio/studio-victor");

    fireEvent.change(whatsapp, { target: { value: "11 98765-4321" } });
    fireEvent.change(screen.getByLabelText("Nome do negócio"), {
      target: { value: "Beauty Vanessa" }
    });
    fireEvent.change(state, { target: { value: "SP" } });
    fireEvent.change(address, { target: { value: "Avenida Brasil" } });
    fireEvent.change(postalCode, { target: { value: "01001-000" } });
    fireEvent.click(screen.getByRole("button", { name: "Salvar alterações" }));

    await waitFor(() => {
      expect(apiRequest).toHaveBeenLastCalledWith("/configuracoes", {
        method: "PUT",
        body: expect.objectContaining({
          whatsapp: "11987654321",
          nome: "Beauty Vanessa",
          estado: "SP",
          endereco: "Avenida Brasil",
          cep: "01001000",
          especialidades: ["Unhas"]
        })
      });
    });

    const [, request] = apiRequest.mock.calls.at(-1);
    expect(request.body).not.toHaveProperty("slug");
  });

  it("troca a foto do negócio pelo endpoint próprio", async () => {
    apiRequest
      .mockResolvedValueOnce({
        negocio: { ...BUSINESS, foto_url: "" },
        publicacao: {
          publicado: false,
          pode_publicar: true,
          pendencias: []
        }
      })
      .mockResolvedValueOnce({
        mensagem: "Foto do negócio atualizada com sucesso.",
        negocio: {
          ...BUSINESS,
          foto_url: "https://cdn.teste/negocio.png"
        },
        publicacao: {
          publicado: false,
          pode_publicar: true,
          pendencias: []
        }
      });

    renderPage();
    const input = await screen.findByLabelText("Adicionar foto");
    const file = new File(["imagem"], "negocio.png", { type: "image/png" });

    fireEvent.change(input, { target: { files: [file] } });

    await waitFor(() => {
      expect(apiRequest).toHaveBeenLastCalledWith("/configuracoes/foto", {
        method: "POST",
        body: expect.any(FormData)
      });
    });

    expect(await screen.findByRole("img", {
      name: "Foto do negócio Studio Victor"
    })).not.toBeNull();
    expect(refreshSession).toHaveBeenCalledTimes(1);
  });

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
