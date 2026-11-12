// @vitest-environment jsdom

import {
  cleanup,
  render
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  Link,
  MemoryRouter
} from "react-router-dom";
import {
  afterEach,
  describe,
  expect,
  it,
  vi
} from "vitest";
import {
  startFirstPartyPageView
} from "../analytics/firstPartyAnalytics";
import {
  FirstPartyAnalyticsBridge
} from "./FirstPartyAnalyticsBridge";
import {
  ANALYTICS_IDENTITY_BOUNDARY_EVENT,
  ANALYTICS_VIEW_READY_EVENT
} from "../auth/session";

vi.mock("../analytics/firstPartyAnalytics", () => ({
  startFirstPartyPageView: vi.fn()
}));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("FirstPartyAnalyticsBridge", () => {
  it("mantém a rota parada na fronteira e reabre apenas no readiness confirmado", () => {
    render(<MemoryRouter initialEntries={["/cadastro?tipo=profissional"]}><FirstPartyAnalyticsBridge /></MemoryRouter>);
    expect(startFirstPartyPageView).toHaveBeenCalledTimes(1);
    window.dispatchEvent(new Event(ANALYTICS_IDENTITY_BOUNDARY_EVENT));
    expect(startFirstPartyPageView).toHaveBeenCalledTimes(1);
    window.dispatchEvent(new Event(ANALYTICS_VIEW_READY_EVENT));
    expect(startFirstPartyPageView).toHaveBeenLastCalledWith({
      pathname: "/cadastro", search: "?tipo=profissional", state: null,
      resumeAfterBoundary: true
    });
  });

  it("inicializa a visualização sem depender do bridge de Ads e acompanha a navegação", async () => {
    const user = userEvent.setup();

    const { getByRole } = render(
      <MemoryRouter
        initialEntries={[
          {
            pathname: "/minha-agenda",
            search: "?aba=realizados",
            state: { origem: "teste" }
          }
        ]}
      >
        <FirstPartyAnalyticsBridge />
        <Link to="/negocio/studio-aurora?servico=11">
          Abrir perfil
        </Link>
      </MemoryRouter>
    );

    expect(startFirstPartyPageView).toHaveBeenCalledWith({
      pathname: "/minha-agenda",
      search: "?aba=realizados",
      state: { origem: "teste" }
    });

    await user.click(
      getByRole("link", { name: "Abrir perfil" })
    );

    expect(startFirstPartyPageView).toHaveBeenLastCalledWith({
      pathname: "/negocio/studio-aurora",
      search: "?servico=11",
      state: null
    });
  });
});
