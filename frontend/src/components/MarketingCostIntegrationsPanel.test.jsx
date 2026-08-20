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

function mockRequests() {
  apiRequest.mockImplementation((path, options = {}) => {
    if (path === "/admin/marketing/custos-integracoes") {
      return Promise.resolve({
        sincronizacaoAutomatica: {
          habilitado: false,
          intervaloHoras: 6,
          limiteDesatualizadoHoras: 24
        },
        provedores: [
          {
            provedor: "google_ads",
            nome: "Google Ads",
            habilitado: true,
            configurado: true,
            contaExternaId: "6770207927",
            vinculos: 0,
            ultimaSincronizacao: null
          },
          {
            provedor: "meta_ads",
            nome: "Meta Ads",
            habilitado: true,
            configurado: true,
            contaExternaId: "1122334455",
            vinculos: 0,
            ultimaSincronizacao: null
          }
        ],
        vinculos: []
      });
    }

    if (path === "/admin/marketing/gestao-campanhas") {
      return Promise.resolve({
        campanhas: [
          {
            id: 5,
            nome: "Google Agosto",
            canal: "google",
            objetivo: "profissional",
            ativo: true
          },
          {
            id: 6,
            nome: "Google arquivada",
            canal: "google",
            objetivo: "indefinido",
            ativo: false
          },
          {
            id: 8,
            nome: "Meta Agosto",
            canal: "meta",
            objetivo: "profissional",
            ativo: true
          }
        ]
      });
    }

    if (path === "/admin/marketing/custos-integracoes/google_ads/campanhas") {
      return Promise.resolve({
        provedor: "google_ads",
        contaExternaId: "6770207927",
        campanhas: [
          { id: "555", nome: "Aquisição real", status: "ENABLED", tipo: "SEARCH" },
          { id: "777", nome: "Marca pausada", status: "PAUSED", tipo: "SEARCH" }
        ]
      });
    }

    if (path === "/admin/marketing/custos-integracoes/meta_ads/campanhas") {
      return Promise.resolve({
        provedor: "meta_ads",
        contaExternaId: "1122334455",
        campanhas: [
          { id: "901", nome: "Profissionais Meta", status: "ACTIVE", tipo: "OUTCOME_TRAFFIC" },
          { id: "902", nome: "Marca Meta pausada", status: "PAUSED", tipo: "OUTCOME_AWARENESS" }
        ]
      });
    }

    if (
      path === "/admin/marketing/custos-integracoes/google_ads/testar" &&
      options.method === "POST"
    ) {
      return Promise.resolve({
        provedor: "google_ads",
        conectado: true,
        contaExternaId: "6770207927",
        nomeConta: "Agenda Fashion Ads",
        moeda: "BRL",
        fusoHorario: "America/Sao_Paulo",
        apiVersion: "v25"
      });
    }

    if (
      path === "/admin/marketing/custos-integracoes/meta_ads/testar" &&
      options.method === "POST"
    ) {
      return Promise.resolve({
        provedor: "meta_ads",
        conectado: true,
        contaExternaId: "1122334455",
        nomeConta: "Agenda Fashion Meta",
        moeda: "BRL",
        fusoHorario: "America/Sao_Paulo",
        apiVersion: "v25.0"
      });
    }

    if (
      path === "/admin/marketing/custos-integracoes/vinculos" &&
      options.method === "POST"
    ) {
      return Promise.resolve({ vinculo: { id: 9 } });
    }

    return Promise.reject(new Error(`Rota inesperada: ${path}`));
  });
}

beforeEach(() => {
  apiRequest.mockReset();
  mockRequests();
});

afterEach(cleanup);

describe("MarketingCostIntegrationsPanel", () => {
  it("esconde sincronização enquanto não existe vínculo de campanha", async () => {
    render(<MarketingCostIntegrationsPanel />);

    expect(await screen.findAllByText("Nenhuma campanha vinculada")).toHaveLength(2);
    expect(screen.queryByRole("button", { name: "Sincronizar 30 dias" })).toBeNull();
    expect(
      screen.getAllByText("Vincule uma campanha para liberar a sincronização de custos.")
    ).toHaveLength(2);
  });

  it("mostra o passo externo como pendente até escolher a campanha real", async () => {
    const user = userEvent.setup();
    render(<MarketingCostIntegrationsPanel />);

    const googleCampaign = await screen.findByLabelText("Campanha real do Google Ads");

    await waitFor(() => {
      expect(screen.getAllByText("Concluído")).toHaveLength(2);
    });
    expect(screen.getByText("Pendente")).not.toBeNull();

    await user.selectOptions(googleCampaign, "555");

    await waitFor(() => {
      expect(screen.getAllByText("Concluído")).toHaveLength(3);
    });
    expect(screen.queryByText("Pendente")).toBeNull();
  });

  it("testa a conexão com Google Ads e exibe a conta identificada", async () => {
    const user = userEvent.setup();
    render(<MarketingCostIntegrationsPanel />);

    const testButtons = await screen.findAllByRole("button", { name: "Testar conexão" });
    await user.click(testButtons[0]);

    await waitFor(() => {
      expect(apiRequest).toHaveBeenCalledWith(
        "/admin/marketing/custos-integracoes/google_ads/testar",
        { method: "POST", body: {} }
      );
    });

    expect(
      await screen.findByText(
        "Google Ads conectado com sucesso. Agenda Fashion Ads · BRL · America/Sao_Paulo · v25."
      )
    ).not.toBeNull();
    expect(screen.getByText("Agenda Fashion Ads · BRL · America/Sao_Paulo · v25")).not.toBeNull();
  });

  it("lista campanhas reais do Google e salva vínculo", async () => {
    const user = userEvent.setup();
    render(<MarketingCostIntegrationsPanel />);

    const googleCampaign = await screen.findByLabelText("Campanha real do Google Ads");
    expect(screen.getByRole("option", { name: "Google Agosto" })).not.toBeNull();
    expect(screen.queryByRole("option", { name: "Google arquivada" })).toBeNull();
    expect(screen.queryByRole("option", { name: "Meta Agosto" })).toBeNull();

    await screen.findByRole("option", { name: "Aquisição real · Ativa · 555" });
    await user.selectOptions(googleCampaign, "555");
    expect(googleCampaign.value).toBe("555");

    await user.click(screen.getByRole("button", { name: "Vincular campanha" }));

    await waitFor(() => {
      expect(apiRequest).toHaveBeenCalledWith(
        "/admin/marketing/custos-integracoes/vinculos",
        expect.objectContaining({
          method: "POST",
          body: {
            campanhaId: 5,
            provedor: "google_ads",
            contaExternaId: "6770207927",
            campanhaExternaId: "555",
            campanhaExternaNome: "Aquisição real"
          }
        })
      );
    });

    expect(await screen.findByText("Vínculo salvo com a campanha real do Google Ads.")).not.toBeNull();
  });

  it("testa Meta, lista campanhas reais e salva vínculo", async () => {
    const user = userEvent.setup();
    render(<MarketingCostIntegrationsPanel />);

    const platform = await screen.findByRole("combobox", { name: "Plataforma" });
    await user.selectOptions(platform, "meta_ads");

    const metaCampaign = await screen.findByLabelText("Campanha real do Meta Ads");
    expect(screen.getByRole("option", { name: "Meta Agosto" })).not.toBeNull();
    expect(screen.queryByRole("option", { name: "Google Agosto" })).toBeNull();

    await screen.findByRole("option", { name: "Profissionais Meta · Ativa · 901" });

    const testButtons = screen.getAllByRole("button", { name: "Testar conexão" });
    await user.click(testButtons[1]);

    expect(
      await screen.findByText(
        "Meta Ads conectado com sucesso. Agenda Fashion Meta · BRL · America/Sao_Paulo · v25.0."
      )
    ).not.toBeNull();

    await user.selectOptions(metaCampaign, "901");
    expect(metaCampaign.value).toBe("901");
    await user.click(screen.getByRole("button", { name: "Vincular campanha" }));

    await waitFor(() => {
      expect(apiRequest).toHaveBeenCalledWith(
        "/admin/marketing/custos-integracoes/vinculos",
        expect.objectContaining({
          method: "POST",
          body: {
            campanhaId: 8,
            provedor: "meta_ads",
            contaExternaId: "1122334455",
            campanhaExternaId: "901",
            campanhaExternaNome: "Profissionais Meta"
          }
        })
      );
    });

    expect(await screen.findByText("Vínculo salvo com a campanha real do Meta Ads.")).not.toBeNull();
  });
});
