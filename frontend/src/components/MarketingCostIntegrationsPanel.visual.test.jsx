// @vitest-environment jsdom

import {
  cleanup,
  render,
  screen,
  waitFor
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
import { MarketingCostIntegrationsPanel } from "./MarketingCostIntegrationsPanel";

vi.mock("../api/client", () => ({
  apiRequest: vi.fn()
}));

function integrations() {
  return {
    provedores: [
      {
        provedor: "google_ads",
        nome: "Google Ads",
        habilitado: false,
        configurado: false,
        contaExternaId: null,
        vinculos: 0,
        ultimaSincronizacao: null
      },
      {
        provedor: "meta_ads",
        nome: "Meta Ads",
        habilitado: false,
        configurado: false,
        contaExternaId: null,
        vinculos: 0,
        ultimaSincronizacao: null
      },
      {
        provedor: "pinterest_ads",
        nome: "Pinterest Ads",
        habilitado: true,
        configurado: true,
        contaExternaId: "549768356618",
        vinculos: 0,
        ultimaSincronizacao: null
      },
      {
        provedor: "tiktok_ads",
        nome: "TikTok Ads",
        habilitado: true,
        configurado: true,
        contaExternaId: "7488990011223344556",
        vinculos: 0,
        ultimaSincronizacao: null
      }
    ],
    vinculos: []
  };
}

function mockRequests() {
  apiRequest.mockImplementation((path, options = {}) => {
    if (path === "/admin/marketing/custos-integracoes") {
      return Promise.resolve(integrations());
    }

    if (path === "/admin/marketing/gestao-campanhas") {
      return Promise.resolve({
        campanhas: [
          { id: 11, nome: "Pinterest Agosto", canal: "pinterest", ativo: true },
          { id: 12, nome: "TikTok Agosto", canal: "tiktok", ativo: true }
        ]
      });
    }

    if (path === "/admin/marketing/custos-integracoes/pinterest_ads/campanhas") {
      return Promise.resolve({
        provedor: "pinterest_ads",
        contaExternaId: "549768356618",
        campanhas: [
          {
            id: "101",
            nome: "Pinterest Profissionais",
            status: "ACTIVE",
            tipo: "TRAFFIC"
          }
        ]
      });
    }

    if (path === "/admin/marketing/custos-integracoes/tiktok_ads/campanhas") {
      return Promise.resolve({
        provedor: "tiktok_ads",
        contaExternaId: "7488990011223344556",
        campanhas: [
          {
            id: "2001",
            nome: "TikTok Profissionais",
            status: "ENABLE",
            tipo: "TRAFFIC"
          }
        ]
      });
    }

    if (
      path === "/admin/marketing/custos-integracoes/tiktok_ads/testar" &&
      options.method === "POST"
    ) {
      return Promise.resolve({
        provedor: "tiktok_ads",
        conectado: true,
        contaExternaId: "7488990011223344556",
        nomeConta: "Agenda Fashion TikTok",
        moeda: "BRL",
        fusoHorario: "America/Sao_Paulo",
        apiVersion: "v1.3"
      });
    }

    if (
      path === "/admin/marketing/custos-integracoes/vinculos" &&
      options.method === "POST"
    ) {
      return Promise.resolve({ vinculo: { id: 30 } });
    }

    return Promise.reject(new Error(`Rota inesperada: ${path}`));
  });
}

beforeEach(() => {
  apiRequest.mockReset();
  mockRequests();
});

afterEach(cleanup);

describe("MarketingCostIntegrationsPanel visual", () => {
  it("filtra campanha AF e vincula uma campanha real do Pinterest", async () => {
    const user = userEvent.setup();
    render(<MarketingCostIntegrationsPanel />);

    const platform = await screen.findByLabelText("Plataforma");
    await user.selectOptions(platform, "pinterest_ads");

    const managedCampaign = await screen.findByLabelText("Campanha do AF");
    expect(screen.getByRole("option", { name: "Pinterest Agosto" })).not.toBeNull();
    expect(screen.queryByRole("option", { name: "TikTok Agosto" })).toBeNull();
    expect(managedCampaign.value).toBe("11");

    const external = await screen.findByLabelText("Campanha real do Pinterest Ads");
    await screen.findByRole("option", {
      name: "Pinterest Profissionais · Ativa · 101"
    });
    await user.selectOptions(external, "101");

    expect(screen.getByLabelText("ID da conta externa").value).toBe("549768356618");
    expect(screen.getByLabelText("Nome externo").value).toBe("Pinterest Profissionais");

    await user.click(
      screen.getByRole("button", { name: "Vincular campanha verificada" })
    );

    await waitFor(() => {
      expect(apiRequest).toHaveBeenCalledWith(
        "/admin/marketing/custos-integracoes/vinculos",
        {
          method: "POST",
          body: {
            campanhaId: 11,
            provedor: "pinterest_ads",
            contaExternaId: "549768356618",
            campanhaExternaId: "101",
            campanhaExternaNome: "Pinterest Profissionais"
          }
        }
      );
    });
  });

  it("lista TikTok e testa a conexão pelo mesmo contrato", async () => {
    const user = userEvent.setup();
    render(<MarketingCostIntegrationsPanel />);

    const platform = await screen.findByLabelText("Plataforma");
    expect(screen.getByRole("option", { name: "Pinterest Ads" })).not.toBeNull();
    expect(screen.getByRole("option", { name: "TikTok Ads" })).not.toBeNull();

    await user.selectOptions(platform, "tiktok_ads");

    await screen.findByRole("option", {
      name: "TikTok Profissionais · ENABLE · 2001"
    });
    expect(screen.getByRole("option", { name: "TikTok Agosto" })).not.toBeNull();
    expect(screen.queryByRole("option", { name: "Pinterest Agosto" })).toBeNull();

    const testButtons = screen.getAllByRole("button", { name: "Testar conexão" });
    await user.click(testButtons[3]);

    expect(
      await screen.findByText(
        "TikTok Ads conectado com sucesso. Agenda Fashion TikTok · BRL · America/Sao_Paulo · v1.3."
      )
    ).not.toBeNull();
  });
});
