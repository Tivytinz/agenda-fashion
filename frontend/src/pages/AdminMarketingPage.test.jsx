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
  nome: "Meta Cílios",
  canal: "meta",
  objetivo: "indefinido",
  utmSource: "meta",
  utmMedium: "cpc",
  utmCampaign: "meta_cilios",
  utmContent: null,
  utmTerm: null,
  destinoPath: "/",
  ativo: true,
  linkRastreavel:
    "https://app.agendafashion.com.br/?utm_source=meta&utm_medium=cpc&utm_campaign=meta_cilios"
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
          utmCampaign: "cilios_goiania_agosto",
          utmContent: options.body.utmContent || null,
          utmTerm: options.body.utmTerm || null,
          destinoPath: options.body.destinoPath,
          ativo: true,
          linkRastreavel:
            "https://app.agendafashion.com.br/?utm_source=meta&utm_medium=cpc&utm_campaign=cilios_goiania_agosto"
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
        sessoes: 100,
        campanhas: 2,
        perfisVisualizados: 60,
        agendamentosIniciados: 20,
        agendamentosConcluidos: 10,
        taxaConversao: 10
      });
    }

    if (path.startsWith("/admin/marketing/campanhas")) {
      return Promise.resolve({
        periodo: "30",
        campanhas: [
          {
            origem: "facebook",
            midia: "cpc",
            campanha: "goiania_cilios",
            sessoes: 100,
            perfisVisualizados: 60,
            agendamentosIniciados: 20,
            agendamentosConcluidos: 10,
            taxaConversao: 10
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
            negocioNome: "Studio Bella",
            campanha: "goiania_cilios",
            landingPage: "/negocio/studio-bella",
            createdAt: "2026-08-10T20:00:00.000Z"
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
  it("carrega métricas, estatísticas e transforma campanha legada em pendência acionável", async () => {
    render(<AdminMarketingPage />);

    expect(
      await screen.findByRole("heading", { name: "Campanhas e tráfego pago" })
    ).not.toBeNull();
    expect(screen.getAllByText("100").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("Identidades rastreadas")).not.toBeNull();
    expect(screen.getByText("combinações de origem, mídia e campanha"))
      .not.toBeNull();
    expect(screen.getAllByText("goiania_cilios").length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText("Studio Bella")).not.toBeNull();
    expect(screen.getByText("Meta Cílios")).not.toBeNull();
    expect(screen.getByText("Não classificado")).not.toBeNull();
    expect(screen.getByText(/1 campanha sem classificação/i)).not.toBeNull();
    expect(screen.getByText("Sessões por origem")).not.toBeNull();
    expect(screen.getByText("Resumo por origem")).not.toBeNull();
    expect(
      screen.getByRole("button", { name: "Revisar classificação" })
    ).not.toBeNull();
    expect(apiRequest).toHaveBeenCalledTimes(4);
  });

  it("avisa de forma profissional quando tráfego pago chega sem campanha UTM", async () => {
    const originalImplementation = apiRequest.getMockImplementation();
    apiRequest.mockImplementation((path, options) => {
      if (path.startsWith("/admin/marketing/campanhas")) {
        return Promise.resolve({
          periodo: "30",
          campanhas: [
            {
              origem: "meta",
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
      return originalImplementation(path, options);
    });

    render(<AdminMarketingPage />);

    expect(await screen.findByText(/5 sessões pagas sem campanha/i)).not.toBeNull();
    expect(screen.getByText("Tráfego pago sem campanha")).not.toBeNull();
    expect(screen.getByText("Campanha UTM não recebida")).not.toBeNull();
    expect(
      screen.getByRole("button", { name: "Copiar link correto de Meta Cílios" })
    ).not.toBeNull();
  });

  it("mantém UTMs técnicas recolhidas e permite abri-las sob demanda", async () => {
    const user = userEvent.setup();
    render(<AdminMarketingPage />);

    await screen.findByRole("heading", { name: "Campanhas e tráfego pago" });
    await user.click(screen.getByRole("button", { name: "+ Nova campanha" }));
    const summary = screen.getByText("Configurações avançadas de rastreamento");
    const details = summary.closest("details");

    expect(details?.open).toBe(false);
    await user.click(summary);
    expect(details?.open).toBe(true);
    expect(screen.getByLabelText("Origem UTM").value).toBe("meta");
    expect(screen.getByLabelText("Mídia UTM").value).toBe("cpc");
  });

  it("cria campanha somente depois de escolher o objetivo", async () => {
    const user = userEvent.setup();
    render(<AdminMarketingPage />);

    await screen.findByRole("heading", { name: "Campanhas e tráfego pago" });
    await user.click(screen.getByRole("button", { name: "+ Nova campanha" }));
    await user.type(screen.getByLabelText("Nome da campanha"), "Cílios Goiânia Agosto");
    await user.selectOptions(screen.getByLabelText(/Objetivo/), "cliente");
    await user.click(screen.getByRole("button", { name: "Criar campanha e link" }));

    await waitFor(() => {
      expect(apiRequest).toHaveBeenCalledWith(
        "/admin/marketing/gestao-campanhas",
        expect.objectContaining({
          method: "POST",
          body: expect.objectContaining({
            nome: "Cílios Goiânia Agosto",
            canal: "meta",
            objetivo: "cliente",
            utmSource: "meta",
            utmMedium: "cpc",
            destinoPath: "/"
          })
        })
      );
    });

    expect(
      await screen.findByText("Campanha criada. O link rastreável já está pronto para uso.")
    ).not.toBeNull();
    expect(screen.getByText("Cílios Goiânia Agosto")).not.toBeNull();
    expect(screen.getByRole("cell", { name: "Aquisição de clientes" })).not.toBeNull();
  });

  it("classifica campanha legada com confirmação explícita", async () => {
    const user = userEvent.setup();
    vi.spyOn(window, "confirm").mockReturnValue(true);
    render(<AdminMarketingPage />);

    const campaignName = await screen.findByText("Meta Cílios");
    const campaignRow = campaignName.closest("tr");
    expect(campaignRow).not.toBeNull();

    await user.click(within(campaignRow).getByRole("button", { name: "Classificar" }));
    expect(
      within(campaignRow).getByText(/Escolha uma vez\. Depois o objetivo fica travado/)
    ).not.toBeNull();
    await user.click(within(campaignRow).getByRole("button", { name: "Profissional" }));

    await waitFor(() => {
      expect(apiRequest).toHaveBeenCalledWith(
        "/admin/marketing/gestao-campanhas/7",
        { method: "PATCH", body: { objetivo: "profissional" } }
      );
    });

    expect(
      await screen.findByRole("cell", { name: "Aquisição de profissionais" })
    ).not.toBeNull();
    expect(
      screen.getByText("Objetivo definido como Aquisição de profissionais.")
    ).not.toBeNull();
  });

  it("mantém arquivamento em menu de ação secundária", async () => {
    const user = userEvent.setup();
    render(<AdminMarketingPage />);

    const campaignName = await screen.findByText("Meta Cílios");
    const row = campaignName.closest("tr");
    expect(row).not.toBeNull();

    await user.click(within(row).getByLabelText("Mais ações de Meta Cílios"));
    await user.click(within(row).getByRole("button", { name: "Arquivar" }));

    await waitFor(() => {
      expect(apiRequest).toHaveBeenCalledWith(
        "/admin/marketing/gestao-campanhas/7",
        { method: "PATCH", body: { ativo: false } }
      );
    });
    expect(
      await screen.findByText("Campanha arquivada e removida da visão principal.")
    ).not.toBeNull();
    expect(screen.queryByText("Meta Cílios")).toBeNull();

    await user.click(screen.getByRole("button", { name: "Mostrar arquivadas (1)" }));
    expect(await screen.findByText("Meta Cílios")).not.toBeNull();
    expect(screen.getByText("Arquivada")).not.toBeNull();
  });

  it("recarrega as visões ao trocar o período", async () => {
    const user = userEvent.setup();
    render(<AdminMarketingPage />);

    await screen.findByRole("heading", { name: "Campanhas e tráfego pago" });
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

  it("mantém as seções disponíveis quando uma API falha", async () => {
    const originalImplementation = apiRequest.getMockImplementation();
    apiRequest.mockImplementation((path, options) => {
      if (path.startsWith("/admin/marketing/conversoes")) {
        return Promise.reject(new Error("Conversões indisponíveis"));
      }
      return originalImplementation(path, options);
    });

    render(<AdminMarketingPage />);

    expect(
      await screen.findByRole("heading", { name: "Campanhas e tráfego pago" })
    ).not.toBeNull();
    expect(screen.getByText("Meta Cílios")).not.toBeNull();
    expect(screen.getByRole("alert").textContent).toContain("Parte dos dados de marketing");
  });

  it("preserva a última seção carregada durante uma falha de atualização", async () => {
    const user = userEvent.setup();
    render(<AdminMarketingPage />);
    await screen.findByText("Studio Bella");

    const originalImplementation = apiRequest.getMockImplementation();
    apiRequest.mockImplementation((path, options) => {
      if (path === "/admin/marketing/conversoes?periodo=7") {
        return Promise.reject(new Error("Conversões indisponíveis"));
      }
      return originalImplementation(path, options);
    });

    await user.click(screen.getByRole("button", { name: "7 dias" }));
    await screen.findByRole("alert");
    expect(screen.getByText("Studio Bella")).not.toBeNull();
  });
});
