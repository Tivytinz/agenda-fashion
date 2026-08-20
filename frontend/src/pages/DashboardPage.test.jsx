// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { apiRequest } from "../api/client";
import { DashboardPage } from "./DashboardPage";

vi.mock("../api/client", () => ({ apiRequest: vi.fn() }));

const DASHBOARD = {
  resumo: {
    agendamentos_periodo: 2,
    faturamento_periodo: 100,
    clientes_novos: 1
  },
  performance: {
    taxa_conversao: 1.4,
    visitas_perfil: 145,
    agendamentos_concluidos: 2
  },
  ranking_servicos: [{ id: 1, nome: "Manicure", total: 2, faturamento: 100 }]
};

beforeEach(() => {
  apiRequest.mockReset();
});
afterEach(cleanup);

describe("dashboard", () => {
  it("cancela a consulta anterior e identifica o período selecionado", async () => {
    apiRequest.mockResolvedValue(DASHBOARD);
    render(<MemoryRouter><DashboardPage /></MemoryRouter>);

    expect(await screen.findByRole("heading", { name: "Visão geral" }))
      .not.toBeNull();
    const initialSignal = apiRequest.mock.calls[0][1].signal;
    const today = screen.getByRole("button", { name: "Hoje" });
    fireEvent.click(today);

    await waitFor(() => expect(apiRequest).toHaveBeenLastCalledWith(
      "/dashboard-dono?periodo=hoje",
      expect.objectContaining({ signal: expect.any(AbortSignal) })
    ));
    expect(initialSignal.aborted).toBe(true);
    expect((await screen.findByRole("button", { name: "Hoje" })).getAttribute("aria-pressed")).toBe("true");
  });

  it("explica a conversão, pluraliza clientes e nomeia o ranking corretamente", async () => {
    apiRequest.mockResolvedValue(DASHBOARD);
    render(<MemoryRouter><DashboardPage /></MemoryRouter>);

    expect(await screen.findByText("1,4%")).not.toBeNull();
    expect(screen.getByText("2 de 145 visitas")).not.toBeNull();
    expect(screen.getByText("descobriu você")).not.toBeNull();
    expect(screen.getByRole("heading", { name: "Serviços mais agendados" }))
      .not.toBeNull();
  });

  it("conduz o profissional para a primeira etapa incompleta", async () => {
    apiRequest.mockImplementation((path) => {
      if (path.startsWith("/dashboard-dono")) return Promise.resolve(DASHBOARD);
      if (path === "/configuracoes") {
        return Promise.resolve({
          negocio: { slug: "studio-aurora", publicado: false },
          publicacao: {
            publicado: false,
            pode_publicar: false,
            pendencias: ["pelo menos um serviço ativo"]
          }
        });
      }
      return Promise.reject(new Error(`Rota inesperada: ${path}`));
    });

    render(<MemoryRouter><DashboardPage /></MemoryRouter>);

    expect(await screen.findByRole("heading", {
      name: "Prepare seu negócio para receber agendamentos"
    })).not.toBeNull();
    expect(screen.getByRole("link", { name: "Cadastrar serviço" })
      .getAttribute("href")).toBe("/painel/servicos/novo");
    expect(screen.getByText("1 de 3")).not.toBeNull();
  });
});
