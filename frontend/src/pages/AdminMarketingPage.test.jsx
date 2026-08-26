// @vitest-environment jsdom

import {
  cleanup,
  render,
  screen,
  waitFor,
  within
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

const MANAGED_CAMPAIGN = {
  id: 7,
  nome: "Google Ads · Aquisição de profissionais",
  canal: "google",
  objetivo: "profissional",
  utmSource: "google",
  utmMedium: "cpc",
  utmCampaign: "google_ads_profissionais",
  utmContent: null,
  utmTerm: null,
  destinoPath: "/cadastro?tipo=profissional",
  ativo: true,
  linkRastreavel:
    "https://app.agendafashion.com.br/cadastro?tipo=profissional&utm_source=google&utm_medium=cpc&utm_campaign=google_ads_profissionais"
};

function mockMarketingRequests() {
  apiRequest.mockImplementation((path, options = {}) => {
    if (
      path === "/admin/marketing/gestao-campanhas" &&
      options.method === "POST"
    ) {
      return Promise.resolve({
        campanha: {
          id: 8,
          nome: options.body.nome,
          canal: options.body.canal,
          objetivo: options.body.objetivo,
          utmSource: options.body.utmSource,
          utmMedium: options.body.utmMedium,
          utmCampaign: "nova_campanha",
          utmContent: options.body.utmContent || null,
          utmTerm: options.body.utmTerm || null,
          destinoPath: options.body.destinoPath,
          ativo: true,
          linkRastreavel:
            "https://app.agendafashion.com.br/?utm_source=meta&utm_medium=cpc&utm_campaign=nova_campanha"
        }
      });
    }

    if (
      path.startsWith("/admin/marketing/gestao-campanhas/") &&
      options.method === "PATCH"
    ) {
      return Promise.resolve({
        campanha: {
          ...MANAGED_CAMPAIGN,
          objetivo: options.body.objetivo ?? MANAGED_CAMPAIGN.objetivo,
          ativo: options.body.ativo ?? MANAGED_CAMPAIGN.ativo
        }
      });
    }

    if (path === "/admin/marketing/gestao-campanhas") {
      return Promise.resolve({ campanhas: [MANAGED_CAMPAIGN] });
    }

    if (path.startsWith("/admin/marketing/resumo")) {
      return Promise.resolve({
        periodo: "30",
        totalSessoes: 23,
        sessoes: 19,
        sessoesSemAtribuicao: 4,
        campanhas: 3,
        perfisVisualizados: 8,
        agendamentosIniciados: 2,
        sessoesConvertidas: 1,
        agendamentosConcluidos: 1,
        taxaConversao: 5.26
      });
    }

    if (path.startsWith("/admin/marketing/campanhas")) {
      return Promise.resolve({
        periodo: "30",
        campanhas: [
          {
            origem: "google",
            midia: "cpc",
            campanha: "google_ads_profissionais",
            oficial: true,
            classificacaoAtribuicao: "oficial",
            sessoes: 12,
            perfisVisualizados: 7,
            agendamentosIniciados: 1,
            sessoesConvertidas: 1,
            agendamentosConcluidos: 1,
            taxaConversao: 8.33
          },
          {
            origem: "google",
            midia: "cpc",
            campanha: "(sem campanha)",
            oficial: false,
            classificacaoAtribuicao: "rastreamento_incompleto",
            sessoes: 6,
            perfisVisualizados: 0,
            agendamentosIniciados: 0,
            agendamentosConcluidos: 0,
            taxaConversao: 0
          },
          {
            origem: "meta",
            midia: "paid_social",
            campanha: "teste",
            oficial: false,
            classificacaoAtribuicao: "identidade_nao_oficial",
            sessoes: 1,
            perfisVisualizados: 1,
            agendamentosIniciados: 1,
            agendamentosConcluidos: 0,
            taxaConversao: 0
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
            negocioNome: "Studio Oficial",
            origem: "google",
            midia: "cpc",
            campanha: "google_ads_profissionais",
            oficial: true,
            classificacaoAtribuicao: "oficial",
            landingPage: "/cadastro",
            createdAt: "2026-08-24T02:00:00.000Z"
          },
          {
            eventoId: 89,
            agendamentoId: 43,
            negocioNome: "Studio Teste",
            origem: "meta",
            midia: "paid_social",
            campanha: "teste",
            oficial: false,
            classificacaoAtribuicao: "identidade_nao_oficial",
            landingPage: "/",
            createdAt: "2026-08-24T02:10:00.000Z"
          }
        ]
      });
    }

    return Promise.reject(new Error("Rota inesperada"));
  });
}

beforeEach(() => {
  apiRequest.mockReset();
  mockMarketingRequests();
});

afterEach(() => {
  vi.restoreAllMocks();
  cleanup();
});

describe("AdminMarketingPage", () => {
  it("separa tráfego oficial, atribuição e resultados pelo objetivo", async () => {
    render(<AdminMarketingPage />);

    expect(
      await screen.findByRole("heading", { name: "Campanhas e tráfego" })
    ).not.toBeNull();

    expect(screen.getByText("Sessões oficiais")).not.toBeNull();
    expect(screen.getByText("Cobertura do tráfego pago")).not.toBeNull();
    expect(screen.getByText("Campanhas ativas")).not.toBeNull();
    expect(screen.getByText("Agendamentos de clientes")).not.toBeNull();
    expect(screen.getByText("Qualidade da medição paga")).not.toBeNull();
    expect(screen.getAllByText("Aquisição de profissionais").length).toBeGreaterThanOrEqual(1);

    expect(
      screen.getAllByText("google_ads_profissionais").length
    ).toBeGreaterThanOrEqual(1);
    expect(screen.queryByText("teste")).toBeNull();
    expect(screen.queryByText("Studio Oficial")).toBeNull();
    expect(screen.queryByText("Studio Teste")).toBeNull();
    expect(screen.getByText("Sessões oficiais por origem")).not.toBeNull();
    expect(screen.getByText("Resumo oficial por origem")).not.toBeNull();
    expect(screen.getByText("Ver Rentabilidade")).not.toBeNull();
    expect(apiRequest).toHaveBeenCalledTimes(4);
  });

  it("explica claramente acesso autônomo e não confunde com tráfego pago incompleto", async () => {
    render(<AdminMarketingPage />);

    expect(await screen.findByText(/Acesso autônomo ·/)).not.toBeNull();
    expect(
      screen.getByText(/Chegou sem origem, campanha UTM ou identificador de anúncio/i)
    ).not.toBeNull();
    expect(
      screen.getByText(/Pode ser acesso direto, busca orgânica ou link compartilhado/i)
    ).not.toBeNull();

    expect(
      screen.getByText(/6 sessões pagas com rastreamento incompleto/i)
    ).not.toBeNull();
    expect(
      screen.getByText(/Não são acessos autônomos\. Há sinal de mídia paga/i)
    ).not.toBeNull();
    expect(
      screen.getByText(/1 sessão com identidade não oficial/i)
    ).not.toBeNull();
    expect(
      screen.getByRole("button", {
        name: "Copiar link correto de Google Ads · Aquisição de profissionais"
      })
    ).not.toBeNull();
  });

  it("lista agendamentos somente quando a campanha oficial tem objetivo cliente", async () => {
    const originalImplementation = apiRequest.getMockImplementation();
    apiRequest.mockImplementation((path, options) => {
      if (path === "/admin/marketing/gestao-campanhas") {
        return Promise.resolve({
          campanhas: [{ ...MANAGED_CAMPAIGN, objetivo: "cliente" }]
        });
      }

      if (path.startsWith("/admin/marketing/campanhas")) {
        return Promise.resolve({
          periodo: "30",
          campanhas: [
            {
              origem: "google",
              midia: "cpc",
              campanha: "google_ads_profissionais",
              objetivo: "cliente",
              oficial: true,
              classificacaoAtribuicao: "oficial",
              sessoes: 12,
              perfisVisualizados: 7,
              agendamentosIniciados: 1,
              sessoesConvertidas: 1,
              agendamentosConcluidos: 1,
              taxaConversao: 8.33
            }
          ]
        });
      }

      return originalImplementation(path, options);
    });

    render(<AdminMarketingPage />);

    expect(await screen.findByText("Studio Oficial")).not.toBeNull();
    expect(screen.getAllByText("Aquisição de clientes").length).toBeGreaterThanOrEqual(1);
    expect(screen.queryByText("Ver Rentabilidade")).toBeNull();
  });

  it("mantém configurações técnicas recolhidas e cria nova campanha oficial", async () => {
    const user = userEvent.setup();
    render(<AdminMarketingPage />);

    await screen.findByRole("heading", { name: "Campanhas e tráfego" });
    await user.click(screen.getByRole("button", { name: "+ Nova campanha oficial" }));

    const summary = screen.getByText("Configurações avançadas de rastreamento");
    const details = summary.closest("details");
    expect(details?.open).toBe(false);

    await user.click(summary);
    expect(details?.open).toBe(true);

    await user.type(screen.getByLabelText("Nome da campanha"), "Nova Campanha");
    await user.selectOptions(screen.getByLabelText(/Objetivo/), "cliente");
    await user.click(screen.getByRole("button", { name: "Criar campanha oficial" }));

    await waitFor(() => {
      expect(apiRequest).toHaveBeenCalledWith(
        "/admin/marketing/gestao-campanhas",
        expect.objectContaining({
          method: "POST",
          body: expect.objectContaining({
            nome: "Nova Campanha",
            objetivo: "cliente"
          })
        })
      );
    });

    expect(
      await screen.findByText(
        "Campanha oficial criada. O link rastreável já está pronto para uso."
      )
    ).not.toBeNull();
  });

  it("arquiva campanha oficial e a remove dos indicadores ativos", async () => {
    const user = userEvent.setup();
    render(<AdminMarketingPage />);

    const campaignName = await screen.findByText(
      "Google Ads · Aquisição de profissionais"
    );
    const row = campaignName.closest("tr");
    expect(row).not.toBeNull();

    await user.click(
      within(row).getByLabelText(
        "Mais ações de Google Ads · Aquisição de profissionais"
      )
    );
    await user.click(within(row).getByRole("button", { name: "Arquivar" }));

    await waitFor(() => {
      expect(apiRequest).toHaveBeenCalledWith(
        "/admin/marketing/gestao-campanhas/7",
        { method: "PATCH", body: { ativo: false } }
      );
    });

    expect(
      await screen.findByText(
        "Campanha arquivada. O histórico continua nos indicadores oficiais."
      )
    ).not.toBeNull();
    expect(
      screen.getAllByText("google_ads_profissionais").length
    ).toBeGreaterThanOrEqual(1);
    expect(
      screen.queryByText("Google Ads · Aquisição de profissionais")
    ).toBeNull();

    await user.click(screen.getByRole("button", { name: "Mostrar arquivadas (1)" }));
    expect(
      await screen.findByText("Google Ads · Aquisição de profissionais")
    ).not.toBeNull();
    expect(screen.getByText("Arquivada")).not.toBeNull();
  });

  it("recarrega os dados ao trocar o período", async () => {
    const user = userEvent.setup();
    render(<AdminMarketingPage />);

    await screen.findByRole("heading", { name: "Campanhas e tráfego" });
    await user.click(screen.getByRole("button", { name: "7 dias" }));

    await waitFor(() => {
      expect(apiRequest).toHaveBeenCalledWith(
        "/admin/marketing/resumo?periodo=7",
        expect.any(Object)
      );
    });
    expect(apiRequest).toHaveBeenCalledWith(
      "/admin/marketing/campanhas?periodo=7",
      expect.any(Object)
    );
    expect(apiRequest).toHaveBeenCalledWith(
      "/admin/marketing/conversoes?periodo=7",
      expect.any(Object)
    );
  });

  it("não reaproveita métricas de outro período quando uma API crítica falha", async () => {
    const user = userEvent.setup();
    render(<AdminMarketingPage />);

    await screen.findByRole("heading", { name: "Campanhas e tráfego" });

    const originalImplementation = apiRequest.getMockImplementation();
    apiRequest.mockImplementation((path, options) => {
      if (path === "/admin/marketing/resumo?periodo=7") {
        return Promise.reject(new Error("Resumo de 7 dias indisponível"));
      }
      return originalImplementation(path, options);
    });

    await user.click(screen.getByRole("button", { name: "7 dias" }));

    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toContain("Resumo de 7 dias indisponível");
    expect(
      screen.queryByText("Google Ads · Aquisição de profissionais")
    ).toBeNull();
  });

  it("mantém as seções úteis quando uma API falha", async () => {
    const originalImplementation = apiRequest.getMockImplementation();
    apiRequest.mockImplementation((path, options) => {
      if (path.startsWith("/admin/marketing/conversoes")) {
        return Promise.reject(new Error("Conversões indisponíveis"));
      }
      return originalImplementation(path, options);
    });

    render(<AdminMarketingPage />);

    expect(
      await screen.findByRole("heading", { name: "Campanhas e tráfego" })
    ).not.toBeNull();
    expect(screen.getByText("Google Ads · Aquisição de profissionais")).not.toBeNull();
    expect(screen.getByRole("alert").textContent).toContain(
      "Parte dos dados de marketing"
    );
  });
});
