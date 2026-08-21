// @vitest-environment jsdom

import {
  cleanup,
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

function renderExplore(pathname = "/") {
  return render(
    <MemoryRouter initialEntries={[pathname]}>
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

  it("envia ao backend a busca recebida pelo cabeçalho", async () => {
    apiRequest.mockResolvedValue({
      negocios: [],
      paginacao: { total: 0, tem_mais: false }
    });

    renderExplore("/?busca=cílios");

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

  it("filtra serviços pela nova categoria Bronzeamento", async () => {
    const user = userEvent.setup();

    apiRequest
      .mockResolvedValueOnce({
        negocios: [],
        paginacao: { total: 0, tem_mais: false }
      })
      .mockResolvedValueOnce({
        negocios: [{
          id: 4,
          nome: "Sol e Cor",
          slug: "sol-e-cor",
          servicos: [{
            id: 41,
            nome: "Bronzeamento 40 min",
            categoria: "bronzeamento",
            valor: 99,
            duracao_minutos: 40
          }]
        }],
        paginacao: { total: 1, tem_mais: false }
      });

    renderExplore();
    await waitFor(() =>
      expect(apiRequest).toHaveBeenCalledTimes(1)
    );

    await user.click(screen.getByRole("button", {
      name: "Bronzeamento"
    }));

    expect(await screen.findByRole("heading", {
      name: "Bronzeamento 40 min"
    })).not.toBeNull();
    expect(apiRequest).toHaveBeenLastCalledWith(
      expect.stringContaining("categoria=bronzeamento"),
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
      name: "Perto de você"
    })).not.toBeNull();
    expect(screen.getByText(
      "Nenhum negócio encontrado"
    )).not.toBeNull();
  });

  it("apresenta o destaque do protótipo sem busca dentro do banner", async () => {
    apiRequest.mockResolvedValue({
      negocios: [],
      paginacao: { total: 0, tem_mais: false }
    });

    renderExplore();

    expect(screen.getByRole("heading", {
      name: "Beleza perto de você"
    })).not.toBeNull();
    expect(screen.getByRole("region", {
      name: "Categorias em destaque"
    })).not.toBeNull();
    expect(screen.queryByRole("searchbox")).toBeNull();
    expect(screen.getByRole("button", {
      name: "Próximo destaque"
    })).not.toBeNull();
    expect(screen.getAllByRole("button", {
      name: /Mostrar destaque/
    })).toHaveLength(7);
  });

  it("usa fotos próprias como fallback nas sete categorias", async () => {
    apiRequest.mockResolvedValue({
      negocios: [],
      paginacao: { total: 0, tem_mais: false }
    });

    const { container } = renderExplore();

    await screen.findByText("Nenhum serviço encontrado");

    expect(container.querySelectorAll(
      ".home-category-visual img"
    )).toHaveLength(7);
    expect(container.querySelector(
      ".home-category-emoji"
    )).toBeNull();
    expect(screen.queryByRole("button", {
      name: "Ver todos"
    })).toBeNull();
  });

  it("mantém as imagens aprovadas mesmo quando o catálogo possui outra foto", async () => {
    apiRequest.mockResolvedValue({
      negocios: [{
        ...business(1, "Studio Um"),
        servicos: [{
          id: 11,
          nome: "Esmaltação",
          categoria: "unha",
          foto_url: "/uploads/foto-do-catalogo.jpg",
          valor: 45
        }]
      }],
      paginacao: { total: 1, tem_mais: false }
    });

    renderExplore();

    expect(await screen.findByRole("heading", { name: "Esmaltação" }))
      .not.toBeNull();
    expect(screen.getByRole("button", { name: "Unhas" })
      .querySelector("img")?.getAttribute("src"))
      .toContain("unhas-card");
  });

  it("permite passar o banner principal para o lado", async () => {
    const user = userEvent.setup();

    apiRequest.mockResolvedValue({
      negocios: [],
      paginacao: { total: 0, tem_mais: false }
    });

    renderExplore();

    await user.click(screen.getByRole("button", {
      name: "Próximo destaque"
    }));

    expect(screen.getByRole("heading", {
      name: "Unhas do seu jeito"
    })).not.toBeNull();
    expect(screen.getByRole("button", {
      name: "Mostrar destaque 2: Unhas do seu jeito"
    }).getAttribute("aria-pressed")).toBe("true");
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

  it("organiza serviços em vitrines navegáveis sem filtros extras", async () => {
    apiRequest.mockResolvedValue({
      negocios: [{
        ...business(1, "Studio Um"),
        cidade: "Goiânia",
        servicos: [
          {
            id: 11,
            nome: "Esmaltação",
            categoria: "unha",
            valor: 45
          },
          {
            id: 12,
            nome: "Alongamento",
            categoria: "unha",
            valor: 180
          }
        ]
      }],
      paginacao: { total: 1, tem_mais: false }
    });

    const { container } = renderExplore();

    expect(await screen.findByRole("heading", { name: "Esmaltação" }))
      .not.toBeNull();
    expect(container.querySelector(".service-rail-track")).not.toBeNull();
    expect(screen.queryByText("2 opções")).toBeNull();
    expect(screen.queryByText("Deslize →")).toBeNull();
    expect(screen.getByRole("heading", { name: "Alongamento" })).not.toBeNull();
    expect(screen.queryByText("Agenda online")).toBeNull();
    expect(screen.queryByRole("combobox")).toBeNull();
    expect(screen.queryByRole("button", { name: "Usar localização" })).toBeNull();
  });

  it("usa alfinetes na seção e na cidade próxima", async () => {
    apiRequest.mockResolvedValue({
      negocios: [{
        ...business(1, "Studio Um"),
        cidade: "Rio de Janeiro",
        estado: "RJ"
      }],
      paginacao: { total: 1, tem_mais: false }
    });

    const { container } = renderExplore();

    await screen.findAllByText("Rio de Janeiro, RJ");
    expect(container.querySelector(".home-title-with-icon")?.textContent)
      .toContain("📍Perto de você");
    expect(container.querySelector(".home-location-pill")?.textContent)
      .toContain("📍Rio de Janeiro, RJ");
  });
});
