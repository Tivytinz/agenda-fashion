// @vitest-environment jsdom

import {
  act,
  fireEvent,
  cleanup,
  render,
  screen,
  waitFor
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { StrictMode } from "react";
import { MemoryRouter, useLocation, useNavigate } from "react-router-dom";
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi
} from "vitest";
import { HomePage } from "./HomePage";
import { apiRequest } from "../api/client";
import {
  buildCatalogPath,
  diversifyServices,
  ExplorePage
} from "./ExplorePage";

vi.mock("../api/client", () => ({
  apiRequest: vi.fn()
}));

vi.mock("../analytics/trackEvent", () => ({
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

function NavigationProbe() {
  const location = useLocation();
  const navigate = useNavigate();
  return <>
    <output data-testid="location">{location.search}</output>
    <button onClick={() => navigate(-1)}>Voltar no histórico</button>
    <button onClick={() => navigate(1)}>Avançar no histórico</button>
  </>;
}

function renderExplore(pathname = "/") {
  return render(
    <MemoryRouter initialEntries={[pathname]}>
      <ExplorePage />
      <NavigationProbe />
    </MemoryRouter>
  );
}

beforeEach(() => {
  apiRequest.mockReset();
  window.localStorage.clear();
});

afterEach(cleanup);

describe("catálogo público paginado", () => {
  it.each(["manicure GO", "manicure acolhimento", "manicure cabelo"])(
    "mantém serviços relevantes ao combinar nome com contexto do negócio: %s",
    async (query) => {
      apiRequest.mockResolvedValue({
        negocios: [{
          ...business(1, "Studio Aurora"),
          cidade: "Anápolis",
          estado: "GO",
          descricao: "Acolhimento em cada atendimento",
          areas: ["unha", "cabelo"],
          servicos: [
            { id: 11, nome: "Manicure tradicional", categoria: "unha", valor: 45 },
            { id: 12, nome: "Corte", categoria: "cabelo", valor: 70 }
          ]
        }],
        paginacao: { tem_mais: false }
      });
      renderExplore(`/?busca=${encodeURIComponent(query)}`);
      expect(await screen.findByRole("heading", { name: "Manicure tradicional" })).not.toBeNull();
      expect(screen.queryByRole("heading", { name: "Corte" })).toBeNull();
    }
  );

  it("mantém a localização acessível durante carregamento", () => {
    apiRequest.mockReturnValue(new Promise(() => {}));
    renderExplore("/?cidade=An%C3%A1polis&estado=GO");
    expect(screen.getByRole("combobox", { name: "Escolher localização" }).value)
      .toBe("Anápolis::GO");
    expect(screen.getByRole("button", { name: "Limpar filtros" })).not.toBeNull();
  });

  it("permite limpar os filtros para recuperar uma consulta que falhou", async () => {
    const user = userEvent.setup();
    apiRequest.mockRejectedValueOnce(new Error("Falha no catálogo"))
      .mockResolvedValue({ negocios: [], paginacao: { tem_mais: false } });
    renderExplore("/?cidade=An%C3%A1polis&estado=GO&categoria=unha&busca=manicure&utm_source=teste");
    await screen.findByText("Falha no catálogo");
    expect(screen.getByRole("combobox", { name: "Escolher localização" }).value)
      .toBe("Anápolis::GO");
    await user.click(screen.getByRole("button", { name: "Limpar filtros" }));
    await screen.findByText("Nenhum serviço encontrado");
    expect(screen.getByTestId("location").textContent).toBe("?utm_source=teste");
    expect(window.localStorage.getItem("af_catalog_location")).toBeNull();
    expect(apiRequest).toHaveBeenLastCalledWith(
      "/negocios-publicos?pagina=1&limite=12", expect.any(Object)
    );
  });

  it("restaura a cidade lembrada na URL em StrictMode e permite removê-la", async () => {
    const user = userEvent.setup();
    window.localStorage.setItem("af_catalog_location", "Anápolis::GO");
    apiRequest.mockResolvedValue({ negocios: [], paginacao: { tem_mais: false } });
    render(
      <StrictMode>
        <MemoryRouter initialEntries={["/?categoria=unha"]}>
          <ExplorePage />
          <NavigationProbe />
        </MemoryRouter>
      </StrictMode>
    );
    await screen.findByText("Nenhum serviço encontrado");
    const params = new URLSearchParams(screen.getByTestId("location").textContent);
    expect(params.get("cidade")).toBe("Anápolis");
    expect(params.get("estado")).toBe("GO");
    expect(params.get("categoria")).toBe("unha");
    expect(window.localStorage.getItem("af_catalog_location")).toBe("Anápolis::GO");
    await user.selectOptions(screen.getByRole("combobox", { name: "Escolher localização" }), "");
    await waitFor(() => expect(apiRequest).toHaveBeenLastCalledWith(
      "/negocios-publicos?pagina=1&limite=12&categoria=unha", expect.any(Object)
    ));
    expect(screen.getByTestId("location").textContent).toBe("?categoria=unha");
    expect(window.localStorage.getItem("af_catalog_location")).toBeNull();
  });

  it("acompanha a localização da URL ao voltar e avançar no histórico", async () => {
    const user = userEvent.setup();
    apiRequest.mockResolvedValue({ negocios: [], paginacao: { tem_mais: false } });
    render(
      <MemoryRouter initialEntries={["/", "/?cidade=An%C3%A1polis&estado=GO"]}>
        <ExplorePage />
        <NavigationProbe />
      </MemoryRouter>
    );
    await screen.findByText("Nenhum serviço encontrado");
    await user.click(screen.getByRole("button", { name: "Voltar no histórico" }));
    expect(screen.getByRole("combobox", { name: "Escolher localização" }).value).toBe("");
    await waitFor(() => expect(apiRequest).toHaveBeenLastCalledWith(
      "/negocios-publicos?pagina=1&limite=12", expect.any(Object)
    ));
    await user.click(screen.getByRole("button", { name: "Avançar no histórico" }));
    expect(screen.getByRole("combobox", { name: "Escolher localização" }).value).toBe("Anápolis::GO");
    await waitFor(() => expect(apiRequest).toHaveBeenLastCalledWith(
      expect.stringContaining("cidade=An%C3%A1polis&estado=GO"), expect.any(Object)
    ));
  });

  it("monta a URL sem enviar parâmetros vazios", () => {
    expect(buildCatalogPath({
      query: "  manicure  ",
      category: "unha",
      page: 2
    })).toBe(
      "/negocios-publicos?pagina=2&limite=12&busca=manicure&categoria=unha"
    );
  });

  it("envia cidade e UF somente quando a localização foi escolhida", () => {
    expect(buildCatalogPath({
      city: " Goiânia ",
      state: "go"
    })).toBe(
      "/negocios-publicos?pagina=1&limite=12&cidade=Goi%C3%A2nia&estado=GO"
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
      .mockImplementation((path) => Promise.resolve(
        String(path).includes("pagina=2")
          ? {
            negocios: [business(2, "Studio Dois")],
            paginacao: { total: 2, tem_mais: false }
          }
          : {
        negocios: [business(1, "Studio Um")],
        paginacao: { total: 2, tem_mais: true }
          }
      ));

    renderExplore();

    expect(await screen.findByRole("heading", {
      name: "Studio Um"
    })).not.toBeNull();

    await user.click(screen.getByRole("button", {
      name: "Carregar mais resultados"
    }));

    expect(await screen.findByRole("heading", {
      name: "Studio Dois"
    })).not.toBeNull();
    expect(apiRequest.mock.calls[1][0])
      .toContain("pagina=2");
    expect(screen.queryByRole("button", {
      name: "Carregar mais resultados"
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
      name: "Espaços e profissionais"
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
      name: "Beleza para você"
    })).not.toBeNull();
    expect(screen.getByRole("region", {
      name: "Categorias em destaque"
    })).not.toBeNull();
    expect(screen.getByRole("searchbox").closest(".home-hero")).toBeNull();
    expect(screen.getByRole("button", {
      name: "Próximo destaque"
    })).not.toBeNull();
    expect(screen.getAllByRole("button", {
      name: /Mostrar destaque/
    })).toHaveLength(7);
  });

  it("prioriza somente a imagem inicial do hero para proteger o LCP", async () => {
    apiRequest.mockResolvedValue({
      negocios: [],
      paginacao: { total: 0, tem_mais: false }
    });

    const { container } = renderExplore();

    await screen.findByText("Nenhum serviço encontrado");

    const heroImages = [
      ...container.querySelectorAll(".home-hero-image")
    ];

    expect(heroImages).toHaveLength(1);
    expect(heroImages[0].getAttribute("loading")).toBe("eager");
    expect(heroImages[0].getAttribute("fetchpriority")).toBe("high");

    fireEvent.click(screen.getByRole("button", { name: "Próximo destaque" }));
    const secondaryImages = [...container.querySelectorAll(".home-hero-image")].slice(1);
    expect(secondaryImages).toHaveLength(1);
    expect(secondaryImages[0].getAttribute("src")).toContain("manicure-hero.webp");
    secondaryImages.forEach((image) => {
      expect(image.getAttribute("loading")).toBe("lazy");
      expect(image.getAttribute("fetchpriority")).toBe("low");
    });
  });

  it("usa ícones nas sete categorias e o emoji próprio de sobrancelhas", async () => {
    apiRequest.mockResolvedValue({
      negocios: [],
      paginacao: { total: 0, tem_mais: false }
    });

    const { container } = renderExplore();

    await screen.findByText("Nenhum serviço encontrado");

    expect(container.querySelectorAll(
      ".home-category-emoji"
    )).toHaveLength(7);
    expect(container.querySelector(
      ".home-category-visual img"
    )).toBeNull();
    expect(container.querySelector(".home-category-emoji")?.textContent)
      .toBe("💅");
    expect(screen.getByRole("button", { name: "Sobrancelhas" })
      .querySelector(".home-category-emoji")
      ?.classList.contains("is-custom-eyebrow")).toBe(true);
    expect(screen.getByRole("button", { name: "Sobrancelhas" })
      .querySelector(".home-category-emoji")
      ?.getAttribute("style")).toContain("sobrancelhas-emoji.png");
    expect(screen.queryByRole("button", {
      name: "Ver todos"
    })).toBeNull();
  });

  it("não substitui o ícone da navegação pela foto de um serviço", async () => {
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
      .querySelector("img")).toBeNull();
    expect(screen.getByRole("button", { name: "Unhas" })
      .querySelector(".home-category-emoji")?.textContent).toBe("💅");
  });

  it("permite passar o banner principal para o lado e pausa a rotação automática", async () => {
    const user = userEvent.setup();

    apiRequest.mockResolvedValue({
      negocios: [],
      paginacao: { total: 0, tem_mais: false }
    });

    renderExplore();

    expect(screen.getByRole("button", {
      name: "Pausar rotação automática dos destaques"
    }).getAttribute("aria-pressed")).toBe("false");

    await user.click(screen.getByRole("button", {
      name: "Próximo destaque"
    }));

    expect(screen.getByRole("heading", {
      name: "Unhas do seu jeito"
    })).not.toBeNull();
    expect(screen.getByRole("button", {
      name: "Mostrar destaque 2: Unhas do seu jeito"
    }).getAttribute("aria-pressed")).toBe("true");
    expect(screen.getByRole("button", {
      name: "Retomar rotação automática dos destaques"
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

  it("mantém as vitrines de serviços na ordem oficial das categorias", async () => {
    apiRequest.mockResolvedValue({
      negocios: [{
        ...business(1, "Studio Um"),
        servicos: [
          { id: 13, nome: "Design", categoria: "sobrancelha", valor: 50 },
          { id: 11, nome: "Manicure", categoria: "unha", valor: 45 },
          { id: 12, nome: "Corte", categoria: "cabelo", valor: 70 }
        ]
      }],
      paginacao: { total: 1, tem_mais: false }
    });

    const { container } = renderExplore();

    await screen.findByRole("heading", { name: "Manicure" });
    expect([...container.querySelectorAll(".service-rail-title")]
      .map((heading) => heading.textContent))
      .toEqual(["Unhas", "Cabelos", "Sobrancelhas"]);
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
    expect(screen.getByRole("combobox", {
      name: "Escolher localização"
    })).not.toBeNull();
    expect(screen.queryByRole("button", { name: "Usar localização" })).toBeNull();
  });

  it("não inventa a localização da cliente com a cidade do primeiro negócio", async () => {
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
      .toContain("📍Espaços e profissionais");
    expect(screen.getByRole("combobox", {
      name: "Escolher localização"
    }).value).toBe("");
    expect(container.querySelector(".home-location-pill")?.textContent)
      .not.toContain("Rio de Janeiro");
    expect(container.querySelector(".home-location-pill")?.textContent)
      .not.toContain("⌄");
  });

  it("filtra por uma cidade escolhida sem fingir detectar a localização", async () => {
    const user = userEvent.setup();

    apiRequest
      .mockResolvedValueOnce({
        negocios: [business(1, "Studio Brasil")],
        localidades: [
          { cidade: "Goiânia", estado: "GO", total_negocios: 1 },
          { cidade: "Rio de Janeiro", estado: "RJ", total_negocios: 1 }
        ],
        paginacao: { total: 1, tem_mais: false }
      })
      .mockResolvedValueOnce({
        negocios: [{
          ...business(2, "Studio Goiânia"),
          cidade: "Goiânia",
          estado: "GO"
        }],
        localidades: [
          { cidade: "Goiânia", estado: "GO", total_negocios: 1 },
          { cidade: "Rio de Janeiro", estado: "RJ", total_negocios: 1 }
        ],
        paginacao: { total: 1, tem_mais: false }
      });

    renderExplore();

    await screen.findByRole("heading", { name: "Studio Brasil" });
    await user.selectOptions(
      screen.getByRole("combobox", { name: "Escolher localização" }),
      "Goiânia::GO"
    );

    expect(await screen.findByRole("heading", {
      name: "Espaços e profissionais em Goiânia"
    })).not.toBeNull();
    await waitFor(() => {
      expect(apiRequest).toHaveBeenLastCalledWith(
        expect.stringContaining("cidade=Goi%C3%A2nia&estado=GO"),
        expect.objectContaining({ signal: expect.any(AbortSignal) })
      );
    });
    expect(window.localStorage.getItem("af_catalog_location"))
      .toBe("Goiânia::GO");
  });

  it("leva o botão Como funciona para uma explicação real", async () => {
    apiRequest.mockResolvedValue({
      negocios: [],
      paginacao: { total: 0, tem_mais: false }
    });

    renderExplore();

    expect(screen.getAllByRole("link", { name: /Como funciona/ })[0]
      .getAttribute("href")).toBe("#como-funciona");
    expect(screen.getByRole("heading", { name: "Como funciona" }))
      .not.toBeNull();
    expect(screen.getByText("Selecione o horário")).not.toBeNull();
  });
});


it("integra cidade no topo e limpeza dos filtros nos resultados durante consulta lenta", async () => {
  apiRequest.mockReturnValue(new Promise(() => {}));
  const user = userEvent.setup();
  render(<MemoryRouter initialEntries={["/?cidade=Goi%C3%A2nia&estado=GO&busca=manicure&utm_source=teste#buscar-servicos"]}><HomePage /><NavigationProbe /></MemoryRouter>);
  const city = await screen.findByRole("combobox", { name: "Escolher localização" });
  expect(city.closest(".home-filter-slot")).not.toBeNull();
  expect(city.value).toBe("Goiânia::GO");
  const applied = screen.getByRole("region", { name: "Filtros aplicados" });
  expect(applied.closest("#buscar-servicos")).not.toBeNull();
  expect(applied.textContent).toContain("Goiânia, GO");
  expect(applied.textContent).toContain("manicure");
  await user.click(screen.getByRole("button", { name: "Limpar filtros" }));
  await waitFor(() => expect(screen.getByTestId("location").textContent).toBe("?utm_source=teste"));
  expect(city.value).toBe("");
  expect(screen.queryByRole("region", { name: "Filtros aplicados" })).toBeNull();
});

it("mostra carregamento inicial e permite escolher cidade na home completa", async () => {
  apiRequest.mockResolvedValue({ negocios: [], localidades: [{ cidade: "Goiânia", estado: "GO", total_negocios: 1 }], paginacao: { tem_mais: false } });
  const user = userEvent.setup();
  render(<MemoryRouter><HomePage /><NavigationProbe /></MemoryRouter>);
  expect(screen.getByLabelText("Carregando filtro de cidade")).not.toBeNull();
  const city = await screen.findByRole("combobox", { name: "Escolher localização" });
  await screen.findByRole("option", { name: "Goiânia, GO" });
  await user.selectOptions(city, "Goiânia::GO");
  await waitFor(() => expect(screen.getByTestId("location").textContent).toContain("cidade=Goi%C3%A2nia"));
  expect(screen.getByRole("region", { name: "Filtros aplicados" }).textContent).toContain("Goiânia, GO");
});


it("mantém cidades em carregamento até a resposta e permite tentar após erro", async () => {
  let rejectRequest;
  apiRequest.mockReturnValueOnce(new Promise((resolve, reject) => { rejectRequest = reject; }))
    .mockResolvedValue({ negocios: [], localidades: [{ cidade: "Goiânia", estado: "GO" }] });
  render(<MemoryRouter initialEntries={["/#buscar-servicos"]}><HomePage /></MemoryRouter>);
  const city = await screen.findByRole("combobox", { name: "Escolher localização" });
  await waitFor(() => expect(rejectRequest).toBeTypeOf("function"));
  expect(city.disabled).toBe(true);
  expect(screen.queryByLabelText("Carregando filtro de cidade")).toBeNull();
  expect(screen.getByRole("region", { name: "Filtros de descoberta" }).getAttribute("aria-busy")).toBe("true");
  await act(async () => rejectRequest(new Error("Offline")));
  fireEvent.click(screen.getByRole("button", { name: "Tentar carregar cidades novamente" }));
  await screen.findByRole("option", { name: "Goiânia, GO" });
  expect(city.disabled).toBe(false);
});

it("rola novamente após outra busca com o mesmo fragmento", async () => {
  const originalScroll = Element.prototype.scrollIntoView;
  const scroll = vi.fn();
  Element.prototype.scrollIntoView = scroll;
  apiRequest.mockResolvedValue({ negocios: [], localidades: [] });
  function SearchAgain() {
    const navigate = useNavigate();
    return <button onClick={() => navigate("/?busca=unhas#buscar-servicos")}>Outra busca</button>;
  }
  try {
    render(<MemoryRouter initialEntries={["/?busca=cabelo#buscar-servicos"]}><HomePage /><SearchAgain /></MemoryRouter>);
    await waitFor(() => expect(scroll).toHaveBeenCalled());
    scroll.mockClear();
    fireEvent.click(screen.getByText("Outra busca"));
    await waitFor(() => expect(scroll).toHaveBeenCalled());
  } finally {
    Element.prototype.scrollIntoView = originalScroll;
  }
});


it("rola novamente ao reenviar exatamente a mesma busca", async () => {
  const original = Element.prototype.scrollIntoView;
  const scroll = vi.fn();
  Element.prototype.scrollIntoView = scroll;
  apiRequest.mockResolvedValue({ negocios: [], localidades: [] });
  function RepeatSearch() {
    const navigate = useNavigate();
    return <button onClick={() => navigate("/?busca=unhas#buscar-servicos")}>Repetir busca</button>;
  }
  try {
    render(<MemoryRouter initialEntries={["/?busca=unhas#buscar-servicos"]}><HomePage /><RepeatSearch /></MemoryRouter>);
    await waitFor(() => expect(scroll).toHaveBeenCalled());
    scroll.mockClear();
    fireEvent.click(screen.getByText("Repetir busca"));
    await waitFor(() => expect(scroll).toHaveBeenCalled());
  } finally { Element.prototype.scrollIntoView = original; }
});

it.each(["clique", "link direto"])("aguarda Como funciona montar antes de rolar: %s", async (mode) => {
  const original = Element.prototype.scrollIntoView;
  const targets = [];
  Element.prototype.scrollIntoView = function () { targets.push(this.id); };
  apiRequest.mockReturnValue(new Promise(() => {}));
  try {
    render(<MemoryRouter initialEntries={[mode === "clique" ? "/?utm_source=teste" : "/?utm_source=teste#como-funciona"]}><HomePage /><NavigationProbe /></MemoryRouter>);
    if (mode === "clique") {
      expect(document.getElementById("como-funciona")).toBeNull();
      fireEvent.click(screen.getByRole("link", { name: /Como funciona/ }));
    }
    await waitFor(() => expect(targets).toContain("como-funciona"));
    expect(document.getElementById("como-funciona")).not.toBeNull();
    expect(screen.getByTestId("location").textContent).toBe("?utm_source=teste");
    targets.length = 0;
    fireEvent.click(screen.getByRole("link", { name: /Como funciona/ }));
    await waitFor(() => expect(targets).toContain("como-funciona"));
  } finally { Element.prototype.scrollIntoView = original; }
});


it.each(["buscar-servicos", "como-funciona"])("preserva âncora e campanha ao restaurar cidade salva: %s", async (anchor) => {
  const original = Element.prototype.scrollIntoView;
  const targets = [];
  Element.prototype.scrollIntoView = function () { targets.push(this.id); };
  window.localStorage.setItem("af_catalog_location", "Goiânia::GO");
  apiRequest.mockResolvedValue({ negocios: [], localidades: [{ cidade: "Goiânia", estado: "GO" }] });
  function UrlProbe() {
    const location = useLocation();
    return <output data-testid="restored-url">{location.pathname + location.search + location.hash}</output>;
  }
  try {
    render(<MemoryRouter initialEntries={[`/?utm_source=teste#${anchor}`]}><HomePage /><UrlProbe /></MemoryRouter>);
    await waitFor(() => expect(targets).toContain(anchor));
    const url = new URL(screen.getByTestId("restored-url").textContent, "https://example.test");
    expect(url.hash).toBe(`#${anchor}`);
    expect(url.searchParams.get("cidade")).toBe("Goiânia");
    expect(url.searchParams.get("estado")).toBe("GO");
    expect(url.searchParams.get("utm_source")).toBe("teste");
    expect(screen.getByRole("combobox", { name: "Escolher localização" }).value).toBe("Goiânia::GO");
  } finally { Element.prototype.scrollIntoView = original; }
});


it.each(["manicure", ""])("busca junto à cidade preserva contexto e campanha: %s", async (value) => {
  apiRequest.mockResolvedValue({ negocios: [], localidades: [] });
  renderExplore("/?categoria=unha&cidade=An%C3%A1polis&estado=GO&busca=antiga&pagina=3&utm_source=teste");
  const input = screen.getByRole("searchbox", { name: "Qual serviço?" });
  fireEvent.change(input, { target: { value } });
  fireEvent.submit(input.closest("form"));
  const params = new URLSearchParams(screen.getByTestId("location").textContent);
  expect(params.get("busca")).toBe(value || null);
  expect(params.get("cidade")).toBe("Anápolis");
  expect(params.get("estado")).toBe("GO");
  expect(params.get("categoria")).toBe("unha");
  expect(params.get("pagina")).toBeNull();
  expect(params.get("utm_source")).toBe("teste");
});

it.each(["/?categoria=unha", "/?busca=Studio"])("prioriza serviços no DOM e mantém paginação após resultados: %s", async (path) => {
  apiRequest.mockResolvedValue({ negocios: [business(1, "Studio")], localidades: [], paginacao: { tem_mais: true } });
  const { container } = renderExplore(path);
  await screen.findByRole("button", { name: "Carregar mais resultados" });
  const services = container.querySelector('#servicos');
  const businesses = container.querySelector('.home-businesses-section');
  const pagination = container.querySelector('.home-pagination');
  expect(services.compareDocumentPosition(businesses) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  expect(businesses.compareDocumentPosition(pagination) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
});
