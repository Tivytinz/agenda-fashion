// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { apiRequest } from "../api/client";
import { ServicesPage, ServiceEditorPage } from "./ServicesPage";

vi.mock("../api/client", () => ({
  apiRequest: vi.fn()
}));

function renderEditor(entry = "/painel/servicos/novo") {
  return render(
    <MemoryRouter initialEntries={[entry]}>
      <Routes>
        <Route path="/painel/servicos/novo" element={<ServiceEditorPage />} />
        <Route path="/painel/servicos/:id/editar" element={<ServiceEditorPage />} />
        <Route path="/painel/servicos" element={<h1>Lista de serviços</h1>} />
        <Route path="/painel" element={<h1>Visão geral publicada</h1>} />
      </Routes>
    </MemoryRouter>
  );
}

function renderServices(entry = "/painel/servicos") {
  return render(
    <MemoryRouter initialEntries={[entry]}>
      <Routes>
        <Route path="/painel/servicos" element={<ServicesPage />} />
      </Routes>
    </MemoryRouter>
  );
}

function fillService() {
  fireEvent.change(screen.getByRole("textbox", { name: "Nome do serviço" }), {
    target: { value: "Manicure tradicional" }
  });
  fireEvent.change(screen.getByRole("spinbutton", { name: "Valor" }), {
    target: { value: "50" }
  });
  fireEvent.change(screen.getByRole("combobox", { name: /Categoria/ }), {
    target: { value: "unha" }
  });
}

function submit() {
  fireEvent.submit(screen.getByRole("button", { name: "Salvar serviço" }).closest("form"));
}

beforeEach(() => {
  apiRequest.mockReset();
  HTMLDialogElement.prototype.showModal = function showModal() {
    this.setAttribute("open", "");
  };
  HTMLDialogElement.prototype.close = function close() {
    this.removeAttribute("open");
  };
  Object.defineProperty(URL, "createObjectURL", {
    configurable: true,
    value: vi.fn(() => "blob:preview")
  });
  Object.defineProperty(URL, "revokeObjectURL", {
    configurable: true,
    value: vi.fn()
  });
});

afterEach(() => {
  vi.restoreAllMocks();
  cleanup();
});

describe("editor de serviços", () => {
  it("oferece e envia a categoria Bronzeamento", async () => {
    apiRequest.mockResolvedValueOnce({
      servico: { id: 32, categoria: "bronzeamento" }
    });

    renderEditor();
    fireEvent.change(screen.getByRole("textbox", { name: "Nome do serviço" }), {
      target: { value: "Bronzeamento 40 min" }
    });
    fireEvent.change(screen.getByRole("spinbutton", { name: "Valor" }), {
      target: { value: "99" }
    });
    fireEvent.change(screen.getByRole("combobox", { name: /Categoria/ }), {
      target: { value: "bronzeamento" }
    });
    submit();

    await waitFor(() => {
      expect(apiRequest).toHaveBeenCalledWith(
        "/servicos",
        expect.objectContaining({
          method: "POST",
          body: expect.objectContaining({
            categoria: "bronzeamento"
          })
        })
      );
    });
  });

  it("reutiliza o serviço criado quando o upload da capa falha", async () => {
    const cover = new File(["cover"], "capa.jpg", { type: "image/jpeg" });
    apiRequest
      .mockResolvedValueOnce({ servico: { id: 33 } })
      .mockRejectedValueOnce(new Error("Falha no upload"))
      .mockResolvedValueOnce({ servico: { id: 33 } })
      .mockResolvedValueOnce({ foto_url: "https://img/capa.jpg" });

    renderEditor();
    fillService();
    fireEvent.change(screen.getByLabelText("Escolher capa"), {
      target: { files: [cover] }
    });
    submit();

    expect((await screen.findByRole("alert")).textContent).toContain("O serviço foi salvo");
    submit();

    expect(await screen.findByRole("heading", { name: "Lista de serviços" })).not.toBeNull();
    expect(apiRequest.mock.calls.filter(([path, options]) => path === "/servicos" && options?.method === "POST")).toHaveLength(1);
    expect(apiRequest).toHaveBeenCalledWith("/servicos", expect.objectContaining({
      body: expect.objectContaining({ categoria: "unha" })
    }));
    expect(apiRequest).toHaveBeenCalledWith("/servicos/33", expect.objectContaining({ method: "PUT" }));
  });

  it("não reenvia fotos da galeria que já foram concluídas", async () => {
    const first = new File(["one"], "primeira.jpg", { type: "image/jpeg" });
    const second = new File(["two"], "segunda.jpg", { type: "image/jpeg" });
    apiRequest
      .mockResolvedValueOnce({ servico: { id: 44 } })
      .mockResolvedValueOnce({ foto: { id: 1 } })
      .mockRejectedValueOnce(new Error("Falha na segunda foto"))
      .mockResolvedValueOnce({ servico: { id: 44 } })
      .mockResolvedValueOnce({ foto: { id: 2 } });

    renderEditor();
    fillService();
    fireEvent.change(screen.getByLabelText(/Adicionar fotos à galeria/), {
      target: { files: [first, second] }
    });
    submit();

    expect((await screen.findByRole("alert")).textContent).toContain("algumas fotos não foram enviadas");
    expect(screen.getByText("1 foto selecionada.")).not.toBeNull();
    submit();

    expect(await screen.findByRole("heading", { name: "Lista de serviços" })).not.toBeNull();
    const galleryUploads = apiRequest.mock.calls.filter(([path]) => path === "/servicos/44/fotos");
    expect(galleryUploads).toHaveLength(3);
    expect(galleryUploads[2][1].body.get("foto").name).toBe("segunda.jpg");
    await waitFor(() => expect(apiRequest).toHaveBeenCalledTimes(5));
  });

  it("permite navegar pela galeria e escolher uma foto existente como capa", async () => {
    apiRequest.mockImplementation((path, options = {}) => {
      if (path === "/servicos") {
        return Promise.resolve({
          servicos: [{
            id: 9,
            nome: "Extensão de Cílios",
            categoria: "cilio",
            valor: 100,
            duracao_minutos: 120,
            ativo: true,
            foto_url: "https://img/cilios-1.jpg",
            foto_public_id: "galeria/cilios-1"
          }]
        });
      }
      if (path === "/servicos/9/fotos") {
        return Promise.resolve({
          fotos: [
            { id: 1, foto_url: "https://img/cilios-1.jpg", foto_public_id: "galeria/cilios-1" },
            { id: 2, foto_url: "https://img/cilios-2.jpg", foto_public_id: "galeria/cilios-2" }
          ]
        });
      }
      if (path === "/servicos/9/capa" && options.method === "PUT") {
        return Promise.resolve({
          servico: {
            id: 9,
            foto_url: "https://img/cilios-2.jpg",
            foto_public_id: "galeria/cilios-2"
          }
        });
      }
      return Promise.reject(new Error(`Rota inesperada: ${path}`));
    });

    renderEditor("/painel/servicos/9/editar");

    expect(await screen.findByText("Capa atual")).not.toBeNull();
    expect(screen.getByText("2 fotos")).not.toBeNull();
    expect(screen.getByRole("button", { name: "Fotos anteriores" })).not.toBeNull();
    expect(screen.getByRole("button", { name: "Próximas fotos" })).not.toBeNull();
    expect(screen.getAllByRole("button", { name: "Remover foto da galeria" })).toHaveLength(2);

    const choose = screen.getByRole("button", { name: "Usar como capa" });
    fireEvent.click(choose);

    await waitFor(() => expect(apiRequest).toHaveBeenCalledWith(
      "/servicos/9/capa",
      {
        method: "PUT",
        body: { foto_id: 2 }
      }
    ));
    expect((await screen.findByRole("status")).textContent).toContain("Foto escolhida como capa");
    expect(screen.getByRole("img", { name: "Capa atual do serviço Extensão de Cílios" }).src)
      .toContain("cilios-2.jpg");
  });

  it("usa um seletor visual para adicionar fotos sem expor o campo nativo", () => {
    renderEditor();

    const input = screen.getByLabelText("Adicionar fotos à galeria");
    expect(input.classList.contains("sr-only")).toBe(true);
    expect(screen.getByText("Adicionar fotos")).not.toBeNull();
  });

  it("conclui o onboarding quando o primeiro serviço publica o negócio", async () => {
    apiRequest.mockResolvedValueOnce({
      servico: { id: 55 },
      publicacao: { publicado: true }
    });

    renderEditor({
      pathname: "/painel/servicos/novo",
      state: { onboarding: true, onboardingStep: "servico" }
    });
    fillService();
    submit();

    expect(await screen.findByRole("heading", { name: "Visão geral publicada" }))
      .not.toBeNull();
  });
});

describe("lista profissional de serviços", () => {
  it("mostra a falha de remoção dentro do diálogo", async () => {
    apiRequest.mockImplementation((path, options = {}) => {
      if (path === "/servicos" && !options.method) {
        return Promise.resolve({
          servicos: [{
            id: 8,
            nome: "Design com henna",
            categoria: "sobrancelha",
            duracao_minutos: 50,
            valor: 55,
            ativo: true
          }]
        });
      }
      if (path === "/minha-assinatura") {
        return Promise.resolve({
          uso: { limite_servicos: 2, servicos_utilizados: 1 }
        });
      }
      if (path === "/servicos/8" && options.method === "DELETE") {
        return Promise.reject(new Error("Não foi possível remover o serviço"));
      }
      return Promise.reject(new Error(`Rota inesperada: ${path}`));
    });

    renderServices();
    fireEvent.click(await screen.findByRole("button", { name: "Remover" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "Sim, remover" })).not.toBeNull());
    fireEvent.click(screen.getByRole("button", { name: "Sim, remover" }));

    const alert = await screen.findByRole("alert");
    expect(alert.closest("dialog")).not.toBeNull();
    expect(alert.textContent).toContain("Não foi possível remover o serviço");
  });

  it("mostra a confirmação recebida após salvar um serviço", async () => {
    apiRequest.mockResolvedValueOnce({ servicos: [] });

    renderServices({
      pathname: "/painel/servicos",
      state: { message: "Serviço criado." }
    });

    expect((await screen.findByRole("status")).textContent).toContain("Serviço criado.");
  });

  it("resolve caminhos relativos de capa com o mesmo tratamento do catálogo", async () => {
    apiRequest.mockResolvedValueOnce({
      servicos: [{
        id: 8,
        nome: "Design com henna",
        categoria: "sobrancelha",
        foto_url: "/uploads/design.jpg",
        duracao_minutos: 50,
        valor: 55,
        ativo: true
      }]
    });

    renderServices();

    expect((await screen.findByRole("img", {
      name: "Capa do serviço Design com henna"
    })).src).toContain("/uploads/design.jpg");
  });

  it("permite trocar quais dois serviços ficam ativos no plano limitado", async () => {
    const services = [
      { id: 1, nome: "Manicure", categoria: "unha", duracao_minutos: 60, valor: 50, ativo: true },
      { id: 2, nome: "Pedicure", categoria: "unha", duracao_minutos: 60, valor: 55, ativo: true },
      { id: 3, nome: "Spa dos pés", categoria: "unha", duracao_minutos: 45, valor: 45, ativo: false }
    ];

    apiRequest.mockImplementation((path, options = {}) => {
      if (path === "/servicos" && !options.method) {
        return Promise.resolve({ servicos });
      }
      if (path === "/minha-assinatura") {
        return Promise.resolve({
          uso: { limite_servicos: 2, servicos_utilizados: 2 }
        });
      }
      if (path === "/servicos/1/ativo" && options.method === "PATCH") {
        return Promise.resolve({
          mensagem: "Serviço desativado e oculto para novas clientes.",
          servico: { ...services[0], ativo: false }
        });
      }
      if (path === "/servicos/3/ativo" && options.method === "PATCH") {
        return Promise.resolve({
          mensagem: "Serviço ativado e visível para novas clientes.",
          servico: { ...services[2], ativo: true }
        });
      }
      return Promise.reject(new Error(`Rota inesperada: ${path}`));
    });

    renderServices();

    expect(await screen.findByText("2 de 2 serviços ativos")).not.toBeNull();
    const activate = screen.getByRole("button", { name: "Ativar no perfil" });
    expect(activate.disabled).toBe(true);

    fireEvent.click(screen.getAllByRole("button", { name: "Ocultar do perfil" })[0]);

    await waitFor(() => {
      expect(screen.getByText("1 de 2 serviços ativos")).not.toBeNull();
      expect(screen.getByRole("button", { name: "Ativar no perfil" }).disabled).toBe(false);
    });

    fireEvent.click(screen.getByRole("button", { name: "Ativar no perfil" }));

    await waitFor(() => {
      expect(apiRequest).toHaveBeenCalledWith(
        "/servicos/3/ativo",
        {
          method: "PATCH",
          body: { ativo: true }
        }
      );
      expect(screen.getByText("2 de 2 serviços ativos")).not.toBeNull();
    });
  });
});