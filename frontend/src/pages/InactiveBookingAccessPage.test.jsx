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
  InactiveBookingAccessPage
} from "./InactiveBookingAccessPage";

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

describe("acesso de reserva após desativação", () => {
  it("CA-PRV-05: consulta e cancela com a credencial preservada", async () => {
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
          antecedencia_cancelamento_horas: 2,
          fuso_horario: "America/Sao_Paulo"
        }
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
          "/agendamento-acesso/91#token=token-seguro"
        ]}
      >
        <Routes>
          <Route
            path="/agendamento-acesso/:id"
            element={<InactiveBookingAccessPage />}
          />
        </Routes>
      </MemoryRouter>
    );

    expect(
      await screen.findByRole("heading", {
        name: "Seu agendamento"
      })
    ).not.toBeNull();
    expect(screen.getByText("Manicure")).not.toBeNull();

    expect(apiRequest).toHaveBeenCalledWith(
      "/agendamentos/91/acesso-cliente-desativado",
      {
        headers: {
          "X-Agenda-Access": "token-seguro"
        }
      }
    );

    fireEvent.click(
      screen.getByRole("button", {
        name: "Cancelar agendamento"
      })
    );

    await waitFor(() => {
      expect(apiRequest).toHaveBeenLastCalledWith(
        "/agendamentos/91/cancelar-acesso-cliente-desativado",
        {
          method: "PATCH",
          body: { token: "token-seguro" }
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
