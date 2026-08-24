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

const CUSTOMER_ORIGIN = {
  resumo: {
    clientes: 4,
    clientesNovos: 3,
    clientesRecorrentes: 1,
    agendamentos: 6,
    faturamento: 390
  },
  origens: [
    {
      codigo: "google_ads",
      rotulo: "Google Ads",
      categoria: "pago",
      descricao: "Cliente adquirido por clique identificado do Google Ads.",
      clientes: 2,
      percentualClientes: 50,
      agendamentos: 3,
      faturamento: 230
    },
    {
      codigo: "autonomo",
      rotulo: "Acesso autônomo",
      categoria: "autonomo",
      clientes: 1,
      percentualClientes: 25,
      agendamentos: 2,
      faturamento: 100
    },
    {
      codigo: "nao_identificado",
      rotulo: "Origem não identificada",
      categoria: "incompleto",
      clientes: 1,
      percentualClientes: 25,
      agendamentos: 1,
      faturamento: 60
    }
  ]
};

function mockDashboardRequests({
  dashboard = DASHBOARD,
  origin = CUSTOMER_ORIGIN,
  publication = {
    negocio: { slug: "studio-aurora", publicado: true },
    publicacao: { publicado: true, pode_publicar: true, pendencias: [] }
  }
} = {}) {
  apiRequest.mockImplementation((path) => {
    if (path.startsWith("/dashboard-dono/origem-clientes")) {
      return Promise.resolve(origin);
    }
    if (path.startsWith("/dashboard-dono")) {
      return Promise.resolve(dashboard);
    }
    if (path === "/configuracoes") {
      return Promise.resolve(publication);
    }
    return Promise.reject(new Error(`Rota inesperada: ${path}`));
  });
}

beforeEach(() => {
  apiRequest.mockReset();
});
afterEach(cleanup);

describe("dashboard", () => {
  it("cancela as consultas anteriores e identifica o período selecionado", async () => {
    mockDashboardRequests();
    render(<MemoryRouter><DashboardPage /></MemoryRouter>);

    expect(await screen.findByRole("heading", { name: "Visão geral" }))
      .not.toBeNull();

    const initialDashboardCall = apiRequest.mock.calls.find(
      ([path]) => path === "/dashboard-dono?periodo=7dias"
    );
    const initialSignal = initialDashboardCall[1].signal;
    const today = screen.getByRole("button", { name: "Hoje" });
    fireEvent.click(today);

    await waitFor(() => expect(apiRequest).toHaveBeenCalledWith(
      "/dashboard-dono?periodo=hoje",
      expect.objectContaining({ signal: expect.any(AbortSignal) })
    ));
    expect(apiRequest).toHaveBeenCalledWith(
      "/dashboard-dono/origem-clientes?periodo=hoje",
      expect.objectContaining({ signal: expect.any(AbortSignal) })
    );
    expect(initialSignal.aborted).toBe(true);
    expect((await screen.findByRole("button", { name: "Hoje" })).getAttribute("aria-pressed")).toBe("true");
  });

  it("explica a conversão, pluraliza clientes e nomeia o ranking corretamente", async () => {
    mockDashboardRequests();
    render(<MemoryRouter><DashboardPage /></MemoryRouter>);

    expect(await screen.findByText("1,4%")).not.toBeNull();
    expect(screen.getByText("2 agendamentos em 145 visitas")).not.toBeNull();
    expect(screen.getByText("descobriu você")).not.toBeNull();
    expect(screen.getByRole("heading", { name: "Serviços mais agendados" }))
      .not.toBeNull();
  });

  it("mostra clientes únicos e separa origem paga, autônoma e não identificada", async () => {
    mockDashboardRequests();
    render(<MemoryRouter><DashboardPage /></MemoryRouter>);

    expect(await screen.findByRole("heading", { name: "De onde vieram seus clientes" }))
      .not.toBeNull();
    expect(screen.getByText("Google Ads")).not.toBeNull();
    expect(screen.getByText("Acesso autônomo", { selector: "strong" })).not.toBeNull();
    expect(screen.getByText("Origem não identificada", { selector: "strong" })).not.toBeNull();
    expect(screen.getByText(/Cada pessoa conta uma vez/)).not.toBeNull();
    expect(screen.getByText(/Pode ser acesso direto, favorito, busca\/link sem rastreamento ou link compartilhado/))
      .not.toBeNull();
  });

  it("mantém o painel principal quando o relatório de origem falha", async () => {
    apiRequest.mockImplementation((path) => {
      if (path.startsWith("/dashboard-dono/origem-clientes")) {
        return Promise.reject(new Error("origem indisponível"));
      }
      if (path.startsWith("/dashboard-dono")) return Promise.resolve(DASHBOARD);
      if (path === "/configuracoes") {
        return Promise.resolve({
          negocio: { slug: "studio-aurora", publicado: true },
          publicacao: { publicado: true, pode_publicar: true, pendencias: [] }
        });
      }
      return Promise.reject(new Error(`Rota inesperada: ${path}`));
    });

    render(<MemoryRouter><DashboardPage /></MemoryRouter>);

    expect(await screen.findByRole("heading", { name: "Visão geral" }))
      .not.toBeNull();
    expect(screen.getByText("A origem dos clientes está temporariamente indisponível. Os demais indicadores continuam válidos."))
      .not.toBeNull();
  });

  it("transforma visitas sem conversão em uma recomendação acionável", async () => {
    mockDashboardRequests({
      dashboard: {
        resumo: { agendamentos_periodo: 0, faturamento_periodo: 0, clientes_novos: 0 },
        performance: {
          taxa_conversao: 0,
          visitas_perfil: 15,
          agendamentos_concluidos: 0,
          cliques_whatsapp: 0,
          cliques_maps: 0,
          favoritos_recebidos: 0
        },
        ranking_servicos: []
      }
    });

    render(<MemoryRouter><DashboardPage /></MemoryRouter>);

    expect(await screen.findByRole("heading", { name: "Transforme visitas em agendamentos" }))
      .not.toBeNull();
    expect(screen.getByText(/15 pessoas visitaram seu perfil/)).not.toBeNull();
    expect(screen.getByRole("link", { name: "Gerenciar serviços" }).getAttribute("href"))
      .toBe("/painel/servicos");
  });

  it("conduz o profissional para a primeira etapa incompleta", async () => {
    mockDashboardRequests({
      publication: {
        negocio: { slug: "studio-aurora", publicado: false },
        publicacao: {
          publicado: false,
          pode_publicar: false,
          pendencias: ["pelo menos um serviço ativo"]
        }
      }
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
