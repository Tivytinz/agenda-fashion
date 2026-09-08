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

function mockRequests() {
  apiRequest.mockImplementation((path) => {
    if (path.startsWith("/admin/marketing/funil-profissionais")) {
      return Promise.resolve({
        resumo: {
          cadastros: 13,
          negociosCriados: 11,
          servicosCriados: 7,
          agendasConfiguradas: 2,
          negociosPublicados: 7,
          primeirosAgendamentos: 3,
          checkoutsIniciados: 1,
          assinaturasAtivadas: 1,
          taxaNegocio: 84.6,
          taxaServico: 53.8,
          taxaAgenda: 15.4,
          taxaPublicacao: 53.8,
          taxaPrimeiroAgendamento: 23.1,
          taxaCheckout: 7.7,
          taxaAssinatura: 7.7
        },
        qualidadeMensuracao: {
          cadastrosPagosDetectados: 8,
          coberturaAtribuicaoPagaPercentual: 100,
          coberturaMinimaPercentual: 100
        },
        campanhas: [
          {
            origem: "google",
            midia: "cpc",
            campanha: "google_ads_profissionais",
            classificacaoAtribuicao: "oficial",
            oficial: true,
            cadastros: 8,
            primeirosAgendamentos: 2,
            taxaPrimeiroAgendamento: 25,
            assinaturasAtivadas: 1,
            investimentoCentavos: 10000
          },
          {
            origem: "organico",
            midia: "none",
            campanha: "organico",
            classificacaoAtribuicao: "organico",
            oficial: false,
            cadastros: 4,
            primeirosAgendamentos: 1,
            taxaPrimeiroAgendamento: 25,
            assinaturasAtivadas: 0,
            investimentoCentavos: 0
          },
          {
            origem: "direct",
            midia: "none",
            campanha: "(sem campanha)",
            classificacaoAtribuicao: "sem_evidencia",
            oficial: false,
            cadastros: 1,
            primeirosAgendamentos: 0,
            taxaPrimeiroAgendamento: 0,
            assinaturasAtivadas: 0,
            investimentoCentavos: 0
          }
        ]
      });
    }

    if (path.startsWith("/admin/marketing/campanhas")) {
      return Promise.resolve({
        campanhas: [
          {
            origem: "google",
            midia: "cpc",
            campanha: "google_ads_profissionais",
            objetivo: "profissional",
            oficial: true,
            classificacaoAtribuicao: "oficial",
            sessoes: 40,
            sessoesAtribuicaoDireta: 30,
            sessoesAtribuicaoAssistida: 10,
            perfisVisualizados: 12,
            agendamentosConcluidos: 0
          },
          {
            origem: "meta",
            midia: "paid_social",
            campanha: "teste",
            objetivo: "indefinido",
            oficial: false,
            classificacaoAtribuicao: "identidade_nao_oficial",
            sessoes: 10,
            sessoesAtribuicaoDireta: 0,
            sessoesAtribuicaoAssistida: 0,
            perfisVisualizados: 1,
            agendamentosConcluidos: 0
          }
        ]
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
  it("separa volume, qualidade da coorte e cobertura de atribuição", async () => {
    render(
      <MemoryRouter initialEntries={["/admin/trafego-pago?periodo=7"]}>
        <AdminMarketingPage />
      </MemoryRouter>
    );

    expect(
      await screen.findByRole("heading", { name: "Marketing e aquisição" })
    ).not.toBeNull();

    expect(screen.getByText("Sessões no site")).not.toBeNull();
    expect(screen.getByText("90")).not.toBeNull();
    expect(screen.getByText("Cadastros profissionais")).not.toBeNull();
    expect(screen.getByText("1º agendamento válido")).not.toBeNull();
    expect(screen.getByText("Assinaturas pagas")).not.toBeNull();
    expect(screen.getByText("Comportamento + coorte + atribuição")).not.toBeNull();
    expect(screen.getByText("GA4 conectado")).not.toBeNull();
    expect(screen.getByText("100% dos cadastros pagos atribuídos")).not.toBeNull();
    expect(
      screen.getByText(/Sessões pagas com campanha reconhecida: 80%/)
    ).not.toBeNull();
    expect(screen.getByText(/30 diretas \+ 10 assistidas/)).not.toBeNull();
    expect(screen.getByTestId("marketing-ga4-panel")).not.toBeNull();

    expect(
      screen.getByRole("heading", { name: "Marcos da coorte profissional" })
    ).not.toBeNull();
    expect(screen.getByText("Agenda configurada")).not.toBeNull();
    expect(screen.getAllByText("Assinatura paga").length).toBeGreaterThan(0);

    expect(
      screen.getByRole("heading", { name: "Quais origens trazem profissionais que avançam" })
    ).not.toBeNull();
    expect(screen.getByText("google_ads_profissionais")).not.toBeNull();
    expect(screen.getByText("Orgânico")).not.toBeNull();
    expect(screen.getByText("Origens da coorte ainda sem evidência suficiente")).not.toBeNull();
    expect(screen.getByText("Campanha não identificada")).not.toBeNull();

    expect(
      screen.queryByText("Sincronização + análise")
    ).toBeNull();

    expect(screen.getByRole("button", { name: "7 dias" }).getAttribute("aria-pressed")).toBe("true");
    expect(
      screen.getByRole("link", { name: "Custos e retorno" }).getAttribute("href")
    ).toBe("/admin/trafego-pago/custos?periodo=7");
    expect(
      screen.getByRole("link", { name: "Integrações" }).getAttribute("href")
    ).toBe("/admin/trafego-pago/custos?periodo=7#integracoes-custos");
    expect(
      screen.getByRole("link", { name: "Gerenciar integrações" }).getAttribute("href")
    ).toBe("/admin/trafego-pago/custos?periodo=7#integracoes-custos");

    await waitFor(() => {
      expect(apiRequest).toHaveBeenCalledWith(
        "/admin/marketing/funil-profissionais?periodo=7",
        expect.objectContaining({ signal: expect.any(AbortSignal) })
      );
    });
    expect(
      apiRequest.mock.calls.some(([path]) => path.startsWith("/admin/marketing/resumo"))
    ).toBe(false);
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
  });
});
