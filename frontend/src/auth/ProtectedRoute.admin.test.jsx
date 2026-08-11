// @vitest-environment jsdom

import {
  cleanup,
  render,
  screen
} from "@testing-library/react";
import {
  MemoryRouter,
  Route,
  Routes
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
