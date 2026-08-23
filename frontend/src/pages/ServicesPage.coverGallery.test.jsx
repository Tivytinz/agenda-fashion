// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { apiRequest } from "../api/client";
import { ServiceEditorPage, ServicesPage } from "./ServicesPage";

vi.mock("../api/client", () => ({
  apiRequest: vi.fn()
}));

function renderEditor() {
  return render(
    <MemoryRouter initialEntries={["/painel/servicos/9/editar"]}>
      <Routes>
        <Route path="/painel/servicos/:id/editar" element={<ServiceEditorPage />} />
      </Routes>
    </MemoryRouter>
  );
}

function renderServices() {
  return render(
    <MemoryRouter initialEntries={["/painel/servicos"]}>
      <Routes>
        <Route path="/painel/servicos" element={<ServicesPage />} />
      </Routes>
    </MemoryRouter>
  );
}

beforeEach(() => {
  apiRequest.mockReset();
});

afterEach(() => {
  vi.restoreAllMocks();
  cleanup();
});

describe("capa integrada à galeria do serviço", () => {
  it("mostra a capa separada como primeiro item visual sem permitir removê-la pela galeria", async () => {
    apiRequest.mockImplementation((path) => {
      if (path === "/servicos") {
        return Promise.resolve({
          servicos: [{
            id: 9,
            nome: "Design + Henna",
            categoria: "sobrancelha",
            valor: 40,
            duracao_minutos: 60,
            ativo: true,
            foto_url: "https://img/capa-principal.jpg",
            foto_public_id: "capas/design"
          }]
        });
      }

      if (path === "/servicos/9/fotos") {
        return Promise.resolve({
          fotos: [
            { id: 21, foto_url: "https://img/galeria-1.jpg", foto_public_id: "galeria/1" },
            { id: 22, foto_url: "https://img/galeria-2.jpg", foto_public_id: "galeria/2" }
          ]
        });
      }

      return Promise.reject(new Error(`Rota inesperada: ${path}`));
    });

    renderEditor();

    expect(await screen.findByText("3 fotos")).not.toBeNull();
    expect(screen.getByText("Capa atual")).not.toBeNull();
    expect(screen.getAllByRole("button", { name: "Remover foto da galeria" })).toHaveLength(2);
  });

  it("oferece adicionar foto direto no card quando o serviço ainda não tem capa", async () => {
    apiRequest.mockResolvedValueOnce({
      servicos: [{
        id: 11,
        nome: "Extensão de Cílios",
        categoria: "cilio",
        valor: 100,
        duracao_minutos: 120,
        ativo: true,
        foto_url: ""
      }]
    });

    renderServices();

    const action = await screen.findByRole("link", { name: "Adicionar foto" });
    expect(action.getAttribute("href")).toContain("/painel/servicos/11/editar");
    expect(screen.queryByText("Voltar à visão geral")).toBeNull();
  });
});
