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
  distanceInKm,
  diversifyServices,
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

  it("envia a cidade como filtro dedicado", () => {
    expect(buildCatalogPath({ city: "Goiânia" }))
      .toContain("cidade=Goi%C3%A2nia");
  });

  it("calcula distância somente quando existem coordenadas válidas", () => {
    expect(distanceInKm(
      { latitude: -23.5505, longitude: -46.6333 },
      { latitude: -23.5505, longitude: -46.6333 }
    )).toBe(0);
    expect(distanceInKm(
      { latitude: null, longitude: null },
      { latitude: -23.5505, longitude: -46.6333 }
    )).toBeNull();
  });

  it("alterna serviços de negócios diferentes antes de repetir", () => {
    const diversified = diversifyServices([
      { id: 1, negocio_id: 1 },
      { id: 2, negocio_id: 1 },
      { id: 3, negocio_id: 2 }
    ]);

    expect(diversified.map((service) => service.id)).toEqual([1, 3, 2]);
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

  it("não mostra contadores redundantes acima dos catálogos", async () => {
    apiRequest.mockResolvedValue({
      negocios: [business(1, "Studio Um")],
      paginacao: { total: 1, tem_mais: false }
    });

    renderExplore();

    expect(await screen.findByRole("heading", {
      name: "Studio Um"
    })).not.toBeNull();
    expect(screen.queryByText(/serviço exibido/i)).toBeNull();
    expect(screen.queryByText(/opção encontrada/i)).toBeNull();
  });

  it("filtra por preço e organiza serviços em vitrines navegáveis", async () => {
    const user = userEvent.setup();

    apiRequest.mockResolvedValue({
      negocios: [{
        ...business(1, "Studio Um"),
        cidade: "Goiânia",
        servicos: [
          {
            id: 11,
            nome: "Esmaltação",
            categoria: "unha",
            valor: 45,
            agenda_online: true
          },
          {
            id: 12,
            nome: "Alongamento",
            categoria: "unha",
            valor: 180,
            agenda_online: false
          }
        ]
      }],
      paginacao: { total: 1, tem_mais: false }
    });

    const { container } = renderExplore();

    expect(await screen.findByRole("heading", { name: "Esmaltação" }))
      .not.toBeNull();
    expect(container.querySelector(".service-rail-track")).not.toBeNull();

    await user.selectOptions(
      screen.getByRole("combobox", { name: "Preço máximo" }),
      "50"
    );

    expect(screen.queryByRole("heading", { name: "Alongamento" })).toBeNull();
    expect(screen.getByText("Agenda online")).not.toBeNull();
  });

  it("ordena por proximidade depois da autorização da cliente", async () => {
    const user = userEvent.setup();
    const getCurrentPosition = vi.fn((success) => success({
      coords: { latitude: -23.55, longitude: -46.63 }
    }));

    Object.defineProperty(navigator, "geolocation", {
      configurable: true,
      value: { getCurrentPosition }
    });

    apiRequest.mockResolvedValue({
      negocios: [{
        ...business(1, "Studio Um"),
        cidade: "São Paulo",
        latitude: -23.55,
        longitude: -46.63
      }],
      paginacao: { total: 1, tem_mais: false }
    });

    renderExplore();
    await screen.findByRole("heading", { name: "Studio Um" });
    await user.click(screen.getByRole("button", { name: "Usar localização" }));

    expect(getCurrentPosition).toHaveBeenCalledTimes(1);
    expect(await screen.findByText("Resultados ordenados por proximidade."))
      .not.toBeNull();
    expect(screen.getByRole("combobox", { name: "Ordenar resultados" }).value)
      .toBe("distance");
  });
});
