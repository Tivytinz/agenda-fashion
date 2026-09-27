// @vitest-environment jsdom

import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor
} from "@testing-library/react";
import {
  MemoryRouter,
  Route,
  Routes
} from "react-router-dom";
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
  GuestBookingAccessPage
} from "./GuestBookingAccessPage";

vi.mock("../api/client", () => ({
  apiRequest: vi.fn()
}));

beforeEach(() => {
  apiRequest.mockReset();
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("link seguro do booking visitante", () => {
  it("CA-AG-09: consulta e cancela apenas com a capability do próprio booking", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(true);

    apiRequest
      .mockResolvedValueOnce({
        agendamento: {
          id: 91,
          status: "confirmado",
          data: "2026-09-30",
          horario: "14:00",
          servico_nome: "Manicure",
          profissional_nome: "Ana",
          negocio_nome: "Studio AF",
          valor: 55
        },
        pode_cancelar: true,
        cancelamento_indisponivel: null
      })
      .mockResolvedValueOnce({
        mensagem: "Agendamento cancelado com sucesso.",
        agendamento: {
          id: 91,
          status: "cancelado"
        }
      });

    render(
      <MemoryRouter
        initialEntries={[
          "/agendamento-visitante/91#token=capability-segura"
        ]}
      >
        <Routes>
          <Route
            path="/agendamento-visitante/:id"
            element={<GuestBookingAccessPage />}
          />
        </Routes>
      </MemoryRouter>
    );

    expect(
      await screen.findByRole("heading", {
        name: "Seu agendamento"
      })
    ).not.toBeNull();

    expect(apiRequest).toHaveBeenCalledWith(
      "/agendamentos/91/acesso-visitante",
      {
        headers: {
          "X-Agenda-Access": "capability-segura"
        }
      }
    );

    expect(
      screen.getByText(/dá acesso somente a esta reserva/i)
    ).not.toBeNull();

    fireEvent.click(
      screen.getByRole("button", {
        name: "Cancelar agendamento"
      })
    );

    await waitFor(() => {
      expect(apiRequest).toHaveBeenLastCalledWith(
        "/agendamentos/91/cancelar-visitante",
        {
          method: "PATCH",
          body: {
            acesso_visitante:
              "capability-segura"
          }
        }
      );
    });

    expect(
      await screen.findByText(
        "Agendamento cancelado com sucesso."
      )
    ).not.toBeNull();

    expect(
      screen.queryByRole("button", {
        name: "Cancelar agendamento"
      })
    ).toBeNull();
  });
});
