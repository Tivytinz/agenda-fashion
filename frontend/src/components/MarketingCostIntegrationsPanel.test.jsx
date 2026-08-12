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
            habilitado: false,
            configurado: false,
            contaExternaId: null,
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
            ativo: true
          },
          {
            id: 8,
            nome: "Meta Agosto",
            canal: "meta",
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
          {
            id: "555",
            nome: "Aquisição real",
            status: "ENABLED",
            tipo: "SEARCH"
          },
          {
            id: "777",
            nome: "Marca pausada",
            status: "PAUSED",
            tipo: "SEARCH"
          }
        ]
      });
    }

    if (
      path === "/admin/marketing/custos-integracoes/vinculos" &&
      options.method === "POST"
    ) {
      return Promise.resolve({
        vinculo: {
          id: 9,
          campanha_id: 5,
          provedor: "google_ads",
          conta_externa_id: "6770207927",
          campanha_externa_id: "555",
          campanha_externa_nome: "Aquisição real"
        },
        campanhaExterna: {
          id: "555",
          nome: "Aquisição real",
          status: "ENABLED",
          tipo: "SEARCH"
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

afterEach(cleanup);

describe("MarketingCostIntegrationsPanel", () => {
  it("lista campanhas reais do Google e salva vínculo verificado", async () => {
    const user = userEvent.setup();

    render(<MarketingCostIntegrationsPanel />);

    const googleCampaign = await screen.findByLabelText(
      "Campanha real do Google Ads"
    );

    expect(screen.getByRole("option", { name: "Google Agosto" })).not.toBeNull();
    expect(screen.queryByRole("option", { name: "Meta Agosto" })).toBeNull();

    await user.selectOptions(googleCampaign, "555");

    expect(screen.getByLabelText("Nome externo").value).toBe("Aquisição real");
    expect(screen.getByLabelText("Status no Google Ads").value).toBe("Ativa");
    expect(screen.getByLabelText("ID da conta externa").value).toBe("6770207927");

    await user.click(
      screen.getByRole("button", { name: "Vincular campanha verificada" })
    );

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

    expect(
      await screen.findByText("Vínculo verificado e salvo com a campanha real do Google Ads.")
    ).not.toBeNull();
  });
});
