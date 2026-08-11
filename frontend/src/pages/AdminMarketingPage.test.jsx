// @vitest-environment jsdom

import {
  cleanup,
  render,
  screen,
  waitFor
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi
} from "vitest";
import { apiRequest } from "../api/client";
import { AdminMarketingPage } from "./AdminMarketingPage";

vi.mock("../api/client", () => ({
  apiRequest: vi.fn()
}));

function mockMarketingRequests() {
  apiRequest.mockImplementation((path) => {
    if (path.startsWith("/admin/marketing/resumo")) {
      return Promise.resolve({
        periodo: "30",
        sessoes: 100,
        campanhas: 2,
        perfisVisualizados: 60,
        agendamentosIniciados: 20,
        agendamentosConcluidos: 10,
        taxaConversao: 10
      });
    }

    if (path.startsWith("/admin/marketing/campanhas")) {
      return Promise.resolve({
        periodo: "30",
        campanhas: [
          {
            origem: "facebook",
            midia: "cpc",
            campanha: "goiania_cilios",
            sessoes: 100,
            perfisVisualizados: 60,
            agendamentosIniciados: 20,
            agendamentosConcluidos: 10,
            taxaConversao: 10
          }
        ]
      });
    }

    if (path.startsWith("/admin/marketing/conversoes")) {
      return Promise.resolve({
        periodo: "30",
        conversoes: [
          {
            eventoId: 88,
            agendamentoId: 42,
            negocioNome: "Studio Bella",
            campanha: "goiania_cilios",
            landingPage: "/negocio/studio-bella",
            createdAt: "2026-08-10T20:00:00.000Z"
          }
        ]
      });
    }

    return Promise.reject(
      new Error("Rota inesperada")
    );
  });
}

beforeEach(() => {
  apiRequest.mockReset();
  mockMarketingRequests();
});

afterEach(cleanup);

describe(
  "AdminMarketingPage",
  () => {
    it(
      "carrega resumo, campanhas e conversões atribuídas",
      async () => {
        render(<AdminMarketingPage />);

        expect(
          await screen.findByRole(
            "heading",
            {
              name:
                "Marketing e tráfego pago"
            }
          )
        ).not.toBeNull();

        expect(
          screen.getByText("100")
        ).not.toBeNull();

        expect(
          screen.getAllByText(
            "goiania_cilios"
          ).length
        ).toBeGreaterThanOrEqual(2);

        expect(
          screen.getByText(
            "Studio Bella"
          )
        ).not.toBeNull();

        expect(
          screen.getByText("#42")
        ).not.toBeNull();

        expect(apiRequest)
          .toHaveBeenCalledTimes(3);
      }
    );

    it(
      "recarrega as três visões ao trocar o período",
      async () => {
        const user =
          userEvent.setup();

        render(<AdminMarketingPage />);

        await screen.findByRole(
          "heading",
          {
            name:
              "Marketing e tráfego pago"
          }
        );

        await user.click(
          screen.getByRole(
            "button",
            { name: "7 dias" }
          )
        );

        await waitFor(() => {
          expect(apiRequest)
            .toHaveBeenCalledWith(
              "/admin/marketing/resumo?periodo=7",
              expect.any(Object)
            );
        });

        expect(apiRequest)
          .toHaveBeenCalledWith(
            "/admin/marketing/campanhas?periodo=7",
            expect.any(Object)
          );

        expect(apiRequest)
          .toHaveBeenCalledWith(
            "/admin/marketing/conversoes?periodo=7",
            expect.any(Object)
          );
      }
    );
  }
);
