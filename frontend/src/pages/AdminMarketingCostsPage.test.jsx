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
import { MemoryRouter } from "react-router-dom";
import { apiRequest } from "../api/client";
import { AdminMarketingCostsPage } from "./AdminMarketingCostsPage";

vi.mock("../api/client", () => ({
  apiRequest: vi.fn()
}));

function mockRequests() {
  apiRequest.mockImplementation(
    (path, options = {}) => {
      if (
        path.startsWith(
          "/admin/marketing/custos"
        )
      ) {
        return Promise.resolve({
          periodo: "30",
          moeda: "BRL",
          investimentoCentavos: 10000,
          sessoes: 20,
          agendamentosConcluidos: 4,
          custoPorSessaoCentavos: 500,
          cpaCentavos: 2500,
          campanhas: [
            {
              campanhaId: 3,
              nome: "Meta Agosto",
              canal: "meta",
              investimentoCentavos: 10000,
              sessoes: 20,
              agendamentosConcluidos: 4,
              custoPorSessaoCentavos: 500,
              cpaCentavos: 2500
            }
          ]
        });
      }

      if (
        path.startsWith(
          "/admin/marketing/gastos"
        ) &&
        options.method !== "POST"
      ) {
        return Promise.resolve({
          periodo: "30",
          gastos: []
        });
      }

      if (
        path ===
          "/admin/marketing/gestao-campanhas"
      ) {
        return Promise.resolve({
          campanhas: [
            {
              id: 3,
              nome: "Meta Agosto",
              canal: "meta",
              ativo: true
            }
          ]
        });
      }

      if (
        path ===
          "/admin/marketing/gastos" &&
        options.method === "POST"
      ) {
        return Promise.resolve({
          gasto: {
            id: 9,
            campanhaId: 3,
            dataGasto: "2026-08-10",
            valorCentavos: 7550
          }
        });
      }

      return Promise.reject(
        new Error("Rota inesperada")
      );
    }
  );
}

beforeEach(() => {
  apiRequest.mockReset();
  mockRequests();
});

afterEach(cleanup);

describe(
  "AdminMarketingCostsPage",
  () => {
    it(
      "exibe investimento e CPA e registra gasto em centavos",
      async () => {
        const user =
          userEvent.setup();

        render(
          <MemoryRouter>
            <AdminMarketingCostsPage />
          </MemoryRouter>
        );

        expect(
          await screen.findByRole(
            "heading",
            {
              name:
                "Investimento e CPA"
            }
          )
        ).not.toBeNull();

        expect(
          screen.getAllByText(
            /R\$\s*100,00/
          ).length
        ).toBeGreaterThanOrEqual(1);

        expect(
          screen.getAllByText(
            /R\$\s*25,00/
          ).length
        ).toBeGreaterThanOrEqual(1);

        const amount =
          screen.getByLabelText(
            "Investimento (R$)"
          );

        await user.clear(amount);
        await user.type(
          amount,
          "75.50"
        );

        await user.click(
          screen.getByRole(
            "button",
            {
              name:
                "Salvar investimento"
            }
          )
        );

        await waitFor(() => {
          expect(apiRequest)
            .toHaveBeenCalledWith(
              "/admin/marketing/gastos",
              expect.objectContaining({
                method: "POST",
                body:
                  expect.objectContaining({
                    campanhaId: 3,
                    valorCentavos: 7550
                  })
              })
            );
        });
      }
    );

    it(
      "recarrega custos e gastos quando muda o período",
      async () => {
        const user =
          userEvent.setup();

        render(
          <MemoryRouter>
            <AdminMarketingCostsPage />
          </MemoryRouter>
        );

        await screen.findByRole(
          "heading",
          {
            name:
              "Investimento e CPA"
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
              "/admin/marketing/custos?periodo=7",
              expect.any(Object)
            );
        });

        expect(apiRequest)
          .toHaveBeenCalledWith(
            "/admin/marketing/gastos?periodo=7",
            expect.any(Object)
          );
      }
    );
  }
);
