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
    destaques: { cidadeTop: "Goiânia" },
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
      assinaturasAtivadas: 0
    }
  };
}

function activation() {
  return {
    resumo: {
      totalProfissionais: 14,
      totalIncompletos: 11,
      semAgenda: 9,
      semServico: 4,
      naoPublicados: 4,
      semNegocio: 2
    },
    perfis: [{
      usuarioId: 9,
      nome: "Ana Nails",
      negocio: { nome: "Studio Ana" },
      proximaAcao: { rotulo: "Configurar agenda" }
    }]
  };
}

function mockRequests() {
  apiRequest.mockImplementation((path) => {
    if (path.startsWith("/admin/dashboard")) return Promise.resolve(dashboard());
    if (path.startsWith("/admin/saude/perfis-incompletos")) return Promise.resolve(activation());
    if (path.startsWith("/admin/marketing/funil-profissionais")) return Promise.resolve(funnel());
    if (path === "/health/ready") return Promise.resolve({ status: "ready", database: "ok" });
    return Promise.reject(new Error(`Rota inesperada: ${path}`));
  });
}

beforeEach(() => {
  apiRequest.mockReset();
  mockRequests();
});

afterEach(cleanup);

describe("centro de comando do admin", () => {
  it("separa estado atual de desempenho temporal e aponta a maior perda", async () => {
    render(
      <MemoryRouter initialEntries={["/admin?periodo=30"]}>
        <AdminOverviewPage />
      </MemoryRouter>
    );

    expect(
      await screen.findByRole("heading", { name: "Centro de comando" })
    ).not.toBeNull();
    expect(screen.getByRole("heading", { name: "Situação atual" })).not.toBeNull();
    expect(screen.getByRole("heading", { name: "Desempenho — 30 dias" })).not.toBeNull();
    expect(screen.getByText("Profissionais no período")).not.toBeNull();
    expect(screen.getByText("Negócios criados")).not.toBeNull();
    expect(screen.getByText("Clientes que agendaram")).not.toBeNull();
    expect(screen.getByText("Agendas")).not.toBeNull();
    expect(screen.getByText(/Maior perda observada: Serviços → Agendas/)).not.toBeNull();
    expect(screen.getByText("Goiânia")).not.toBeNull();

    const semAgenda = screen.getByRole("link", { name: /Sem agenda/ });
    expect(semAgenda.getAttribute("href")).toBe("/admin/saude?pendencia=agenda");

    const ana = screen.getByRole("link", { name: "Abrir ativação →" });
    expect(ana.getAttribute("href")).toContain("busca=Ana");

    const fullFunnel = screen.getByRole("link", { name: "Ver funil completo" });
    expect(fullFunnel.getAttribute("href")).toBe("/admin/trafego-pago/profissionais?periodo=30");

    await waitFor(() => {
      expect(apiRequest).toHaveBeenCalledTimes(4);
    });
  });

  it("lê e atualiza o período pela URL sem apagar os dados anteriores", async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter initialEntries={["/admin?periodo=7"]}>
        <AdminOverviewPage />
      </MemoryRouter>
    );

    await screen.findByText("Ana Nails");
    expect(screen.getByRole("button", { name: "7 dias" }).getAttribute("aria-pressed")).toBe("true");
    expect(screen.getByRole("heading", { name: "Desempenho — 7 dias" })).not.toBeNull();

    apiRequest.mockClear();
    const never = new Promise(() => {});
    apiRequest.mockReturnValue(never);

    await user.click(screen.getByRole("button", { name: "Hoje" }));

    expect(screen.getByText("Goiânia")).not.toBeNull();
    expect(screen.getByText(/Atualizando centro de comando sem ocultar/)).not.toBeNull();
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

    await screen.findByRole("heading", { name: "Desempenho — 7 dias" });

    apiRequest.mockImplementation((path) => {
      if (path === "/admin/dashboard?periodo=today") {
        return Promise.reject(new Error("Dashboard indisponível"));
      }
      if (path === "/admin/marketing/funil-profissionais?periodo=today") {
        return Promise.resolve(funnel());
      }
      if (path.startsWith("/admin/saude/perfis-incompletos")) {
        return Promise.resolve(activation());
      }
      if (path === "/health/ready") {
        return Promise.resolve({ status: "ready", database: "ok" });
      }
      return Promise.reject(new Error(`Rota inesperada: ${path}`));
    });

    await user.click(screen.getByRole("button", { name: "Hoje" }));

    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toContain("Dashboard indisponível");
    expect(screen.getByRole("heading", { name: "Desempenho — 7 dias" })).not.toBeNull();
    expect(screen.queryByRole("heading", { name: "Desempenho — Hoje" })).toBeNull();
  });

  it("não converte falha da ativação em zero", async () => {
    apiRequest.mockImplementation((path) => {
      if (path.startsWith("/admin/dashboard")) return Promise.resolve(dashboard());
      if (path.startsWith("/admin/saude/perfis-incompletos")) {
        return Promise.reject(new Error("Ativação indisponível"));
      }
      if (path.startsWith("/admin/marketing/funil-profissionais")) return Promise.resolve(funnel());
      if (path === "/health/ready") return Promise.resolve({ status: "ready", database: "ok" });
      return Promise.reject(new Error(`Rota inesperada: ${path}`));
    });

    render(
      <MemoryRouter initialEntries={["/admin?periodo=30"]}>
        <AdminOverviewPage />
      </MemoryRouter>
    );

    await screen.findByRole("heading", { name: "Centro de comando" });
    const pendingCard = screen.getByText("Ativações pendentes").closest("article");
    expect(pendingCard?.textContent).toContain("—");
    expect(pendingCard?.textContent).toContain("Dados de ativação indisponíveis");
    expect(screen.queryByText("Ana Nails")).toBeNull();
  });
});
