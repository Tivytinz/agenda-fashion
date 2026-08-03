// @vitest-environment jsdom

import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi
} from "vitest";
import { apiRequest } from "../api/client";
import {
  buildCatalogPath,
  ExplorePage
} from "./ExplorePage";

vi.mock("../api/client", () => ({
  apiRequest: vi.fn()
}));

vi.mock("../analytics/track", () => ({
  track: vi.fn()
}));

function business(id, name) {
  return {
    id,
    nome: name,
    slug: name.toLowerCase().replaceAll(" ", "-"),
    servicos: [
      {
        id: id * 10,
        nome: `Serviço ${name}`,
        valor: 50,
        duracao_minutos: 60
      }
    ]
  };
}

function renderExplore() {
  return render(
    <MemoryRouter>
      <ExplorePage />
    </MemoryRouter>
  );
}

beforeEach(() => {
  apiRequest.mockReset();
});

afterEach(cleanup);

describe("catálogo público paginado", () => {
  it("monta a URL sem enviar parâmetros vazios", () => {
    expect(buildCatalogPath({
      query: "  manicure  ",
      category: "unha",
      page: 2
    })).toBe(
      "/negocios-publicos?pagina=2&limite=12&busca=manicure&categoria=unha"
    );
  });

  it("acrescenta a próxima página ao clicar em Carregar mais", async () => {
    const user = userEvent.setup();

    apiRequest
      .mockResolvedValueOnce({
        negocios: [business(1, "Studio Um")],
        paginacao: { total: 2, tem_mais: true }
      })
      .mockResolvedValueOnce({
        negocios: [business(2, "Studio Dois")],
        paginacao: { total: 2, tem_mais: false }
      });

    renderExplore();

    expect(await screen.findByRole("heading", {
      name: "Studio Um"
    })).not.toBeNull();

    await user.click(screen.getByRole("button", {
      name: "Carregar mais"
    }));

    expect(await screen.findByRole("heading", {
      name: "Studio Dois"
    })).not.toBeNull();
    expect(apiRequest.mock.calls[1][0])
      .toContain("pagina=2");
    expect(screen.queryByRole("button", {
      name: "Carregar mais"
    })).toBeNull();
  });

  it("envia a busca ao backend depois da digitação", async () => {
    apiRequest.mockResolvedValue({
      negocios: [],
      paginacao: { total: 0, tem_mais: false }
    });

    renderExplore();
    await waitFor(() =>
      expect(apiRequest).toHaveBeenCalledTimes(1)
    );

    fireEvent.change(screen.getByRole("searchbox"), {
      target: { value: "cílios" }
    });

    await waitFor(() => {
      expect(apiRequest).toHaveBeenLastCalledWith(
        expect.stringContaining("busca=c%C3%ADlios"),
        expect.objectContaining({ signal: expect.any(AbortSignal) })
      );
    }, { timeout: 1000 });
  });

  it("mostra Manicure ao selecionar a categoria Unhas", async () => {
    const user = userEvent.setup();

    apiRequest
      .mockResolvedValueOnce({
        negocios: [],
        paginacao: { total: 0, tem_mais: false }
      })
      .mockResolvedValueOnce({
        negocios: [{
          id: 3,
          nome: "Studio Manicure",
          slug: "studio-manicure",
          servicos: [{
            id: 31,
            nome: "Manicure tradicional",
            valor: 45,
            duracao_minutos: 50
          }]
        }],
        paginacao: { total: 1, tem_mais: false }
      });

    renderExplore();
    await waitFor(() =>
      expect(apiRequest).toHaveBeenCalledTimes(1)
    );

    await user.click(screen.getByRole("button", {
      name: "Unhas"
    }));

    expect(await screen.findByRole("heading", {
      name: "Manicure tradicional"
    })).not.toBeNull();
    expect(apiRequest).toHaveBeenLastCalledWith(
      expect.stringContaining("categoria=unha"),
      expect.objectContaining({ signal: expect.any(AbortSignal) })
    );
  });

  it("mantém as seções visíveis quando o catálogo está vazio", async () => {
    apiRequest.mockResolvedValue({
      negocios: [],
      paginacao: { total: 0, tem_mais: false }
    });

    renderExplore();

    expect(await screen.findByText(
      "Nenhum serviço encontrado"
    )).not.toBeNull();
    expect(screen.getByRole("heading", {
      name: "Negócios e profissionais"
    })).not.toBeNull();
    expect(screen.getByText(
      "Nenhum negócio encontrado"
    )).not.toBeNull();
  });
});
