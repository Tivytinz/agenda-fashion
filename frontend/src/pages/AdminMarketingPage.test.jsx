// @vitest-environment jsdom

import {
  cleanup,
  render,
  screen,
  waitFor
} from "@testing-library/react";
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
import { AdminMarketingPage } from "./AdminMarketingPage";

vi.mock("../api/client", () => ({
  apiRequest: vi.fn()
}));

vi.mock("../components/MarketingGa4Panel", () => ({
  MarketingGa4Panel: ({ data }) => (
    <section data-testid="marketing-ga4-panel">
      {data?.erro ? `GA4: ${data.erro}` : "Comportamento no site"}
    </section>
  )
}));

vi.mock("../components/MarketingSyncPanel", () => ({
  MarketingSyncPanel: () => (
    <section data-testid="marketing-sync-panel">
      Sincronização + análise
    </section>
  )
}));

function mockRequests() {
  apiRequest.mockImplementation((path) => {
    if (path.startsWith("/admin/marketing/funil-profissionais")) {
      return Promise.resolve({
        resumo: {
          cadastros: 20,
          negociosCriados: 15,
          servicosCriados: 13,
          negociosPublicados: 11,
          primeirosAgendamentos: 6,
          checkoutsIniciados: 3,
          assinaturasAtivadas: 2,
          taxaNegocio: 75,
          taxaServico: 65,
          taxaPublicacao: 55,
          taxaPrimeiroAgendamento: 30,
          taxaCheckout: 15,
          taxaAssinatura: 10
        },
        qualidadeMensuracao: {
          coberturaAtribuicaoPagaPercentual: 100
        }
      });
    }

    if (path.startsWith("/admin/marketing/campanhas")) {
      return Promise.resolve({
        campanhas: [
          {
            origem: "google",
            midia: "cpc",
            campanha: "123456",
            objetivo: "profissional",
            oficial: true,
            classificacaoAtribuicao: "oficial",
            sessoes: 40,
            sessoesAtribuicaoDireta: 30,
            sessoesAtribuicaoAssistida: 10,
            perfisVisualizados: 12,
            agendamentosConcluidos: 0
          }
        ]
      });
    }

    if (path.startsWith("/admin/marketing/resumo")) {
      return Promise.resolve({
        sessoesSemAtribuicao: 0
      });
    }

    if (path.startsWith("/admin/marketing/ga4")) {
      return Promise.resolve({
        habilitado: true,
        configurado: true,
        resumo: {
          sessoes: 90,
          usuarios: 64,
          novosUsuarios: 28,
          sessoesEngajadas: 51,
          taxaEngajamentoPercentual: 56.7,
          visualizacoes: 170
        }
      });
    }

    return Promise.reject(new Error(`Rota inesperada: ${path}`));
  });
}

beforeEach(() => {
  apiRequest.mockReset();
  mockRequests();
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("AdminMarketingPage", () => {
  it("prioriza jornada, comportamento, funil e resultado final", async () => {
    render(
      <MemoryRouter>
        <AdminMarketingPage />
      </MemoryRouter>
    );

    expect(
      await screen.findByRole("heading", { name: "Marketing e aquisição" })
    ).not.toBeNull();

    expect(screen.getByText("Sessões no site")).not.toBeNull();
    expect(screen.getByText("90")).not.toBeNull();
    expect(screen.getByText("Cadastros profissionais")).not.toBeNull();
    expect(screen.getByText("Primeiros agendamentos")).not.toBeNull();
    expect(screen.getByText("Assinaturas ativadas")).not.toBeNull();
    expect(screen.getByText("Comportamento + funil + atribuição")).not.toBeNull();
    expect(screen.getByText("GA4 conectado")).not.toBeNull();
    expect(screen.getByText("100% do tráfego pago identificado")).not.toBeNull();
    expect(screen.getByText("30 diretas + 10 assistidas")).not.toBeNull();
    expect(screen.getByTestId("marketing-ga4-panel")).not.toBeNull();
    expect(screen.getByTestId("marketing-sync-panel")).not.toBeNull();
    expect(screen.getByText("Da aquisição ao resultado")).not.toBeNull();
    expect(screen.getByText("Campanhas reconhecidas pelo AF")).not.toBeNull();
    expect(screen.getByText("123456")).not.toBeNull();

    expect(
      screen.queryByRole("button", { name: /Nova campanha oficial/i })
    ).toBeNull();

    await waitFor(() => {
      expect(apiRequest).toHaveBeenCalledTimes(4);
    });
  });

  it("preserva o Marketing quando apenas o GA4 falha", async () => {
    const originalImplementation = apiRequest.getMockImplementation();
    apiRequest.mockImplementation((path, options) => {
      if (path.startsWith("/admin/marketing/ga4")) {
        return Promise.reject(new Error("GA4 indisponível"));
      }
      return originalImplementation(path, options);
    });

    render(
      <MemoryRouter>
        <AdminMarketingPage />
      </MemoryRouter>
    );

    expect(
      await screen.findByRole("heading", { name: "Marketing e aquisição" })
    ).not.toBeNull();
    expect(screen.getByText("Cadastros profissionais")).not.toBeNull();
    expect(screen.getByText("GA4 indisponível")).not.toBeNull();
    expect(screen.getByText("GA4: GA4 indisponível")).not.toBeNull();
    expect(
      screen.queryByText(
        /parte dos indicadores está temporariamente indisponível/i
      )
    ).toBeNull();
  });
});
