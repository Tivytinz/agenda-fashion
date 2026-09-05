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

function mockRequests() {
  apiRequest.mockImplementation((path) => {
    if (path.startsWith("/admin/dashboard")) {
      return Promise.resolve({
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
      });
    }

    if (path.startsWith("/admin/saude/perfis-incompletos")) {
      return Promise.resolve({
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
      });
    }

    if (path.startsWith("/admin/marketing/funil-profissionais")) {
      return Promise.resolve({
        resumo: {
          cadastros: 13,
          negociosCriados: 11,
          servicosCriados: 7,
          agendasConfiguradas: 2,
          negociosPublicados: 7,
          primeirosAgendamentos: 1,
          assinaturasAtivadas: 0
        }
      });
    }

    if (path === "/health/ready") {
      return Promise.resolve({ status: "ready", database: "ok" });
    }

    return Promise.reject(new Error(`Rota inesperada: ${path}`));
  });
}

beforeEach(() => {
  apiRequest.mockReset();
  mockRequests();
});

afterEach(cleanup);

describe("centro de comando do admin", () => {
  it("conecta saúde, ativação, funil e sinais da plataforma", async () => {
    render(
      <MemoryRouter>
        <AdminOverviewPage />
      </MemoryRouter>
    );

    expect(
      await screen.findByRole("heading", { name: "Centro de comando" })
    ).not.toBeNull();
    expect(screen.getByText("Operacional")).not.toBeNull();
    expect(screen.getByText("11 de 14 profissionais ainda têm etapas de ativação pendentes.")).not.toBeNull();
    expect(screen.getByText("Ana Nails")).not.toBeNull();
    expect(screen.getByText("Configurar agenda")).not.toBeNull();
    expect(screen.getByText("Agendas")).not.toBeNull();
    expect(screen.getByText("Goiânia")).not.toBeNull();

    await waitFor(() => {
      expect(apiRequest).toHaveBeenCalledTimes(4);
    });
  });

  it("recarrega indicadores quando o período muda", async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <AdminOverviewPage />
      </MemoryRouter>
    );

    await screen.findByText("Ana Nails");
    apiRequest.mockClear();
    await user.click(screen.getByRole("button", { name: "7 dias" }));

    await waitFor(() => {
      expect(apiRequest).toHaveBeenCalledWith(
        "/admin/dashboard?periodo=7",
        expect.objectContaining({ signal: expect.any(AbortSignal) })
      );
    });
  });
});
