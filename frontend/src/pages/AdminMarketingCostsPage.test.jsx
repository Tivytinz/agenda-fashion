// @vitest-environment jsdom

import {
  cleanup,
  render,
  screen,
  waitFor
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
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
  apiRequest.mockImplementation((path, options = {}) => {
    if (
      path === "/admin/marketing/custos-integracoes"
    ) {
      return Promise.resolve({
        sincronizacaoAutomatica: {
          habilitado: false,
          intervaloHoras: 6,
          limiteDesatualizadoHoras: 24
        },
        provedores: [],
        vinculos: []
      });
    }

    if (path.startsWith("/admin/marketing/custos?")) {
      return Promise.resolve({
        periodo: "30",
        moeda: "BRL",
        investimentoCentavos: 10000,
        investimentoClientesCentavos: 10000,
        sessoes: 20,
        agendamentosConcluidos: 4,
        custoPorSessaoCentavos: 500,
        cpaCentavos: 2500,
        campanhas: [
          {
            campanhaId: 3,
            nome: "Meta Agosto",
            objetivo: "cliente",
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
      path.startsWith("/admin/marketing/gastos") &&
      options.method !== "POST"
    ) {
      return Promise.resolve({ periodo: "30", gastos: [] });
    }

    if (path.startsWith("/admin/marketing/campanhas?")) {
      return Promise.resolve({
        periodo: "30",
        campanhas: [
          {
            origem: "google",
            midia: "cpc",
            campanha: "(sem campanha)",
            sessoes: 5,
            perfisVisualizados: 0,
            agendamentosIniciados: 0,
            agendamentosConcluidos: 0,
            taxaConversao: 0
          }
        ]
      });
    }

    if (path === "/admin/marketing/gestao-campanhas") {
      return Promise.resolve({
        campanhas: [
          {
            id: 3,
            nome: "Meta Agosto",
            canal: "meta",
            objetivo: "cliente",
            ativo: true
          }
        ]
      });
    }

    if (path === "/admin/marketing/gastos" && options.method === "POST") {
      return Promise.resolve({
        gasto: {
          id: 9,
          campanhaId: 3,
          dataGasto: "2026-08-10",
          valorCentavos: 7550
        }
      });
    }

    return Promise.reject(new Error(`Rota inesperada: ${path}`));
  });
}

beforeEach(() => {
  cleanup();
  apiRequest.mockReset();
  mockRequests();
});

describe("AdminMarketingCostsPage", () => {
  it("distingue sessões vinculadas de tráfego pago sem campanha", async () => {
    render(
      <MemoryRouter>
        <AdminMarketingCostsPage />
      </MemoryRouter>
    );

    expect(
      await screen.findByRole("heading", { name: "Investimento e CPA" })
    ).not.toBeNull();
    expect(
      screen.getByText("20 sessões vinculadas a campanhas cadastradas")
    ).not.toBeNull();
    expect(
      screen.getByRole("heading", {
        name: /5 sessão\(ões\) paga\(s\) ainda sem campanha/i
      })
    ).not.toBeNull();
  });

  it("mantém lançamento manual fechado até o administrador pedir", async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <AdminMarketingCostsPage />
      </MemoryRouter>
    );

    await screen.findByRole("heading", { name: "Investimento e CPA" });
    expect(screen.queryByLabelText("Investimento (R$)")).toBeNull();

    await user.click(
      screen.getByRole("button", { name: "+ Registrar manualmente" })
    );
    expect(screen.getByLabelText("Investimento (R$)")).not.toBeNull();
  });

  it("exibe investimento e CPA e registra gasto em centavos", async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <AdminMarketingCostsPage />
      </MemoryRouter>
    );

    expect(
      await screen.findByRole("heading", { name: "Investimento e CPA" })
    ).not.toBeNull();
    expect(screen.getAllByText(/R\$\s*100,00/).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/R\$\s*25,00/).length).toBeGreaterThanOrEqual(1);

    await user.click(
      screen.getByRole("button", { name: "+ Registrar manualmente" })
    );
    const amount = screen.getByLabelText("Investimento (R$)");
    await user.clear(amount);
    await user.type(amount, "75.50");
    await user.click(
      screen.getByRole("button", { name: "Salvar investimento" })
    );

    await waitFor(() => {
      expect(apiRequest).toHaveBeenCalledWith(
        "/admin/marketing/gastos",
        expect.objectContaining({
          method: "POST",
          body: expect.objectContaining({
            campanhaId: 3,
            valorCentavos: 7550
          })
        })
      );
    });
  });

  it("recarrega custos, atribuição e gastos quando muda o período", async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <AdminMarketingCostsPage />
      </MemoryRouter>
    );

    await screen.findByRole("heading", { name: "Investimento e CPA" });
    await user.click(screen.getByRole("button", { name: "7 dias" }));

    await waitFor(() => {
      expect(apiRequest).toHaveBeenCalledWith(
        "/admin/marketing/custos?periodo=7",
        expect.any(Object)
      );
    });
    expect(apiRequest).toHaveBeenCalledWith(
      "/admin/marketing/gastos?periodo=7",
      expect.any(Object)
    );
    expect(apiRequest).toHaveBeenCalledWith(
      "/admin/marketing/campanhas?periodo=7",
      expect.any(Object)
    );
  });

  it("continua mostrando custos quando o histórico de gastos falha", async () => {
    const originalImplementation = apiRequest.getMockImplementation();
    apiRequest.mockImplementation((path, options) => {
      if (
        path.startsWith("/admin/marketing/gastos") &&
        options?.method !== "POST"
      ) {
        return Promise.reject(new Error("Histórico indisponível"));
      }
      return originalImplementation(path, options);
    });

    render(
      <MemoryRouter>
        <AdminMarketingCostsPage />
      </MemoryRouter>
    );

    expect(
      await screen.findByRole("heading", { name: "Investimento e CPA" })
    ).not.toBeNull();
    expect(screen.getAllByText(/R\$\s*100,00/).length).toBeGreaterThanOrEqual(1);
    expect(screen.getByRole("alert").textContent).toContain(
      "Parte dos custos de marketing"
    );
  });

  it("preserva os últimos custos se apenas a atualização deles falhar", async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <AdminMarketingCostsPage />
      </MemoryRouter>
    );
    await screen.findByRole("heading", { name: "Investimento e CPA" });

    const originalImplementation = apiRequest.getMockImplementation();
    apiRequest.mockImplementation((path, options) => {
      if (path === "/admin/marketing/custos?periodo=7") {
        return Promise.reject(new Error("Custos indisponíveis"));
      }
      return originalImplementation(path, options);
    });

    await user.click(screen.getByRole("button", { name: "7 dias" }));
    await screen.findByRole("alert");
    expect(screen.getAllByText(/R\$\s*100,00/).length).toBeGreaterThanOrEqual(1);
  });
});
