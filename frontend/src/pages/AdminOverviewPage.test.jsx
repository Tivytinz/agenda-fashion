// @vitest-environment jsdom

import {
  cleanup,
  render,
  screen,
  waitFor
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi
} from "vitest";
import { apiRequest } from "../api/client";
import { AdminOverviewPage } from "./AdminOverviewPage";

vi.mock("../api/client", () => ({
  apiRequest: vi.fn()
}));

function dashboard() {
  return {
    indicadores: {
      totalProfissionais: 14,
      totalNegocios: 12,
      totalClientes: 7,
      totalAgendamentos: 3
    },
    metricas: {
      visitasPlataforma: 40,
      cliquesWhatsapp: 8,
      cliquesMaps: 4,
      favoritosTotais: 5
    },
    comportamento: {
      descobriram: 20,
      avaliaram: 10,
      iniciaram: 4,
      concluiram: 3
    }
  };
}

function funnel() {
  return {
    resumo: {
      cadastros: 13,
      negociosCriados: 11,
      servicosCriados: 7,
      agendasConfiguradas: 2,
      negociosPublicados: 2,
      primeirosAgendamentos: 1,
      checkoutsIniciados: 1,
      assinaturasAtivadas: 0
    }
  };
}

function recurrence() {
  return {
    resumo: {
      comPrimeiroAgendamento: 5,
      comSegundoAgendamento: 2,
      taxaSegundoSobrePrimeiro: 40
    },
    tempos: {
      primeiroParaSegundo: {
        amostra: 2,
        medianaDias: 12
      }
    }
  };
}

function mockRequests() {
  apiRequest.mockImplementation((path) => {
    if (path.startsWith("/admin/dashboard")) return Promise.resolve(dashboard());
    if (path.startsWith("/admin/marketing/funil-profissionais")) return Promise.resolve(funnel());
    if (path.startsWith("/admin/marketing/recorrencia-profissionais")) return Promise.resolve(recurrence());
    return Promise.reject(new Error(`Rota inesperada: ${path}`));
  });
}

beforeEach(() => {
  apiRequest.mockReset();
  mockRequests();
});

afterEach(cleanup);

describe("visão geral do admin", () => {
  it("prioriza KPIs e métricas agregadas do AF sem misturar operação individual", async () => {
    render(
      <MemoryRouter initialEntries={["/admin?periodo=30"]}>
        <AdminOverviewPage />
      </MemoryRouter>
    );

    expect(
      await screen.findByRole("heading", { name: "Visão geral" })
    ).not.toBeNull();
    expect(screen.getByRole("heading", { name: "Métricas — 30 dias" })).not.toBeNull();
    expect(screen.getAllByText("Cadastros profissionais").length).toBeGreaterThan(0);
    expect(screen.getByText("Ativações")).not.toBeNull();
    expect(screen.getByText("Agendamentos")).not.toBeNull();
    expect(screen.getAllByText("Assinaturas pagas").length).toBeGreaterThan(0);
    expect(screen.getByRole("heading", { name: "Ativação da coorte profissional" })).not.toBeNull();
    expect(screen.getByText("Taxa de ativação da coorte")).not.toBeNull();
    expect(screen.getAllByText(/7[,.]7%/).length).toBeGreaterThan(0);
    expect(screen.getByRole("heading", { name: "Conversão para assinatura" })).not.toBeNull();
    expect(screen.getByText("Taxa de assinatura na coorte")).not.toBeNull();
    expect(screen.getByRole("heading", { name: "Retenção dos negócios" })).not.toBeNull();
    expect(screen.getByText("40%")).not.toBeNull();
    expect(screen.getByText("12 dias")).not.toBeNull();
    expect(screen.getByText("Sessões na página inicial")).not.toBeNull();
    expect(screen.getByText("Sessões que viram perfis")).not.toBeNull();
    expect(screen.getByText("Sessões que iniciaram agendamento")).not.toBeNull();
    expect(screen.getByText("Sessões com reserva criada")).not.toBeNull();
    expect(screen.getByText("Clientes distintos que agendaram")).not.toBeNull();
    expect(screen.getByRole("heading", { name: "Interações na plataforma" })).not.toBeNull();

    expect(screen.queryByRole("heading", { name: "Situação atual" })).toBeNull();
    expect(screen.queryByRole("heading", { name: "Profissionais que precisam de atenção" })).toBeNull();
    expect(screen.queryByText("Ativações pendentes")).toBeNull();
    expect(screen.queryByText("Sistema")).toBeNull();
    expect(screen.queryByRole("link", { name: /Abrir ativação/ })).toBeNull();

    await waitFor(() => {
      expect(apiRequest).toHaveBeenCalledTimes(3);
    });
    const requestedPaths = apiRequest.mock.calls.map(([path]) => path);
    expect(requestedPaths.some((path) => path.startsWith("/admin/saude"))).toBe(false);
    expect(requestedPaths.includes("/health/ready")).toBe(false);
  });

  it("explica que os marcos da ativação não formam conversões adjacentes", async () => {
    render(
      <MemoryRouter initialEntries={["/admin?periodo=30"]}>
        <AdminOverviewPage />
      </MemoryRouter>
    );

    await screen.findByRole("heading", { name: "Ativação da coorte profissional" });
    const details = screen.getByText("Como interpretar estes marcos").closest("details");
    expect(details).not.toBeNull();
    expect(details?.textContent).toContain("não são conversões adjacentes");
    expect(details?.textContent).toContain("negócios legados");
  });

  it("não exibe zero dias quando ainda não existe segundo agendamento", async () => {
    apiRequest.mockImplementation((path) => {
      if (path.startsWith("/admin/dashboard")) return Promise.resolve(dashboard());
      if (path.startsWith("/admin/marketing/funil-profissionais")) return Promise.resolve(funnel());
      if (path.startsWith("/admin/marketing/recorrencia-profissionais")) {
        return Promise.resolve({
          resumo: {
            comPrimeiroAgendamento: 1,
            comSegundoAgendamento: 0,
            taxaSegundoSobrePrimeiro: 0
          },
          tempos: {
            primeiroParaSegundo: {
              amostra: 0,
              medianaDias: null
            }
          }
        });
      }
      return Promise.reject(new Error(`Rota inesperada: ${path}`));
    });

    render(
      <MemoryRouter initialEntries={["/admin?periodo=30"]}>
        <AdminOverviewPage />
      </MemoryRouter>
    );

    await screen.findByRole("heading", { name: "Visão geral" });
    expect(screen.getByText("Amostra insuficiente")).not.toBeNull();
    expect(screen.queryByText("0 dias")).toBeNull();
  });

  it("mostra taxa indisponível quando a coorte não tem cadastros", async () => {
    apiRequest.mockImplementation((path) => {
      if (path.startsWith("/admin/dashboard")) return Promise.resolve(dashboard());
      if (path.startsWith("/admin/marketing/funil-profissionais")) {
        return Promise.resolve({
          resumo: {
            ...funnel().resumo,
            cadastros: 0,
            primeirosAgendamentos: 0,
            assinaturasAtivadas: 0
          }
        });
      }
      if (path.startsWith("/admin/marketing/recorrencia-profissionais")) return Promise.resolve(recurrence());
      return Promise.reject(new Error(`Rota inesperada: ${path}`));
    });

    render(
      <MemoryRouter initialEntries={["/admin?periodo=today"]}>
        <AdminOverviewPage />
      </MemoryRouter>
    );

    await screen.findByRole("heading", { name: "Métricas — Hoje" });
    expect(screen.getByText("Taxa de ativação da coorte").closest("div")?.parentElement?.textContent).toContain("—");
    expect(screen.getByText("Taxa de assinatura na coorte").closest("div")?.textContent).toContain("—");
  });

  it("lê e atualiza o período pela URL sem apagar os dados anteriores", async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter initialEntries={["/admin?periodo=7"]}>
        <AdminOverviewPage />
      </MemoryRouter>
    );

    await screen.findByRole("heading", { name: "Métricas — 7 dias" });
    expect(screen.getByRole("button", { name: "7 dias" }).getAttribute("aria-pressed")).toBe("true");

    apiRequest.mockClear();
    const never = new Promise(() => {});
    apiRequest.mockReturnValue(never);

    await user.click(screen.getByRole("button", { name: "Hoje" }));

    expect(screen.getByRole("heading", { name: "Métricas — 7 dias" })).not.toBeNull();
    expect(screen.getByText(/Atualizando métricas sem ocultar/)).not.toBeNull();
    await waitFor(() => {
      expect(apiRequest).toHaveBeenCalledWith(
        "/admin/dashboard?periodo=today",
        expect.objectContaining({ signal: expect.any(AbortSignal) })
      );
    });
  });

  it("não rotula dados antigos como se fossem do novo período quando um indicador temporal falha", async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter initialEntries={["/admin?periodo=7"]}>
        <AdminOverviewPage />
      </MemoryRouter>
    );

    await screen.findByRole("heading", { name: "Métricas — 7 dias" });

    apiRequest.mockImplementation((path) => {
      if (path === "/admin/dashboard?periodo=today") {
        return Promise.reject(new Error("Dashboard indisponível"));
      }
      if (path === "/admin/marketing/funil-profissionais?periodo=today") {
        return Promise.resolve(funnel());
      }
      if (path.startsWith("/admin/marketing/recorrencia-profissionais")) {
        return Promise.resolve(recurrence());
      }
      return Promise.reject(new Error(`Rota inesperada: ${path}`));
    });

    await user.click(screen.getByRole("button", { name: "Hoje" }));

    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toContain("Dashboard indisponível");
    expect(screen.getByRole("heading", { name: "Métricas — 7 dias" })).not.toBeNull();
    expect(screen.queryByRole("heading", { name: "Métricas — Hoje" })).toBeNull();
  });

  it("não reaproveita recorrência de outro período quando a métrica opcional falha", async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter initialEntries={["/admin?periodo=7"]}>
        <AdminOverviewPage />
      </MemoryRouter>
    );

    await screen.findByText("12 dias");

    apiRequest.mockImplementation((path) => {
      if (path === "/admin/dashboard?periodo=today") return Promise.resolve(dashboard());
      if (path === "/admin/marketing/funil-profissionais?periodo=today") return Promise.resolve(funnel());
      if (path === "/admin/marketing/recorrencia-profissionais?periodo=today") {
        return Promise.reject(new Error("Recorrência indisponível"));
      }
      return Promise.reject(new Error(`Rota inesperada: ${path}`));
    });

    await user.click(screen.getByRole("button", { name: "Hoje" }));

    await screen.findByRole("heading", { name: "Métricas — Hoje" });
    expect(screen.getByText("Com 2º agendamento").closest("div")?.textContent).toContain("—");
    expect(screen.queryByText("12 dias")).toBeNull();
    expect(screen.getByRole("alert").textContent).toContain("Parte das métricas");
  });
});
