// @vitest-environment jsdom

import {
  cleanup,
  render,
  screen
} from "@testing-library/react";
import {
  MemoryRouter,
  Route,
  Routes,
  useLocation
} from "react-router-dom";
import {
  afterEach,
  describe,
  expect,
  it,
  vi
} from "vitest";
import { ProtectedRoute } from "./ProtectedRoute";

let sessionState;

function LocationProbe() {
  const location = useLocation();
  return <p data-testid="location">{location.pathname}{location.search}</p>;
}

vi.mock("./SessionContext", () => ({
  useSession: () => sessionState
}));

afterEach(cleanup);

function renderAdminRoute() {
  return render(
    <MemoryRouter
      initialEntries={[
        "/admin/trafego-pago"
      ]}
    >
      <Routes>
        <Route
          path="/"
          element={<h1>Início</h1>}
        />
        <Route
          path="/entrar"
          element={<h1>Entrar</h1>}
        />
        <Route
          path="/admin/trafego-pago"
          element={(
            <ProtectedRoute adminOnly>
              <h1>Marketing Admin</h1>
            </ProtectedRoute>
          )}
        />
      </Routes>
    </MemoryRouter>
  );
}

function renderCheckoutRoute() {
  return render(
    <MemoryRouter initialEntries={["/checkout?plano=autonoma"]}>
      <Routes>
        <Route
          path="/checkout"
          element={(
            <ProtectedRoute ownerOnly businessRequired publishedBusinessRequired>
              <h1>Checkout</h1>
            </ProtectedRoute>
          )}
        />
        <Route
          path="/criar-negocio"
          element={<><h1>Criar negócio</h1><LocationProbe /></>}
        />
        <Route
          path="/entrar"
          element={<><h1>Entrar</h1><LocationProbe /></>}
        />
        <Route
          path="/painel"
          element={<><h1>Painel</h1><LocationProbe /></>}
        />
      </Routes>
    </MemoryRouter>
  );
}

describe(
  "ProtectedRoute adminOnly",
  () => {
    it(
      "permite administrador autenticado",
      () => {
        sessionState = {
          loading: false,
          authenticated: true,
          ehAdministrador: true,
          temNegocio: false,
          negocio: null
        };

        renderAdminRoute();

        expect(
          screen.getByRole(
            "heading",
            { name: "Marketing Admin" }
          )
        ).not.toBeNull();
      }
    );

    it(
      "redireciona conta comum para o início",
      () => {
        sessionState = {
          loading: false,
          authenticated: true,
          ehAdministrador: false,
          temNegocio: true,
          negocio: {
            papel: "dono"
          }
        };

        renderAdminRoute();

        expect(
          screen.getByRole(
            "heading",
            { name: "Início" }
          )
        ).not.toBeNull();
      }
    );

    it(
      "leva usuário sem sessão para login",
      () => {
        sessionState = {
          loading: false,
          authenticated: false,
          ehAdministrador: false,
          temNegocio: false,
          negocio: null
        };

        renderAdminRoute();

        expect(
          screen.getByRole(
            "heading",
            { name: "Entrar" }
          )
        ).not.toBeNull();
      }
    );
  }
);

describe("ProtectedRoute businessRequired", () => {
  it("preserva o plano ao enviar conta sem negócio para o onboarding", () => {
    sessionState = {
      loading: false,
      authenticated: true,
      ehAdministrador: false,
      temNegocio: false,
      negocio: null
    };

    renderCheckoutRoute();

    expect(screen.getByRole("heading", { name: "Criar negócio" }))
      .not.toBeNull();
    expect(screen.getByTestId("location").textContent)
      .toBe("/criar-negocio?plano=autonoma");
  });

  it("preserva o plano também antes do login", () => {
    sessionState = {
      loading: false,
      authenticated: false,
      ehAdministrador: false,
      temNegocio: false,
      negocio: null
    };

    renderCheckoutRoute();

    expect(screen.getByRole("heading", { name: "Entrar" })).not.toBeNull();
    expect(screen.getByTestId("location").textContent)
      .toBe("/entrar?tipo=profissional&plano=autonoma");
  });

  it("bloqueia checkout direto enquanto o negócio ainda não está publicado", () => {
    sessionState = {
      loading: false,
      authenticated: true,
      ehAdministrador: false,
      temNegocio: true,
      negocio: {
        papel: "dono",
        publicado: false
      }
    };

    renderCheckoutRoute();

    expect(screen.getByRole("heading", { name: "Painel" })).not.toBeNull();
    expect(screen.getByTestId("location").textContent)
      .toBe("/painel?plano=autonoma");
    expect(screen.queryByRole("heading", { name: "Checkout" })).toBeNull();
  });

  it("libera checkout direto quando a publicação já foi confirmada", () => {
    sessionState = {
      loading: false,
      authenticated: true,
      ehAdministrador: false,
      temNegocio: true,
      negocio: {
        papel: "dono",
        publicado: true
      }
    };

    renderCheckoutRoute();

    expect(screen.getByRole("heading", { name: "Checkout" })).not.toBeNull();
  });
});
