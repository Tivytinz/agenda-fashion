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

vi.mock("../analytics/firstPartyAnalytics", () => ({
  startFirstPartyPageView: vi.fn()
}));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("FirstPartyAnalyticsBridge", () => {
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
