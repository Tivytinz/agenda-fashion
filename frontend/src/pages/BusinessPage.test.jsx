// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
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
  whatsapp_negocio: "62999999999",
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
  it("continua no checkout depois de criar um negócio completo de um plano pago", async () => {
    apiRequest.mockImplementation((path, options = {}) => {
      if (path === "/cep/74000123") {
        return Promise.resolve({
          cep: "74000123",
          endereco: "Rua das Flores",
          bairro: "Centro",
          cidade: "Goiânia",
          estado: "GO"
        });
      }

      if (path === "/criar-negocio" && options.method === "POST") {
        return Promise.resolve({
          mensagem: "Negócio criado.",
          negocio: BUSINESS
        });
      }

      return Promise.reject(new Error(`Rota inesperada: ${path}`));
    });

    render(
      <MemoryRouter initialEntries={["/criar-negocio?plano=autonoma"]}>
        <Routes>
          <Route path="/criar-negocio" element={<BusinessPage create />} />
          <Route path="/checkout" element={<h1>Checkout do plano</h1>} />
        </Routes>
      </MemoryRouter>
    );

    fireEvent.change(screen.getByLabelText("Nome do negócio"), {
      target: { value: "Studio Victor" }
    });
    fireEvent.change(screen.getByLabelText(/Descrição/), {
      target: { value: "Beleza e cuidados pessoais." }
    });
    fireEvent.click(screen.getByLabelText("Unhas"));
    fireEvent.change(screen.getByLabelText(/WhatsApp/), {
      target: { value: "62 99999-9999" }
    });
    fireEvent.change(screen.getByLabelText(/Link do Google Maps/), {
      target: { value: "https://maps.google.com/?q=goiania" }
    });
    fireEvent.change(screen.getByLabelText(/CEP/), {
      target: { value: "74000-123" }
    });

    await waitFor(() => {
      expect(screen.getByLabelText("Endereço").value).toBe("Rua das Flores");
      expect(screen.getByLabelText("Bairro").value).toBe("Centro");
      expect(screen.getByLabelText("Cidade").value).toBe("Goiânia");
      expect(screen.getByRole("combobox", { name: "Estado" }).value).toBe("GO");
    });

    fireEvent.change(screen.getByLabelText("Número"), {
      target: { value: "10" }
    });
    fireEvent.change(screen.getByLabelText(/Complemento/), {
      target: { value: "Sala 2" }
    });
    fireEvent.submit(screen.getByRole("button", { name: "Criar negócio" }).closest("form"));

    expect(await screen.findByRole("heading", { name: "Checkout do plano" }))
      .not.toBeNull();
    expect(apiRequest).toHaveBeenCalledWith("/criar-negocio", {
      method: "POST",
      body: expect.objectContaining({
        nome: "Studio Victor",
        descricao: "Beleza e cuidados pessoais.",
        especialidades: ["Unhas"],
        whatsapp: "62999999999",
        cidade: "Goiânia",
        estado: "GO",
        bairro: "Centro",
        endereco: "Rua das Flores",
        numero: "10",
        complemento: "Sala 2",
        cep: "74000123",
        localizacao_url: "https://maps.google.com/?q=goiania"
      })
    });
  });

  it("mostra ações úteis, salva apenas depois de alterações e envia os campos normalizados", async () => {
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
        cep: "01001000",
        endereco: "Avenida Brasil",
        bairro: "Centro",
        cidade: "São Paulo",
        estado: "SP"
      })
      .mockResolvedValueOnce({
        mensagem: "Alterações salvas.",
        negocio: {
          ...BUSINESS,
          nome: "Beauty Vanessa",
          whatsapp: "11987654321",
          cidade: "São Paulo",
          estado: "SP",
          endereco: "Avenida Brasil",
          cep: "01001000"
        }
      });

    renderPage();

    const whatsapp = await screen.findByLabelText(/WhatsApp/);
    const state = screen.getByRole("combobox", { name: "Estado" });
    const address = screen.getByLabelText("Endereço");
    const postalCode = screen.getByLabelText(/CEP/);

    expect(whatsapp.value).toBe("(62) 99999-9999");
    expect(screen.getByTestId("public-address-hint").textContent)
      .toContain("app.agendafashion.com.br/negocio/studio-victor");
    expect(screen.getByTestId("public-address-hint").textContent)
      .toContain("Alterar o nome também atualiza este endereço");
    expect(screen.getByRole("button", { name: "Copiar link" })).not.toBeNull();
    expect(screen.getByText("1 selecionada")).not.toBeNull();
    expect(screen.queryByText("Voltar à visão geral")).toBeNull();
    expect(screen.queryByRole("button", { name: "Salvar alterações" })).toBeNull();
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
    fireEvent.change(postalCode, { target: { value: "01001-000" } });

    await waitFor(() => {
      expect(apiRequest).toHaveBeenCalledWith("/cep/01001000", {
        timeoutMs: 6000
      });
      expect(state.value).toBe("SP");
      expect(address.value).toBe("Avenida Brasil");
    });

    const saveButton = screen.getByRole("button", { name: "Salvar alterações" });
    expect(saveButton).not.toBeNull();
    fireEvent.click(saveButton);

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
    expect(request.body).not.toHaveProperty("whatsapp_negocio");

    await waitFor(() => {
      expect(screen.queryByRole("button", { name: "Salvar alterações" })).toBeNull();
    });
  });

  it("preenche o endereço pelo backend ao completar um CEP válido", async () => {
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
        cep: "01001000",
        endereco: "Praça da Sé",
        bairro: "Sé",
        cidade: "São Paulo",
        estado: "SP"
      });

    renderPage();
    const postalCode = await screen.findByLabelText(/CEP/);

    fireEvent.change(postalCode, { target: { value: "01001-000" } });

    await waitFor(() => {
      expect(apiRequest).toHaveBeenCalledWith("/cep/01001000", {
        timeoutMs: 6000
      });
      expect(screen.getByLabelText("Endereço").value).toBe("Praça da Sé");
      expect(screen.getByLabelText("Bairro").value).toBe("Sé");
      expect(screen.getByLabelText("Cidade").value).toBe("São Paulo");
      expect(screen.getByRole("combobox", { name: "Estado" }).value).toBe("SP");
    });

    expect(screen.getByText(/Endereço encontrado/)).not.toBeNull();
    expect(screen.getByLabelText("Número").value).toBe("10");
    expect(screen.getByLabelText("Complemento").value).toBe("Sala 2");
  });

  it("consulta automaticamente um CEP salvo quando a rua ainda está vazia", async () => {
    apiRequest
      .mockResolvedValueOnce({
        negocio: {
          ...BUSINESS,
          cep: "74981100",
          endereco: "",
          bairro: "Araguaia",
          cidade: "Aparecida de Goiânia",
          estado: "GO"
        },
        publicacao: {
          publicado: false,
          pode_publicar: true,
          pendencias: []
        }
      })
      .mockResolvedValueOnce({
        cep: "74981100",
        endereco: "Rua 10",
        bairro: "Araguaia Acréscimo",
        cidade: "Aparecida de Goiânia",
        estado: "GO"
      });

    renderPage();

    expect(await screen.findByDisplayValue("Rua 10")).not.toBeNull();
    expect(apiRequest).toHaveBeenCalledWith("/cep/74981100", {
      timeoutMs: 6000
    });
    expect(screen.getByLabelText("Número").value).toBe("10");
    expect(screen.getByLabelText("Complemento").value).toBe("Sala 2");
  });

  it("informa quando o CEP não é encontrado sem apagar o endereço atual", async () => {
    apiRequest
      .mockResolvedValueOnce({
        negocio: BUSINESS,
        publicacao: {
          publicado: false,
          pode_publicar: true,
          pendencias: []
        }
      })
      .mockRejectedValueOnce(new Error("CEP não encontrado."));

    renderPage();
    const postalCode = await screen.findByLabelText(/CEP/);
    fireEvent.change(postalCode, { target: { value: "00000-000" } });

    expect(await screen.findByText(/CEP não encontrado/)).not.toBeNull();
    expect(screen.getByLabelText("Endereço").value).toBe("Rua das Flores");
    expect(screen.getByLabelText("Cidade").value).toBe("Goiânia");
  });

  it("valida WhatsApp e link do Google Maps antes de salvar", async () => {
    apiRequest.mockResolvedValueOnce({
      negocio: BUSINESS,
      publicacao: {
        publicado: false,
        pode_publicar: true,
        pendencias: []
      }
    });

    renderPage();
    const whatsapp = await screen.findByLabelText(/WhatsApp/);
    const maps = screen.getByLabelText(/Link do Google Maps/);

    fireEvent.change(whatsapp, { target: { value: "123" } });
    expect(screen.getByText(/WhatsApp com DDD/)).not.toBeNull();

    fireEvent.change(whatsapp, { target: { value: "11 98765-4321" } });
    fireEvent.change(maps, { target: { value: "https://example.com/local" } });
    expect(screen.getByText("Use um link válido do Google Maps.")).not.toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Salvar alterações" }));
    expect(await screen.findByRole("alert")).not.toBeNull();
    expect(apiRequest).toHaveBeenCalledTimes(1);
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
        pendencias: ["cidade", "pelo menos um serviço ativo"]
      }
    });

    renderPage();

    expect(await screen.findByText(/Falta completar: cidade, pelo menos um serviço ativo/)).not.toBeNull();
    expect(screen.getByLabelText(/Descrição \(opcional\)/)).not.toBeNull();
    expect(screen.getByText(/não impede a criação nem a publicação/)).not.toBeNull();
    expect(screen.getByRole("button", { name: "Publicar meu negócio" }).disabled).toBe(true);
    expect(apiRequest).toHaveBeenCalledTimes(1);
  });
});
