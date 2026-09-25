// @vitest-environment jsdom

import {
  cleanup,
  render,
  screen
} from "@testing-library/react";
import {
  MemoryRouter,
  Outlet
} from "react-router-dom";
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi
} from "vitest";

const sessionState = vi.hoisted(() => ({
  authenticated: true,
  ehAdministrador: false,
  temNegocio: true,
  negocio: {
    id: 4,
    nome: "Studio Rosa",
    papel: "profissional"
  },
  usuario: {
    nome: "Ana"
  }
}));

vi.mock("./auth/SessionContext", () => ({
  useSession: () => sessionState
}));

vi.mock("./auth/ProtectedRoute", () => ({
  ProtectedRoute: ({ children }) => children
}));

vi.mock("./components/AppHeader", () => ({
  AppHeader: () => null
}));

vi.mock("./components/FirstPartyAnalyticsBridge", () => ({
  FirstPartyAnalyticsBridge: () => null
}));

vi.mock("./components/LegalFooter", () => ({
  LegalFooter: () => null
}));

vi.mock("./components/WorkspaceLayout", () => ({
  WorkspaceLayout: ({ children }) => (
    <div data-testid="workspace-layout">
      {children || <Outlet />}
    </div>
  )
}));

vi.mock("./components/MetaAdsBridge", () => ({
  MetaAdsBridge: () => null
}));

vi.mock("./pages/ProfessionalInvitesPage", () => ({
  ProfessionalInvitesPage: () => (
    <h1>Convites recebidos</h1>
  )
}));

import App from "./App";

function renderInvites() {
  return render(
    <MemoryRouter initialEntries={["/convites"]}>
      <App />
    </MemoryRouter>
  );
}

beforeEach(() => {
  sessionState.authenticated = true;
  sessionState.ehAdministrador = false;
  sessionState.temNegocio = true;
  sessionState.negocio = {
    id: 4,
    nome: "Studio Rosa",
    papel: "profissional"
  };
  sessionState.usuario = {
    nome: "Ana"
  };
});

afterEach(cleanup);

describe("composição da rota de convites", () => {
  it("mantém a profissional ativa dentro do workspace", async () => {
    renderInvites();

    expect(
      await screen.findByRole(
        "heading",
        { name: "Convites recebidos" }
      )
    ).not.toBeNull();

    expect(
      screen.getByTestId(
        "workspace-layout"
      )
    ).not.toBeNull();
  });

  it("mantém a tela de transição fora do workspace quando ainda não existe negócio", async () => {
    sessionState.temNegocio = false;
    sessionState.negocio = null;

    renderInvites();

    expect(
      await screen.findByRole(
        "heading",
        { name: "Convites recebidos" }
      )
    ).not.toBeNull();

    expect(
      screen.queryByTestId(
        "workspace-layout"
      )
    ).toBeNull();
  });
});
