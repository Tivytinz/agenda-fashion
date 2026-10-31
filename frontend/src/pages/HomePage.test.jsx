// @vitest-environment jsdom

import {
  cleanup,
  render,
  screen,
  waitFor
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  MemoryRouter,
  useLocation
} from "react-router-dom";
import {
  afterEach,
  describe,
  expect,
  it,
  vi
} from "vitest";
import { HomePage } from "./HomePage";

vi.mock("./ExplorePage", () => ({
  ExplorePage: ({ renderHero }) => (
    <section data-render-hero={String(renderHero)}>
      Catálogo carregado
    </section>
  )
}));

function LocationProbe() {
  const location = useLocation();
  return <output>{`${location.pathname}${location.search}`}</output>;
}

function renderHome(pathname = "/") {
  return render(
    <MemoryRouter initialEntries={[pathname]}>
      <HomePage />
      <LocationProbe />
    </MemoryRouter>
  );
}

afterEach(cleanup);

describe("home crítica", () => {
  it("define os metadados da home mesmo após entrada direta em um perfil", () => {
    const previousTitle = document.title;
    const meta = document.createElement("meta");
    meta.name = "description";
    meta.content = "Descrição de RR Beauty";
    document.head.append(meta);
    document.title = "RR Beauty | Agenda Fashion";
    try {
      const view = renderHome();
      expect(document.title).toBe("Agenda Fashion | Agendamento de beleza online");
      expect(meta.content).toBe(
        "Encontre profissionais e negócios de beleza, compare serviços e agende seu horário online pelo Agenda Fashion."
      );
      view.unmount();
    } finally {
      document.title = previousTitle;
      meta.remove();
    }
  });

  it("expõe links HTML diretos para as páginas comerciais sem depender do catálogo", () => {
    renderHome();

    const professionalLink = screen.getByRole("link", {
      name: "Agenda online para profissionais"
    });
    const plansLink = screen.getByRole("link", {
      name: "Conhecer os planos"
    });

    expect(professionalLink.getAttribute("href")).toBe("/para-profissionais");
    expect(plansLink.getAttribute("href")).toBe("/planos");
    expect(professionalLink.closest("nav")?.getAttribute("aria-label")).toBe(
      "Conheça o Agenda Fashion para profissionais"
    );
    expect(screen.queryByText("Catálogo carregado")).toBeNull();
  });

  it("pinta o hero antes de carregar o catálogo abaixo da dobra", async () => {
    const { container } = renderHome();

    expect(screen.getByRole("heading", {
      name: "Beleza para você"
    })).not.toBeNull();
    expect(screen.queryByText("Catálogo carregado")).toBeNull();

    const firstImage = container.querySelector(".home-hero-image");
    expect(firstImage?.getAttribute("loading")).toBe("eager");
    expect(firstImage?.getAttribute("fetchpriority")).toBe("high");

    expect(await screen.findByText(
      "Catálogo carregado",
      {},
      { timeout: 1000 }
    )).not.toBeNull();
    expect(screen.getByText("Catálogo carregado")
      .getAttribute("data-render-hero")).toBe("false");
  });

  it("abre o catálogo imediatamente ao explorar uma categoria", async () => {
    const user = userEvent.setup();
    const { container } = renderHome();

    await user.click(container.querySelector(".home-hero-primary"));

    await waitFor(() => {
      expect(screen.getByText("Catálogo carregado")).not.toBeNull();
      expect(screen.getByText("/?categoria=cabelo")).not.toBeNull();
    });
  });


  it("pausa a rotação automática quando a pessoa navega manualmente", async () => {
    const user = userEvent.setup();

    renderHome();

    const pauseButton = screen.getByRole("button", {
      name: "Pausar rotação automática dos destaques"
    });
    expect(pauseButton.getAttribute("aria-pressed")).toBe("false");

    await user.click(screen.getByRole("button", {
      name: "Próximo destaque"
    }));

    expect(screen.getByRole("heading", {
      name: "Unhas do seu jeito"
    })).not.toBeNull();

    const resumeButton = screen.getByRole("button", {
      name: "Retomar rotação automática dos destaques"
    });
    expect(resumeButton.getAttribute("aria-pressed")).toBe("true");

    await user.click(resumeButton);

    expect(screen.getByRole("button", {
      name: "Pausar rotação automática dos destaques"
    }).getAttribute("aria-pressed")).toBe("false");
  });


  it("inicia com a rotação pausada quando a pessoa prefere movimento reduzido", () => {
    const originalMatchMedia = window.matchMedia;

    Object.defineProperty(window, "matchMedia", {
      configurable: true,
      value: vi.fn().mockReturnValue({
        matches: true,
        media: "(prefers-reduced-motion: reduce)",
        addEventListener: vi.fn(),
        removeEventListener: vi.fn()
      })
    });

    try {
      renderHome();

      expect(screen.getByRole("button", {
        name: "Retomar rotação automática dos destaques"
      }).getAttribute("aria-pressed")).toBe("true");
    } finally {
      Object.defineProperty(window, "matchMedia", {
        configurable: true,
        value: originalMatchMedia
      });
    }
  });
});
