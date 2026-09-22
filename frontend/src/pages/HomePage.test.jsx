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
});
